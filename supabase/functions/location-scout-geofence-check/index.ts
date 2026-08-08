// supabase/functions/location-scout-geofence-check/index.ts
//
// Location Scout: geofence_road_overlap (check_type already valid in
// migration 057's CHECK constraint -- no schema change needed).
// Tests whether the actual arrival GEOFENCE -- the circle a player
// must physically enter to trigger a reward, not the destination point
// itself -- overlaps a road. A generous geofence beside a trunk road
// is exactly the case osm_hazard_proximity (point-only, fixed 100m
// search radius unrelated to the hunt's own geofence size) cannot
// catch.
//
// Deploy: via CI only (.github/workflows/deploy-edge-functions.yml). NO
// step exists yet for location-scout-geofence-check -- same deliberate
// sequencing as every prior function this session: added together with
// the commit once this file is reviewed, not before. Not added here;
// this file is not being deployed until that step exists.
//
// No API key: Overpass is public and unauthenticated, same as the
// other two OSM-querying Location Scout functions.
//
// Auth: byte-identical to every other Location Scout Edge Function --
// service-role client, getUser(token) against the caller's own bearer
// token, then a direct platform_admins row read. NOT is_platform_admin()
// -- it reads auth.uid(), which is NULL under a service-role client, so
// it would reject every caller.
//
// Subject resolution uses get_location_scout_subject_buffer (migration
// 079, run and verified live this session) -- NOT
// get_location_scout_subject_point (073, returns scalar lat/lon, no
// way to carry a buffer polygon out) or get_location_scout_subject_line
// (077, explicitly returns NULL for anything that isn't ST_LineString,
// which a destination_point/waypoint_point's geom never is). Only
// destination_point and waypoint_point are handled -- the two
// subject_types with a real geom + radius_m geofence circle. Anything
// else (corridor_segment, approach_sweep, a future business_premises)
// is recorded 'skipped', same pattern every prior function uses for an
// inapplicable subject_type. A NULL geojson from the RPC is also
// skipped, not treated as an error -- migration 079's own documented
// guard returns NULL when radius_m is missing or non-positive, which
// is a real, expected state (not every subject has a configured
// geofence), not a failure.
//
// ROAD-ONLY OVERPASS QUERY, DELIBERATE, NOT THE FULL HAZARD SET.
// osm_hazard_proximity and osm_corridor_intersect both query every
// AREA_CATEGORIES/linear hazard category (water/coastline/rail/road/
// cliff/embankment/wetland). This function queries ONLY the highway
// tag pattern those two functions already use for their own 'road'
// category -- way["highway"~"^(motorway|trunk|primary|motorway_link|
// trunk_link)$"] -- reused verbatim, not widened or narrowed further.
// Confirmed and agreed this session: geofence_road_overlap's own name
// (not geofence_hazard_overlap, unlike the generically-named
// osm_hazard_proximity/osm_corridor_intersect) is a real signal this
// check was designed narrower on purpose.
//
// NO is_in() CONTAINMENT-WIDENING, CONFIRMED SOUND BEFORE WRITING, NOT
// ASSUMED. The corridor and point-based hazard checks run is_in() to
// catch a large AREA-type hazard (water/wetland) whose own boundary
// might sit outside the search radius even though the subject is
// inside it. Checked against the real code, not just the framing this
// was proposed with: AREA_CATEGORIES = ['water', 'wetland'] in both
// existing functions -- 'road' has NEVER been an area category. Even
// in the two existing full-hazard-set functions, a road candidate is
// already only ever built as a LineString, never tested via is_in().
// Since this function queries road tags exclusively, there is no
// candidate this function could ever encounter that is_in() widening
// would have caught. Omitted with confirmed reason, not by oversight.
//
// CANDIDATE GEOMETRY, SIMPLIFIED FROM THE OTHER TWO FUNCTIONS FOR THE
// SAME REASON: since road is never an area category, the Polygon-ring-
// closing branch location-scout-osm-hazard-check and
// location-scout-corridor-check both need (for water/wetland
// candidates) never applies here. Every candidate below is
// unconditionally built as a LineString. categoriseWay is still reused
// verbatim as a defensive check (an unexpected non-highway tag on a
// returned way should still be recorded, not silently accepted), even
// though it can only ever return 'road' or null against this query's
// own tag filter.
//
// OUTCOME LOGIC, DELIBERATELY NOT THE 10m/30m BLOCK/FLAG BANDS the
// other two checks use. Exactly two outcomes: check_line_against_geojson
// (migration 078, reused AS-IS -- its SQL body is genuinely type-
// agnostic, ST_GeomFromGeoJSON/ST_Distance/ST_Intersects are all
// polymorphic across geometry types, confirmed this session by reading
// the function body directly, not assumed from its name) returns
// is_contained=true for ANY road candidate (the buffer polygon
// genuinely intersects a road) -> 'block', unconditionally, no
// distance threshold. Otherwise -> 'pass', regardless of how close the
// nearest road is. A flag tier here would functionally duplicate
// osm_hazard_proximity's own flag tier for the same subject under a
// different name, not add new information -- deliberate, not an
// oversight. The actual measured nearest_distance_m is still recorded
// in detail regardless of outcome -- real context for anyone reading
// the raw row, just not elevated into its own severity band.
//
// DETAIL FIELD NAMES: nearest_feature, nearest_distance_m, is_contained,
// raw_status, candidate_count, overpass_data_timestamp, search_radius_m
// are the same field names the other two checks write, for
// ScoutResultsTab consistency. TWO FIELDS GENUINELY DIFFER, FLAGGED:
// (1) subject_geojson replaces requested_lat/requested_lon /
// subject_coordinates -- the subject here is a Polygon, not a point or
// a line, so the full buffer GeoJSON is recorded rather than a bare
// coordinate array. (2) by_category is a single-key { road: <metres or
// null> } object, not the seven-category object the other two checks
// use -- this function only ever queries one category, and silently
// carrying five permanently-null keys that were never queried would
// misrepresent what was actually checked. ScoutResultsTab does not yet
// branch on check_type === 'geofence_road_overlap' -- not touched
// here, separate follow-up once this function is deployed and proven,
// same sequencing check_errors and osm_corridor_intersect's rendering
// both followed.
//
// EXCEPTION SAFETY: same non-negotiable principle as every Location
// Scout piece this session -- every Overpass call and every
// per-candidate RPC call is wrapped so a single failure resolves to a
// tagged, honest outcome and is recorded, never thrown unhandled.
//
// location_scout_checks is append-only by grant (migration 057), so
// this only ever INSERTs -- a re-run is a new row, never an edit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CODE_VERSION = 'geofence-v1';
const CHECK_TYPE = 'geofence_road_overlap';

