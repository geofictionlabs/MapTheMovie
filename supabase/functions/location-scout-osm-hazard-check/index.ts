// supabase/functions/location-scout-osm-hazard-check/index.ts
//
// Location Scout Phase 1, checks #2 and #3 combined: OSM hazard
// proximity. Water, coastline, rail, major road, cliff and embankment
// are one check_type ('osm_hazard_proximity') and one function -- they
// share a query, a geometry pipeline and an outcome table, so splitting
// them would mean two Overpass round-trips and two rows describing the
// same physical question.
//
// Deploy: via CI only (.github/workflows/deploy-edge-functions.yml).
// A third deploy step was added for this function -- the workflow names
// each function explicitly, so a new directory with no step deploys
// nothing while still reporting green.
//
// No API key: Overpass is public and unauthenticated. Nothing to set.
//
// Auth mirrors location-scout-streetview-check exactly: service-role
// client, getUser(token), direct platform_admins row read. NOT
// is_platform_admin() -- it reads auth.uid(), which is NULL under a
// service-role client, so it would reject every caller.
//
// Subject resolution reuses get_location_scout_subject_point (migration
// 073) rather than duplicating the point extraction.
//
// location_scout_checks is append-only by grant (migration 057), so this
// only ever INSERTs -- a re-run is a new row, never an edit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CODE_VERSION = 'osm-hazard-v1';
const CHECK_TYPE = 'osm_hazard_proximity';

const LINE_SUBJECT_TYPES = ['corridor_segment', 'approach_sweep'];

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 100;

// Outcome bands. Note these are tighter than the query radius: anything
// between 30m and the 100m search radius is a pass, and is still recorded
// in the detail breakdown so the near-miss is visible.
const BLOCK_DISTANCE_M = 10;
const FLAG_DISTANCE_M = 30;

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildOverpassQuery(lat: number, lon: number): string {
  return `[out:json][timeout:25];
(
  way["natural"="water"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  relation["natural"="water"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["natural"="coastline"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["railway"~"^(rail|light_rail|tram|subway|narrow_gauge)$"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["highway"~"^(motorway|trunk|primary|motorway_link|trunk_link)$"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["natural"="cliff"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["man_made"="embankment"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  way["natural"="wetland"](around:${OVERPASS_RADIUS_M},${lat},${lon});
  relation["natural"="wetland"](around:${OVERPASS_RADIUS_M},${lat},${lon});
);
out geom;`;
}

// Which hazard category a way belongs to, derived from the same tags the
// query selected on. Order matters only in that a way could carry more
// than one matching tag; first match wins and is recorded, so the
// category breakdown stays one-feature-one-bucket.
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

