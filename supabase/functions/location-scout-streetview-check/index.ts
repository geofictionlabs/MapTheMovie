// supabase/functions/location-scout-streetview-check/index.ts
//
// Location Scout Phase 1, check #1: Street View metadata.
//
// Deploy: via CI only (.github/workflows/deploy-edge-functions.yml).
// Manual `supabase functions deploy` was retired 2026-07-18 -- the
// workflow needed a SECOND deploy step added for this function; it was
// hardcoded to generate-trivia-question alone and would have pushed
// nothing for this directory.
//
// Set the key once: supabase secrets set GOOGLE_MAPS_API_KEY=...
// This secret does NOT exist yet. Until it is set, Deno.env.get returns
// undefined, the metadata call fails, and every check lands as
// outcome='error' -- which is the honest recorded result, not a crash.
//
// Re-checks admin status server-side on every call, same as
// generate-trivia-question: service-role client, getUser(token), then a
// direct platform_admins row read. Deliberately NOT the is_platform_admin()
// RPC -- that reads auth.uid(), which is null under the service-role
// client, so it would reject every caller.
//
// The checks table is append-only by grant (migration 057 revokes
// UPDATE/DELETE/TRUNCATE from service_role). A superseding result means a
// new row, never an edit -- so this function only ever INSERTs.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// No code_version convention existed in this codebase before this function
// -- location_scout_checks.code_version is NOT NULL but nothing had ever
// written to it. This establishes the convention: <check>-<vN>.
const CODE_VERSION = 'sv-metadata-v1';

const CHECK_TYPE = 'streetview_metadata';

// Subject types whose geom is a line, not a point. A point-based check
// cannot say anything meaningful about them, so they are recorded as
// skipped rather than silently passed.
const LINE_SUBJECT_TYPES = ['corridor_segment', 'approach_sweep'];

const STREETVIEW_METADATA_URL = 'https://maps.googleapis.com/maps/api/streetview/metadata';

// Distance beyond which the nearest panorama is too far from the requested
// point for the imagery to be evidence about that point.
const DISTANCE_THRESHOLD_M = 50;