// Only these two subject_types have a real geom + radius_m geofence
// circle. Anything else is out of scope, skipped not processed.
const HANDLED_SUBJECT_TYPES = ['destination_point', 'waypoint_point'];

// Unchanged from location-scout-osm-hazard-check/location-scout-corridor-check.
// Used here as a generous candidate-discovery net around the buffer's
// own vertices, same role it plays in both other functions -- the
// actual block/pass decision comes from the precise PostGIS test
// below, not from this radius.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 100;

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Unchanged from location-scout-osm-hazard-check/location-scout-corridor-check.
// Reused verbatim as a defensive check even though, against this query's
// own tag filter, it can only ever return 'road' or null.
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

// Road-only version of buildOverpassQuery -- takes the buffer polygon's
// own exterior-ring vertex list. No is_in()/pivot containment-widening
// (see this file's header for why it does not apply to a road-only
// query), no water/wetland clauses, no relation query (roads under
// this tag pattern are always ways in OSM, never relations).
function buildOverpassQuery(coordinates: number[][]): string {
  const aroundCoords = coordinates.map(([lon, lat]) => `${lat},${lon}`).join(',');

  return `[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|motorway_link|trunk_link)$"](around:${OVERPASS_RADIUS_M},${aroundCoords});
);
out geom;`;
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

  const { data: subjectRows, error: subjectError } = await supabase.rpc(
    'get_location_scout_subject_buffer',
    { p_subject_id: subject_id }
  );

  if (subjectError) {
    return jsonResponse(
      {
        error: 'Failed to resolve subject buffer',
        detail: subjectError.message,
        hint: 'If this reads "function does not exist", migration 079 has not been run yet.',
      },
      502
    );
  }

  const subject = Array.isArray(subjectRows) ? subjectRows[0] : subjectRows;
  if (!subject) {
    return jsonResponse({ error: 'Subject not found or inactive', subject_id }, 404);
  }

  const subjectType = subject.subject_type;

  if (!HANDLED_SUBJECT_TYPES.includes(subjectType)) {
    return await recordSkipped(
      supabase,
      subject_id,
      `${subjectType} has no geofence buffer concept -- location-scout-geofence-check only handles destination_point and waypoint_point.`
    );
  }

  // Claims a handled subject_type but get_location_scout_subject_buffer
  // returned NULL -- migration 079's own documented guard, meaning no
  // positive radius_m is configured for this subject (or, defensively,
  // its geometry was not genuinely a Point). A real, expected state,
  // not a failure.
  if (!subject.geojson || !Array.isArray(subject.geojson.coordinates) || !Array.isArray(subject.geojson.coordinates[0])) {
    return await recordSkipped(
      supabase,
      subject_id,
      'subject has no resolvable geofence buffer (no positive radius_m configured) -- migration 079\'s own guard, not evaluated.'
    );
  }

  const ringCoords: number[][] = subject.geojson.coordinates[0];

  if (ringCoords.length < 4) {
    return await recordSkipped(
      supabase,
      subject_id,
      `subject's geofence buffer ring has too few vertices (${ringCoords.length}) to check.`
    );
  }

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
      body: buildOverpassQuery(ringCoords),
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
          subject_geojson: subject.geojson,
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
  // Relations recorded, not tested -- same named-limitation principle
  // as the other two functions, though this query never asks Overpass
  // for relations at all, so this should always be empty in practice.
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

    // Always LineString -- road is never an area category (see this
    // file's header), so the Polygon-ring-closing branch the other two
    // functions need for water/wetland never applies here.
    candidates.push({
      osmId: el.id,
      category,
      tags: el.tags ?? {},
      geojson: { type: 'LineString', coordinates: coords },
    });
  }

  // ── Test each candidate ─────────────────────────────────────────────
  // check_line_against_geojson (migration 078), reused AS-IS -- the
  // buffer polygon is passed as p_line_geojson (its SQL body places no
  // type restriction on that argument; see this file's header).
  let anyContained = false;
  let nearestDistance: number | null = null;
  let nearestFeature: Record<string, unknown> | null = null;

  for (const c of candidates) {
    const { data: rows, error: rpcError } = await supabase.rpc('check_line_against_geojson', {
      p_line_geojson: subject.geojson,
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

    if (distance !== null && (nearestDistance === null || distance < nearestDistance)) {
      nearestDistance = distance;
      nearestFeature = { type: 'way', osm_id: c.osmId, category: c.category, tags: c.tags };
    }
  }

  // ── Outcome ─────────────────────────────────────────────────────────
  // Exactly two possibilities, no distance bands -- see this file's
  // header for why. "Found candidates but could not test any of them"
  // is still not a pass, same principle as the other two functions.
  const zeroSuccessfulCandidates =
    candidates.length > 0 && postgisErrorsSkipped.length === candidates.length;

  let outcome: string;
  if (zeroSuccessfulCandidates) {
    outcome = 'error';
  } else if (anyContained) {
    outcome = 'block';
  } else {
    outcome = 'pass';
  }

  const detail = {
    // subject_geojson replaces requested_lat/requested_lon /
    // subject_coordinates -- the subject here is a Polygon. Flagged
    // field-name difference, see this file's header.
    subject_geojson: subject.geojson,
    subject_type: subjectType,
    raw_status: rawStatus,
    candidate_count: candidates.length,
    nearest_distance_m: nearestDistance,
    nearest_feature: nearestFeature,
    is_contained: anyContained,
    // Single-key, not the seven-category object the other two checks
    // use -- only 'road' is ever queried here. Flagged, see header.
    by_category: { road: nearestDistance },
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

// Shared by every "not applicable to this subject" branch above --
// records a real, queryable 'skipped' row rather than an ambiguous HTTP
// error, same precedent every prior Location Scout Edge Function uses.
async function recordSkipped(supabase: ReturnType<typeof createClient>, subjectId: string, reason: string) {
  const { data: skippedRow, error: skipInsertError } = await supabase
    .from('location_scout_checks')
    .insert({
      subject_id: subjectId,
      check_type: CHECK_TYPE,
      outcome: 'skipped',
      confidence: null,
      detail: { reason },
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