// natural=water and natural=wetland are treated as areas. Everything else is
// linear -- a coastline, rail line, road centreline, cliff edge or embankment
// is a line even when it bounds something.
const AREA_CATEGORIES = ['water', 'wetland'];

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

  const subject = Array.isArray(subjectRows) ? subjectRows[0] : subjectRows;
  if (!subject) {
    return jsonResponse({ error: 'Subject not found or inactive', subject_id }, 404);
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
        detail: {
          reason: 'line-type subject, point-based hazard check not applicable -- see osm_corridor_intersect for corridor checks, not yet built',
        },
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

  const lat = subject.lat;
  const lon = subject.lon;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return jsonResponse(
      { error: 'Subject has no resolvable point coordinates', subject_id, subject_type: subjectType },
      422
    );
  }

  // ── Overpass ────────────────────────────────────────────────────────
  let rawStatus = 'OK';
  let elements: any[] = [];
  let overpassErrorMessage: string | null = null;
  // Overpass reports how current its own data was when the query ran
  // (osm3s.timestamp_osm_base). This is the honest data-currency figure
  // for a live query, and is deliberately NOT written to
  // osm_extract_date -- that column's static-extract framing cannot
  // describe a continuously-updated source. May be absent; null then.
  let overpassDataTimestamp: string | null = null;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      // overpass-api.de tightened its request requirements (~18 April
      // 2026): a contact-identifying User-Agent is required, and generic
      // runtime-default agents are rejected. Accept and Accept-Encoding
      // are sent explicitly rather than left to the runtime.
      headers: {
        'Content-Type': 'text/plain',
        'User-Agent': 'MapTheMovie-LocationScout/1.0 (+https://geofictionlabs.co.uk; hello@geofictionlabs.co.uk)',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br',
      },
      body: buildOverpassQuery(lat, lon),
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
        subject_id,
        check_type: CHECK_TYPE,
        outcome: 'error',
        confidence: null,
        detail: {
          requested_lat: lat,
          requested_lon: lon,
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
    return jsonResponse(errorRow);
  }

  // ── Split elements ──────────────────────────────────────────────────
  // Relations are recorded and NOT tested: resolving a multipolygon's
  // outer/inner ring structure from `out geom` is a real piece of work,
  // and guessing at it would produce confident wrong answers. Named
  // limitation rather than a silent drop.
  const relationsSkipped = elements
    .filter((el) => el.type === 'relation')
    .map((el) => ({ id: el.id, tags: el.tags ?? {} }));

  // Ways that cannot form a valid geometry are also recorded rather than
  // dropped, same principle as relations_skipped.
  const malformedWaysSkipped: Array<{ id: number; reason: string }> = [];

  // Candidates whose PostGIS test failed. One bad geometry must not
  // abort the whole check -- a single self-intersecting OSM way would
  // otherwise throw away the verdict on every other feature nearby. Each
  // failure is recorded with its reason, same named-limitation principle
  // as the two arrays above.
  const postgisErrorsSkipped: Array<{ osm_id: number; category: string; reason: string }> = [];

  type Candidate = {
    osmId: number;
    category: string;
    tags: Record<string, string>;
    geojson: { type: string; coordinates: unknown };
  };

  const candidates: Candidate[] = [];

  for (const el of elements) {
    if (el.type !== 'way') continue;

    const category = categoriseWay(el.tags);
    if (!category) {
      malformedWaysSkipped.push({ id: el.id, reason: 'no recognised hazard tag' });
      continue;
    }

    const geom = Array.isArray(el.geometry) ? el.geometry : [];
    // GeoJSON is lon-first; Overpass gives {lat, lon}. Same flip as
    // ST_MakePoint(lon, lat) used elsewhere in this project.
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

  // ── Test each candidate ─────────────────────────────────────────────
  let anyContained = false;
  let nearestDistance: number | null = null;
  let nearestFeature: Record<string, unknown> | null = null;
  const byCategory: Record<string, number | null> = {
    water: null, coastline: null, rail: null, road: null, cliff: null, embankment: null, wetland: null,
  };

  for (const c of candidates) {
    const { data: rows, error: rpcError } = await supabase.rpc('check_point_against_geojson', {
      p_lat: lat,
      p_lon: lon,
      p_geojson: c.geojson,
    });

    // A failing RPC on ONE candidate is not a reason to abandon the
    // others. Record it and carry on; whether the failures amount to a
    // meaningless result is decided after the loop, once it is known how
    // many candidates were actually testable.
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

  // ── Outcome ─────────────────────────────────────────────────────────
  // "Found things to test and could not test any of them" is NOT a pass.
  // It is distinct from finding nothing nearby, which genuinely is one:
  // zero candidates means the area is clear, whereas every candidate
  // failing means the check has no idea what is there. Only the first of
  // those is safe to report as pass.
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
    requested_lat: lat,
    requested_lon: lon,
    subject_type: subjectType,
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
      subject_id,
      check_type: CHECK_TYPE,
      outcome,
      confidence: null,
      detail,
      model_id: null,
      // Deliberately null: this is a live Overpass query, not a dated
      // static extract. See the note raised alongside this function --
      // whether it should instead hold today's date is an open question,
      // not a decision made here.
      osm_extract_date: null,
      code_version: CODE_VERSION,
    })
    .select()
    .single();

  if (insertError) {
    return jsonResponse({ error: 'Failed to record check', detail: insertError.message }, 502);
  }

  return jsonResponse(insertedRow);
});