// Inline rather than shared: nothing under supabase/functions/ exports a
// Haversine helper (checked -- the only JS copy is haversineMetres in
// src/App.jsx, which is frontend React source and not importable from a
// Deno Edge Function; the other copies are SQL, inside migrations 008 and
// 049). A five-line formula does not justify a new shared module.
function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Missing auth' }, 401);
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
  const token = authHeader.replace('Bearer ', '');

  const { data: userData, error: userError } = await supabase.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'Invalid session' }, 401);
  }

  const { data: adminRow } = await supabase
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!adminRow) {
    return jsonResponse({ error: 'Not authorized' }, 403);
  }

  const body = await req.json();
  const { subject_id } = body;

  if (!subject_id || typeof subject_id !== 'string') {
    return jsonResponse({ error: 'subject_id is required' }, 400);
  }

  // Resolve the subject's point via the RPC. Migration 073 creates this;
  // until it has been run, this returns a Postgres "function does not
  // exist" error, surfaced verbatim below rather than worked around.
  const { data: subjectRows, error: subjectError } = await supabase.rpc(
    'get_location_scout_subject_point',
    { p_subject_id: subject_id }
  );

  if (subjectError) {
    return jsonResponse(
      {
        error: 'Failed to resolve subject point',
        detail: subjectError.message,
        hint: 'If this reads "function does not exist", migration 073 has not been run yet.',
      },
      502
    );
  }

  // RETURNS TABLE, so supabase-js hands back an array. Zero rows means the
  // subject id is unknown OR the subject is inactive -- the RPC filters on
  // is_active itself and does not distinguish the two.
  const subject = Array.isArray(subjectRows) ? subjectRows[0] : subjectRows;
  if (!subject) {
    return jsonResponse(
      { error: 'Subject not found or inactive', subject_id },
      404
    );
  }

  const subjectType = subject.subject_type;

  if (LINE_SUBJECT_TYPES.includes(subjectType)) {
    const { data: skippedRow, error: skipInsertError } = await supabase
      .from('location_scout_checks')
      .insert({
        subject_id,
        check_type: CHECK_TYPE,
        outcome: 'skipped',
        confidence: null,
        detail: { reason: 'line-type subject, point check not applicable' },
        model_id: null,
        osm_extract_date: null,
        code_version: CODE_VERSION,
      })
      .select()
      .single();

    if (skipInsertError) {
      return jsonResponse(
        { error: 'Failed to record skipped check', detail: skipInsertError.message },
        502
      );
    }
    return jsonResponse(skippedRow);
  }

  const requestedLat = subject.lat;
  const requestedLon = subject.lon;

  // A point-typed subject whose geom is not actually a point comes back
  // with null coordinates. Never call the metadata API with undefined.
  if (typeof requestedLat !== 'number' || typeof requestedLon !== 'number') {
    return jsonResponse(
      {
        error: 'Subject has no resolvable point coordinates',
        subject_id,
        subject_type: subjectType,
      },
      422
    );
  }

  let rawStatus = 'FETCH_FAILED';
  let metadata: Record<string, unknown> | null = null;
  let fetchErrorMessage: string | null = null;

  try {
    const url = new URL(STREETVIEW_METADATA_URL);
    url.searchParams.set('location', `${requestedLat},${requestedLon}`);
    url.searchParams.set('key', GOOGLE_MAPS_API_KEY ?? '');

    const svResponse = await fetch(url.toString());
    if (!svResponse.ok) {
      rawStatus = `HTTP_${svResponse.status}`;
    } else {
      metadata = await svResponse.json();
      rawStatus = typeof metadata?.status === 'string' ? metadata.status : 'UNPARSEABLE';
    }
  } catch (err) {
    fetchErrorMessage = err instanceof Error ? err.message : String(err);
    rawStatus = 'FETCH_FAILED';
  }

  const returnedLocation = metadata?.location as { lat?: number; lng?: number } | undefined;
  const returnedLat = typeof returnedLocation?.lat === 'number' ? returnedLocation.lat : null;
  const returnedLon = typeof returnedLocation?.lng === 'number' ? returnedLocation.lng : null;

  let distanceM: number | null = null;
  if (returnedLat !== null && returnedLon !== null) {
    distanceM = haversineMetres(requestedLat, requestedLon, returnedLat, returnedLon);
  }

  let outcome: string;
  let confidence: number | null;

  if (rawStatus === 'OK' && distanceM !== null) {
    outcome = distanceM <= DISTANCE_THRESHOLD_M ? 'pass' : 'flag';
    confidence = Math.max(0, 1 - distanceM / DISTANCE_THRESHOLD_M);
  } else if (rawStatus === 'ZERO_RESULTS' || rawStatus === 'NOT_FOUND') {
    outcome = 'flag';
    confidence = 0;
  } else {
    // REQUEST_DENIED, OVER_QUERY_LIMIT, UNKNOWN_ERROR, INVALID_REQUEST,
    // non-200 HTTP, network failure -- and status OK with no usable
    // location, which cannot produce a distance and so cannot be scored
    // against the pass/flag threshold at all.
    outcome = 'error';
    confidence = null;
  }

  const detail: Record<string, unknown> = {
    requested_lat: requestedLat,
    requested_lon: requestedLon,
    returned_lat: returnedLat,
    returned_lon: returnedLon,
    distance_m: distanceM,
    raw_status: rawStatus,
    subject_type: subjectType,
  };
  if (typeof metadata?.pano_id === 'string') detail.pano_id = metadata.pano_id;
  if (typeof metadata?.date === 'string') detail.capture_date = metadata.date;
  if (fetchErrorMessage) detail.fetch_error = fetchErrorMessage;
  if (!GOOGLE_MAPS_API_KEY) detail.missing_api_key = true;

  const { data: insertedRow, error: insertError } = await supabase
    .from('location_scout_checks')
    .insert({
      subject_id,
      check_type: CHECK_TYPE,
      outcome,
      confidence,
      detail,
      model_id: null,
      osm_extract_date: null,
      code_version: CODE_VERSION,
    })
    .select()
    .single();

  if (insertError) {
    return jsonResponse(
      { error: 'Failed to record check', detail: insertError.message },
      502
    );
  }

  return jsonResponse(insertedRow);
});
