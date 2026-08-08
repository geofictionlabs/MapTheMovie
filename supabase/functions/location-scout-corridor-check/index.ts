// supabase/functions/location-scout-corridor-check/index.ts
//
// Location Scout: osm_corridor_intersect. Checks a walked ROUTE (a
// corridor_segment subject -- the LineString between two adjacent fixed
// points: waypoint N to waypoint N+1, or the last waypoint to the
// destination) against the same hazard categories
// location-scout-osm-hazard-check already checks for a single point.
// approach_sweep is explicitly OUT OF SCOPE for this function -- it is
// skipped, not processed, same as this function's own line types are
// skipped by the point-based function it mirrors.
//
// Deploy: via CI only (.github/workflows/deploy-edge-functions.yml). NO
// step exists yet for location-scout-corridor-check -- a new one must
// be added, exactly the trap every earlier function's header in this
// project warns about. Not added here; this file is not being deployed
// until that step exists.
//
// No API key: Overpass is public and unauthenticated, same as
// location-scout-osm-hazard-check.
//
// Auth: byte-identical to the other three Location Scout Edge
// Functions, confirmed by re-reading location-scout-osm-hazard-check in
// full this session, not from memory -- service-role client,
// getUser(token) against the caller's own bearer token, then a direct
// platform_admins row read. NOT is_platform_admin() -- same reason as
// the other three: it reads auth.uid(), which is NULL under a
// service-role client, so it would reject every caller.
//
// Subject resolution uses get_location_scout_subject_line (migration
// 077), a NEW companion RPC -- NOT get_location_scout_subject_point
// (073), which explicitly returns NULL for any non-Point geometry.
// That guard is the whole reason 073 cannot be reused here; a
// genuinely different extraction path was required, not an oversight.
//
// Candidate hazard check uses check_line_against_geojson (migration
// 078), a NEW companion RPC -- NOT check_point_against_geojson (074),
// which hardcodes its first argument as ST_MakePoint(p_lon, p_lat) and
// structurally cannot accept a line. See 078's header for the full
// reasoning, including a REAL, DELIBERATE semantic difference: 078's
// is_contained means "the corridor crosses/enters this candidate"
// (ST_Intersects), not "is fully inside it" (074's ST_Covers, which
// only ever means something for a point against a polygon). Same field
// name, different meaning -- read 078's header before changing either
// function to assume they match.
//
// OVERPASS QUERY: buildOverpassQuery here takes the corridor's full
// vertex list, not a single lat/lon. Overpass QL's `around` filter
// accepts a flat list of coordinates (more than one lat,lon pair) as a
// polyline and finds elements within radius of the WHOLE line, not just
// each vertex independently -- this is real, existing Overpass
// functionality being reused, not a new invention.
//
// CONTAINMENT-WIDENING LIMITATION, FLAGGED, NOT SILENT: the point-based
// function also runs is_in(lat,lon)->.pivotPoint to catch a hazard
// polygon so large that its own edges sit outside the search radius
// even though the point is deep inside it (see that function's own
// header for why). Overpass's is_in() only accepts ONE point -- there
// is no line equivalent. This function runs is_in() at the corridor's
// two ENDPOINTS only, not a dense sample along its length. A large
// polygon hazard that the corridor cuts through the MIDDLE of, without
// either endpoint inside it AND with the polygon's own edges more than
// OVERPASS_RADIUS_M from every point on the line, would not be
// discovered as a candidate at all. Named limitation, matching this
// project's own established pattern of recording what a check cannot
// see (relations_skipped, malformed_ways_skipped,
// postgis_errors_skipped in the point-based function) rather than
// silently building disproportionate new sampling machinery to close
// every gap.
//
// EVERYTHING ELSE BELOW IS A DIRECT, UNCHANGED REUSE of
// location-scout-osm-hazard-check: OVERPASS_URL, OVERPASS_RADIUS_M,
// BLOCK_DISTANCE_M (10m) / FLAG_DISTANCE_M (30m) thresholds,
// categoriseWay, AREA_CATEGORIES, the relations/malformed-ways/
// postgis-errors skip-and-record pattern, and the outcome decision
// tree (zero-successful-candidates -> error; any block-band or
// is_contained -> block; any flag-band -> flag; else pass). None of
// these needed to change for the geometry difference, so none were
// changed -- reused verbatim per this session's own instruction not to
// invent new numbers.
//
// DETAIL FIELD NAMES: nearest_feature, nearest_distance_m, is_contained,
// raw_status, candidate_count, by_category, relations_skipped,
// malformed_ways_skipped, postgis_errors_skipped, zero_successful_
// candidates, overpass_data_timestamp, search_radius_m are ALL the same
// field names the point-based function writes, so ScoutResultsTab's
// existing per-field rendering could extend to osm_corridor_intersect
// rows with minimal change. ONE FIELD NAME GENUINELY DIFFERS, FLAGGED:
// requested_lat/requested_lon (a single point) has no line equivalent --
// this function writes subject_coordinates (the corridor's own
// [lon,lat] vertex array) in their place. ScoutResultsTab's
// scoutFindingDetailText (CommandCenter.jsx) does not yet branch on
// check_type === 'osm_corridor_intersect' -- until it does, a corridor
// finding renders via that function's raw-JSON fallback, not a
// formatted sentence. Not fixed here -- out of scope for this function,
// flagged as a real follow-up.
//
// EXCEPTION SAFETY: same non-negotiable principle as every Location
// Scout piece tonight -- every Overpass call and every per-candidate RPC
// call is wrapped so a single failure resolves to a tagged, honest
// outcome and is recorded, never thrown unhandled.
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

