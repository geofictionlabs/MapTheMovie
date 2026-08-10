// supabase/functions/location-scout-approach-check/index.ts
//
// Location Scout: the live first-leg approach check (Item 16). Fires
// once per hunt session, when a player's live distance to waypoint 1
// first drops inside the trigger radius (enforced server-side in
// evaluate_approach_check, migration 081 -- this function never makes
// its own distance decision from client-supplied coordinates). Advisory
// only -- log only, gates nothing. A slow or failed call must never
// affect gameplay; the client fire-and-forgets this (see App.jsx) and
// swallows every error silently.
//
// FIRST PLAYER-INVOKABLE LOCATION SCOUT FUNCTION. The other five
// (location-scout-streetview-check, location-scout-osm-hazard-check,
// location-scout-check-pack, location-scout-corridor-check,
// location-scout-geofence-check) are all admin-gated -- service-role
// client, getUser(token), direct platform_admins row read, confirmed
// byte-identical across all five in the prior investigation session.
// This function is the inverse: no admin gate at all, callable by any
// authenticated player session -- including anonymous-auth sessions
// (signInAnonymously() -- role 'authenticated', is_anonymous: true).
// Relies on Supabase's default JWT verification (no config.toml, no
// --no-verify-jwt anywhere in this repo's CI) rather than any bespoke
// check: an anonymous-auth session already carries a real signed JWT,
// which is all default verification requires.
//
// TWO CLIENTS, DELIBERATELY DIFFERENT PRIVILEGE LEVELS:
//   1. jwtScopedClient -- built from the incoming request's own
//      Authorization header against the ANON key. Used ONLY for the
//      evaluate_approach_check call, so auth.uid() inside that function
//      resolves to the real calling player and its ownership check
//      (user_id = auth.uid()) means something. A service-role client's
//      auth.uid() is always NULL -- confirmed against every SECURITY
//      DEFINER function in this codebase that touches auth.uid().
//   2. supabase (service-role) -- used for everything after
//      should_fire: true: the subject insert, the Overpass call, and
//      the check-row write. Same client shape every other Location
//      Scout function already uses for its DB work.
//
// DEDUPE: entirely server-side, via hunt_sessions.approach_check_fired_at
// (migration 080) and the atomic UPDATE ... WHERE ... IS NULL claim
// inside evaluate_approach_check (081). This function trusts
// should_fire completely and implements no dedupe logic of its own.
//
// NO get_location_scout_subject_line HERE (migration 077): that RPC
// resolves an EXISTING stored subject's geometry back to GeoJSON. There
// is no pre-existing subject in this flow -- create_approach_sweep_subject
// (082) builds the LineString fresh from the player's live position and
// W1's server-resolved coordinates, and returns its GeoJSON directly,
// so this function goes straight to check_line_against_geojson (078).
//
// puzzle_id / w1_lat / w1_lon: taken ONLY from evaluate_approach_check's
// own response, never from the incoming request body. The server
// resolves waypoint 1 itself; nothing the client claims about which
// puzzle or waypoint it's near is trusted.
//
// EVERYTHING FROM THE OVERPASS CALL ONWARD IS A DIRECT, UNCHANGED REUSE
// of location-scout-corridor-check/index.ts, WITH ONE DELIBERATE ADDITION
// (confirmed line-for-line against that file in the prior investigation
// session, and re-flagged here so this comment doesn't go stale the way
// others in this codebase already have): OVERPASS_URL, OVERPASS_RADIUS_M,
// BLOCK_DISTANCE_M (10m) / FLAG_DISTANCE_M (30m), AREA_CATEGORIES,
// categoriseWay, buildOverpassQuery itself (the vertex-list `around`
// polyline plus is_in()-at-both-endpoints approach, including that
// function's own named limitation: a large hazard polygon the line cuts
// through the middle of, without either endpoint inside it and with the
// polygon's own edges more than OVERPASS_RADIUS_M from every point on
// the line, would not be discovered), the relations/malformed-ways/
// postgis-errors skip-and-record pattern, and the outcome decision tree
// are all unchanged, copied verbatim per this build's own instruction
// not to reimplement them.
//
// THE ADDITION: interpolateLine/OVERPASS_SAMPLE_SPACING_M, used only at
// the Overpass fetch call site below, NOT present in
// location-scout-corridor-check and not added there. Corridor-check's
// lines run waypoint-to-waypoint at whatever real distance two adjacent
// fixed points happen to be, and the 100m gap in its own `around`
// coverage between distant vertices is an accepted, named limitation for
// that use case. This function's line runs up to ~350m (the trigger
// radius) on every single approach, so a hazard sitting in the middle of
// a long straight approach -- more than 100m from both the player's
// position and W1 -- would otherwise be invisible to every check this
// function ever runs, not an edge case. Fixed by densifying the line
// with intermediate sample points before it reaches buildOverpassQuery,
// not by changing buildOverpassQuery or OVERPASS_RADIUS_M themselves --
// both stay exactly as corridor-check defines them.
//
// check_type = 'osm_corridor_intersect' -- NOT a new check_type. Same
// semantics ("does this line cross a hazard") as the corridor-segment
// check, reused deliberately so ScoutResultsTab's existing
// check_type-keyed rendering (scoutFindingDetailText, CommandCenter.jsx
// -- confirmed in the prior investigation session to branch on
// check_type only, never subject_type) renders this with zero new
// frontend code. subject_type ('approach_sweep' on the subject row) is
// what actually distinguishes this from a corridor_segment check.
//
// RESPONSE SHAPE ON A VALIDATION OUTCOME (session not found, W1 not
// found, too far, already fired): HTTP 200 with a should_fire:false (or
// success:false) body, never a 4xx -- these are expected, routine
// outcomes on a 5s poll loop calling this from every active hunt
// session near a first waypoint, not error conditions. Genuine
// infrastructure failures (an RPC that errors because a migration
// hasn't run, a failed insert) still return 502 with a hint, same
// convention as every other Location Scout function -- worth being
// loud about in function logs even though the client itself ignores
// the status code either way.
//
// GDPR / RETENTION, OPEN ITEM, NOT RESOLVED HERE: the approach_sweep
// subject's stored line has the player's live position as one endpoint
// -- that start point is personal data (a real GPS fix tied, via the
// session, to a real user). Retention policy for this is pending in
// MASTER-PLAN.md's Housekeeping section. Flagged here rather than
// decided -- do not add a retention/expiry mechanism as part of this
// build without that decision being made first.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CODE_VERSION = 'osm-approach-sweep-v1';
const CHECK_TYPE = 'osm_corridor_intersect';