const CODE_VERSION = 'osm-corridor-v1';
const CHECK_TYPE = 'osm_corridor_intersect';

// Only corridor_segment is handled. approach_sweep is a real, allowed
// subject_type (migration 056's CHECK constraint) but explicitly out of
// scope for this build -- skipped, not processed, same as this
// function's own line types are skipped by the point-based function.
const OUT_OF_SCOPE_SUBJECT_TYPES = ['approach_sweep'];
const HANDLED_SUBJECT_TYPE = 'corridor_segment';

// Unchanged from location-scout-osm-hazard-check.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_RADIUS_M = 100;
const BLOCK_DISTANCE_M = 10;
const FLAG_DISTANCE_M = 30;

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// natural=water and natural=wetland are treated as areas. Everything else is
// linear -- unchanged from location-scout-osm-hazard-check.
const AREA_CATEGORIES = ['water', 'wetland'];

// Unchanged from location-scout-osm-hazard-check.
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

// Corridor version of buildOverpassQuery -- takes the subject's full
// vertex list (GeoJSON [lon, lat] pairs) instead of one lat/lon. See
// this file's header for the `around` polyline and is_in()-at-endpoints
// reasoning; neither is invented here, both are explained above.
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
    'get_location_scout_subject_line',
    { p_subject_id: subject_id }
  );

  if (subjectError) {
    return jsonResponse(
      {
        error: 'Failed to resolve subject line',
        detail: subjectError.message,
        hint: 'If this reads "function does not exist", migration 077 has not been run yet.',
      },
      502
    );
  }

  const subject = Array.isArray(subjectRows) ? subjectRows[0] : subjectRows;
  if (!subject) {
    return jsonResponse({ error: 'Subject not found or inactive', subject_id }, 404);
  }

  const subjectType = subject.subject_type;

  // approach_sweep: real subject_type, explicitly out of scope for this
  // build. Skipped, not processed -- same pattern the point-based
  // function uses for both line types.
  if (OUT_OF_SCOPE_SUBJECT_TYPES.includes(subjectType)) {
    return await recordSkipped(
      supabase,
      subject_id,
      `${subjectType} subject_type is out of scope for location-scout-corridor-check -- only ${HANDLED_SUBJECT_TYPE} is currently handled.`
    );
  }

  // Any other non-corridor subject_type (destination_point, waypoint_point,
  // business_premises, or anything future) -- the inverse of the point-based
  // function's own line-type skip.
  if (subjectType !== HANDLED_SUBJECT_TYPE) {
    return await recordSkipped(
      supabase,
      subject_id,
      `${subjectType} is a point-type subject, line-based corridor check not applicable -- see location-scout-osm-hazard-check for point checks.`
    );
  }

  // Claims corridor_segment but the stored geometry is not genuinely a
  // LineString -- get_location_scout_subject_line's own defensive guard
  // fired (migration 077, mirroring 073's ST_GeometryType guard). Same
  // "skipped, not a thrown error" precedent 073's header documents.
  if (!subject.geojson || !Array.isArray(subject.geojson.coordinates)) {
    return await recordSkipped(
      supabase,
      subject_id,
      'corridor_segment subject has no resolvable LineString geometry (geom column is not a LineString) -- data integrity issue, not evaluated.'
    );
  }

  const lineCoords: number[][] = subject.geojson.coordinates;

  if (lineCoords.length < 2) {
    return await recordSkipped(
      supabase,
      subject_id,
      `corridor_segment subject's LineString has too few vertices (${lineCoords.length}) to check.`
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
      body: buildOverpassQuery(lineCoords),
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
    return jsonResponse(errorRow);
  }

  // ── Split elements ──────────────────────────────────────────────────
  // Unchanged from location-scout-osm-hazard-check -- candidate
  // construction from Overpass elements does not depend on whether the
  // subject is a point or a line.
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

  // ── Test each candidate ─────────────────────────────────────────────
  // check_line_against_geojson (migration 078), NOT
  // check_point_against_geojson -- see this file's header for why is_contained
  // means something genuinely different here (crosses/enters, not is-inside).
  let anyContained = false;
  let nearestDistance: number | null = null;
  let nearestFeature: Record<string, unknown> | null = null;
  const byCategory: Record<string, number | null> = {
    water: null, coastline: null, rail: null, road: null, cliff: null, embankment: null, wetland: null,
  };

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
  // Unchanged decision tree and thresholds from location-scout-osm-hazard-check.
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
    // subject_coordinates replaces requested_lat/requested_lon -- a
    // corridor has no single point to report. Flagged field-name
    // difference, see this file's header.
    subject_coordinates: lineCoords,
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
// error, same precedent location-scout-osm-hazard-check's own
// LINE_SUBJECT_TYPES guard set.
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