// Unchanged from location-scout-corridor-check / location-scout-osm-hazard-check.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 100;
const BLOCK_DISTANCE_M = 10;
const FLAG_DISTANCE_M = 30;
// New: max spacing between Overpass search points along the line. 150m
// spacing means the worst-case midpoint is 75m from the nearer sample
// point -- safely inside OVERPASS_RADIUS_M (100m) with margin for
// approximation error. Derived from OVERPASS_RADIUS_M, not picked
// independently: spacing/2 must stay under the search radius.
const OVERPASS_SAMPLE_SPACING_M = 150;

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Unchanged from location-scout-corridor-check.
const AREA_CATEGORIES = ['water', 'wetland'];

function categoriseWay(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  if (tags.natural === 'water') return 'water';
  if (tags.natural === 'coastline') return 'coastline';
  if (tags.railway) return 'rail';
  if (tags.highway) return 'road';
  if (tags.natural === 'cliff') return 'cliff';
  if (tags.man_made === 'embankment') return 'embankment';
  if (tags.natural === 'wetland') return 'wetland';
  return null;
}

// Unchanged from location-scout-corridor-check.
function buildOverpassQuery(coordinates: number[][]): string {
  const aroundCoords = coordinates.map(([lon, lat]) => `${lat},${lon}`).join(',');
  const areaTagPattern = AREA_CATEGORIES.join('|');
  const [firstLon, firstLat] = coordinates[0];
  const [lastLon, lastLat] = coordinates[coordinates.length - 1];

  return `[out:json][timeout:25];
(
  way["natural"="water"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  relation["natural"="water"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["natural"="coastline"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["railway"~"^(rail|light_rail|tram|subway|narrow_gauge)$"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["highway"~"^(motorway|trunk|primary|motorway_link|trunk_link)$"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["natural"="cliff"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["man_made"="embankment"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  way["natural"="wetland"](around:${OVERPASS_RADIUS_M},${aroundCoords});
  relation["natural"="wetland"](around:${OVERPASS_RADIUS_M},${aroundCoords});
)->.proximity;
is_in(${firstLat},${firstLon})->.pivotStart;
is_in(${lastLat},${lastLon})->.pivotEnd;
(
  way(pivot.pivotStart)["natural"~"^(${areaTagPattern})$"];
  relation(pivot.pivotStart)["natural"~"^(${areaTagPattern})$"];
  way(pivot.pivotEnd)["natural"~"^(${areaTagPattern})$"];
  relation(pivot.pivotEnd)["natural"~"^(${areaTagPattern})$"];
)->.containment;
(.proximity; .containment;);
out geom;`;
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Densifies a line so no point on the true path is more than
// OVERPASS_SAMPLE_SPACING_M/2 from a sample point in the returned array --
// buildOverpassQuery's "around" filter only searches near listed points,
// so a long straight 2-point line otherwise leaves its middle unsearched.
// Linear lat/lon interpolation, not full geodesic -- negligible difference
// at this scale (lines here are under ~500m). Only affects which points
// get searched; the true 2-point line is still what's stored on the
// subject and what check_line_against_geojson tests distance against.
function interpolateLine(coordinates: number[][], maxSpacingM: number): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];
    result.push([lon1, lat1]);

    const segmentDistanceM = haversineMetres(lat1, lon1, lat2, lon2);
    const segments = Math.ceil(segmentDistanceM / maxSpacingM);
    for (let s = 1; s < segments; s++) {
      const t = s / segments;
      result.push([lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t]);
    }
  }
  result.push(coordinates[coordinates.length - 1]);
  return result;
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

  const body = await req.json();
  const { session_id, player_lat, player_lon } = body;

  if (!session_id || typeof session_id !== 'string') {
    return jsonResponse({ error: 'session_id is required' }, 400);
  }
  if (typeof player_lat !== 'number' || typeof player_lon !== 'number') {
    return jsonResponse({ error: 'player_lat/player_lon must be numbers' }, 400);
  }

  // JWT-scoped client -- forwards the caller's own Authorization header
  // so auth.uid() inside evaluate_approach_check resolves to the real
  // player. NOT the service-role client -- see this file's header.
  const jwtScopedClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: evalResult, error: evalError } = await jwtScopedClient.rpc(
    'evaluate_approach_check',
    { p_session_id: session_id, p_player_lat: player_lat, p_player_lon: player_lon }
  );

  if (evalError) {
    return jsonResponse(
      {
        error: 'Failed to evaluate approach check',
        detail: evalError.message,
        hint: 'If this reads "function does not exist", migration 081 has not been run yet.',
      },
      502
    );
  }

  // A validation outcome (session not found, W1 not found) -- routine,
  // not an infrastructure failure. Quiet 200, matching the design's
  // "never an error the client would surface" principle.
  if (!evalResult?.success) {
    return jsonResponse({ should_fire: false, reason: evalResult?.error || 'unknown' });
  }

  if (!evalResult.should_fire) {
    return jsonResponse({
      should_fire: false,
      reason: evalResult.reason,
      distance_m: evalResult.distance_m ?? null,
    });
  }

  // ── should_fire: true -- switch to the service-role client for
  // everything below, same as every other Location Scout function's DB
  // work. ──────────────────────────────────────────────────────────
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  const { data: subjectResult, error: subjectError } = await supabase.rpc(
    'create_approach_sweep_subject',
    {
      p_puzzle_id: evalResult.puzzle_id,
      p_player_lat: player_lat,
      p_player_lon: player_lon,
      p_w1_lat: evalResult.w1_lat,
      p_w1_lon: evalResult.w1_lon,
    }
  );

  if (subjectError || !subjectResult?.subject_id) {
    return jsonResponse(
      {
        error: 'Failed to create approach_sweep subject',
        detail: subjectError?.message,
        hint: 'If this reads "function does not exist", migration 082 has not been run yet.',
      },
      502
    );
  }

  const subjectId = subjectResult.subject_id;
  const lineGeojson = subjectResult.geojson;
  const lineCoords: number[][] = lineGeojson.coordinates;

  // ── Overpass ────────────────────────────────────────────────────────
  let rawStatus = 'OK';
  let elements: any[] = [];
  let overpassErrorMessage: string | null = null;
  let overpassDataTimestamp: string | null = null;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'MapTheMovie-LocationScout/1.0 (+https://geofictionlabs.co.uk; hello@geofictionlabs.co.uk)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: buildOverpassQuery(interpolateLine(lineCoords, OVERPASS_SAMPLE_SPACING_M)),
    });
    if (!res.ok) {
      rawStatus = 'OVERPASS_ERROR';
      overpassErrorMessage = `HTTP ${res.status}`;
    } else {
      try {
        const parsed = await res.json();
        elements = Array.isArray(parsed?.elements) ? parsed.elements : [];
        overpassDataTimestamp =
          typeof parsed?.osm3s?.timestamp_osm_base === 'string'
            ? parsed.osm3s.timestamp_osm_base
            : null;
      } catch (parseErr) {
        rawStatus = 'PARSE_ERROR';
        overpassErrorMessage = parseErr instanceof Error ? parseErr.message : String(parseErr);
      }
    }
  } catch (err) {
    rawStatus = 'OVERPASS_ERROR';
    overpassErrorMessage = err instanceof Error ? err.message : String(err);
  }

  if (rawStatus !== 'OK') {
    const { data: errorRow, error: errInsertError } = await supabase
      .from('location_scout_checks')
      .insert({
        subject_id: subjectId,
        check_type: CHECK_TYPE,
        outcome: 'error',
        confidence: null,
        detail: {
          subject_coordinates: lineCoords,
          raw_status: rawStatus,
          overpass_error: overpassErrorMessage,
          candidate_count: 0,
          nearest_distance_m: null,
          nearest_feature: null,
          is_contained: null,
          by_category: null,
          relations_skipped: [],
        },
        model_id: null,
        osm_extract_date: null,
        code_version: CODE_VERSION,
      })
      .select()
      .single();

    if (errInsertError) {
      return jsonResponse(
        { error: 'Failed to record check', detail: errInsertError.message },
        502
      );
    }
    return jsonResponse({ should_fire: true, outcome: 'error', check: errorRow });
  }

  // ── Split elements ── unchanged from location-scout-corridor-check.
  const relationsSkipped = elements
    .filter((el) => el.type === 'relation')
    .map((el) => ({ id: el.id, tags: el.tags ?? {} }));

  const malformedWaysSkipped: Array<{ id: number; reason: string }> = [];
  const postgisErrorsSkipped: Array<{ osm_id: number; category: string; reason: string }> = [];

  type Candidate = {
    osmId: number;
    category: string;
    tags: Record<string, string>;
    geojson: { type: string; coordinates: unknown };
  };

  const candidates: Candidate[] = [];
  const seenWayIds = new Set<number>();

  for (const el of elements) {
    if (el.type !== 'way') continue;
    if (seenWayIds.has(el.id)) continue;
    seenWayIds.add(el.id);

    const category = categoriseWay(el.tags);
    if (!category) {
      malformedWaysSkipped.push({ id: el.id, reason: 'no recognised hazard tag' });
      continue;
    }

    const geom = Array.isArray(el.geometry) ? el.geometry : [];
    const coords: number[][] = geom
      .filter((p: any) => typeof p?.lat === 'number' && typeof p?.lon === 'number')
      .map((p: any) => [p.lon, p.lat]);

    if (coords.length < 2) {
      malformedWaysSkipped.push({ id: el.id, reason: `too few nodes (${coords.length})` });
      continue;
    }

    let geojson: { type: string; coordinates: unknown };

    if (AREA_CATEGORIES.includes(category)) {
      const ring = [...coords];
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) {
        ring.push([first[0], first[1]]);
      }
      if (ring.length < 4) {
        malformedWaysSkipped.push({ id: el.id, reason: `ring too short to close (${ring.length})` });
        continue;
      }
      geojson = { type: 'Polygon', coordinates: [ring] };
    } else {
      geojson = { type: 'LineString', coordinates: coords };
    }

    candidates.push({ osmId: el.id, category, tags: el.tags ?? {}, geojson });
  }

  // ── Test each candidate ── unchanged from location-scout-corridor-check.
  let anyContained = false;
  let nearestDistance: number | null = null;
  let nearestFeature: Record<string, unknown> | null = null;
  const byCategory: Record<string, number | null> = {
    water: null, coastline: null, rail: null, road: null, cliff: null, embankment: null, wetland: null,
  };

  for (const c of candidates) {
    const { data: rows, error: rpcError } = await supabase.rpc('check_line_against_geojson', {
      p_line_geojson: lineGeojson,
      p_geojson: c.geojson,
    });

    if (rpcError) {
      postgisErrorsSkipped.push({
        osm_id: c.osmId,
        category: c.category,
        reason: rpcError.message,
      });
      continue;
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) {
      postgisErrorsSkipped.push({
        osm_id: c.osmId,
        category: c.category,
        reason: 'RPC succeeded but returned no row',
      });
      continue;
    }

    const distance = typeof row.distance_m === 'number' ? row.distance_m : null;
    if (row.is_contained === true) anyContained = true;

    if (distance !== null) {
      if (nearestDistance === null || distance < nearestDistance) {
        nearestDistance = distance;
        nearestFeature = { type: 'way', osm_id: c.osmId, category: c.category, tags: c.tags };
      }
      const current = byCategory[c.category];
      if (current === null || distance < current) {
        byCategory[c.category] = distance;
      }
    }
  }

  // ── Outcome ── unchanged decision tree and thresholds.
  const zeroSuccessfulCandidates =
    candidates.length > 0 && postgisErrorsSkipped.length === candidates.length;

  let outcome: string;
  if (zeroSuccessfulCandidates) {
    outcome = 'error';
  } else if (anyContained) {
    outcome = 'block';
  } else if (nearestDistance !== null && nearestDistance <= BLOCK_DISTANCE_M) {
    outcome = 'block';
  } else if (nearestDistance !== null && nearestDistance <= FLAG_DISTANCE_M) {
    outcome = 'flag';
  } else {
    outcome = 'pass';
  }

  const detail = {
    subject_coordinates: lineCoords,
    subject_type: 'approach_sweep',
    raw_status: rawStatus,
    candidate_count: candidates.length,
    nearest_distance_m: nearestDistance,
    nearest_feature: nearestFeature,
    is_contained: anyContained,
    by_category: byCategory,
    relations_skipped: relationsSkipped,
    malformed_ways_skipped: malformedWaysSkipped,
    postgis_errors_skipped: postgisErrorsSkipped,
    zero_successful_candidates: zeroSuccessfulCandidates,
    overpass_data_timestamp: overpassDataTimestamp,
    search_radius_m: OVERPASS_RADIUS_M,
  };

  const { data: insertedRow, error: insertError } = await supabase
    .from('location_scout_checks')
    .insert({
      subject_id: subjectId,
      check_type: CHECK_TYPE,
      outcome,
      confidence: null,
      detail,
      model_id: null,
      osm_extract_date: null,
      code_version: CODE_VERSION,
    })
    .select()
    .single();

  if (insertError) {
    return jsonResponse({ error: 'Failed to record check', detail: insertError.message }, 502);
  }

  return jsonResponse({ should_fire: true, outcome, check: insertedRow });
});
