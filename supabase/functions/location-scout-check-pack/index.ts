// supabase/functions/location-scout-check-pack/index.ts
//
// Location Scout Phase 2: run every check against every subject for one
// pack_id in one call, so Command Center's Build Hunt save can surface
// real warnings instead of requiring a manual per-subject paste into the
// Location Scout diagnostic panel.
//
// Deploy: via CI only (.github/workflows/deploy-edge-functions.yml). That
// workflow deploys one named step per function -- a NEW step must be
// added for location-scout-check-pack, exactly the same trap the file's
// own comment warns about for every function before this one. Not added
// here; this file is not being deployed yet.
//
// Auth: byte-identical to location-scout-streetview-check and
// location-scout-osm-hazard-check, confirmed by re-reading both in full
// rather than from memory -- service-role client, getUser(token) against
// the caller's own bearer token, then a direct platform_admins row read.
// NOT is_platform_admin() -- same reason as the other two: it reads
// auth.uid(), which is NULL under a service-role client, so it would
// reject every caller. Called from CommandCenter.jsx via
// supabase.functions.invoke, which attaches the admin's own session
// automatically -- same mechanism the Location Scout diagnostic panel
// already relies on.
//
// NO NEW RPC, NO NEW MIGRATION. location_scout_subjects is queried
// directly through this function's own service-role client -- confirmed
// this session that service_role bypasses RLS on that table by default
// (migration 056 revokes anon/authenticated only; nothing grants or
// blocks service_role), the same assumption the two existing check
// functions and get_location_scout_subject_point already depend on.
//
// CALLING THE TWO EXISTING FUNCTIONS: real HTTP, not a shared import --
// confirmed this session that supabase/functions/ has no _shared
// directory and no precedent anywhere of one function importing another;
// location-scout-streetview-check's own header explains why a five-line
// Haversine helper was inlined rather than factored out ("A five-line
// formula does not justify a new shared module"). Following that
// precedent rather than introducing a new pattern.
//
// The credential forwarded on those HTTP calls is the SAME Authorization
// header this function itself received -- not the service-role key. Both
// target functions authenticate via getUser(token) against a real
// platform_admins-linked user, which the service-role key is not (it has
// no corresponding auth.users row, so getUser() on it returns no user and
// the call would be rejected with 401, same failure a stray anon caller
// would hit). No supabase/config.toml exists in this repo and the CI
// deploy workflow never passes --no-verify-jwt, so the platform gateway
// itself also requires a valid JWT on every call -- forwarding the
// caller's own already-gateway-verified token satisfies that too.
//
// mapWithConcurrency is copied verbatim from generate-trivia-question/
// index.ts (its own comment there: "no external dependency -- a simple
// worker-pool"), not imported -- there is no mechanism to import it, and
// this project's own established convention (see the Haversine note
// above) is to duplicate a small, self-contained, dependency-free
// utility rather than build shared-module infrastructure for it. Same
// concurrency bound (5) as that file's VERIFICATION_CONCURRENCY.
//
// EXCEPTION SAFETY, same non-negotiable principle as migration 075's
// triggers, applied here because Overpass has already proven it can fail
// mid-session tonight: every individual check call is wrapped so it can
// only ever resolve to a tagged { ok: true/false } result, never throw
// out of mapWithConcurrency's worker loop. One subject's Street View call
// timing out, or one Overpass request failing, does not stop any other
// call and does not take down the response.
//
// RESPONSE SHAPE: one summary object -- subjects_checked, warnings (every
// result whose outcome was 'flag' or 'block', each with subject_id,
// subject_type, check_type, outcome, a one-sentence human reason, and the
// specific detail fields that reason was built from), and call_failures
// (any individual HTTP call that itself failed -- kept visible rather
// than silently absorbed, since the whole point of the exception
// wrapping above is resilience, not disappearance). This function does
// not insert into location_scout_checks itself -- the two functions it
// calls already do that; this only relays and summarises their results.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The two existing point-based checks. If a third check function is ever
// added (e.g. osm_corridor_intersect for line-type subjects), it goes
// here and nowhere else in this file needs to change.
const CHECK_FUNCTIONS: Array<{ fnName: string; checkType: string }> = [
  { fnName: 'location-scout-streetview-check', checkType: 'streetview_metadata' },
  { fnName: 'location-scout-osm-hazard-check', checkType: 'osm_hazard_proximity' },
];

const CHECK_CONCURRENCY = 5;

function jsonResponse(payload: unknown, status?: number) {
  return new Response(JSON.stringify(payload), {
    ...(status ? { status } : {}),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Copied verbatim from generate-trivia-question/index.ts -- see this
// file's header for why this is a copy, not an import.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

type Subject = {
  id: string;
  subject_type: string;
};

type CheckTask = {
  subject: Subject;
  fnName: string;
  checkType: string;
};

type CheckTaskResult =
  | {
      ok: true;
      subjectId: string;
      subjectType: string;
      checkType: string;
      outcome: string;
      detail: Record<string, unknown> | null;
    }
  | {
      ok: false;
      subjectId: string;
      subjectType: string;
      checkType: string;
      error: string;
    };

// One sentence explaining WHY a flag/block outcome happened, built from
// the specific fields each check_type's own detail blob is known to
// carry (confirmed by re-reading both functions' detail objects, not
// guessed at). Falls back to something honest, never throws on a
// malformed/unexpected detail shape.
function describeOutcome(checkType: string, outcome: string, detail: Record<string, unknown> | null): {
  reason: string;
  relevantDetail: Record<string, unknown>;
} {
  if (!detail) {
    return { reason: `${checkType} came back ${outcome} with no detail payload.`, relevantDetail: {} };
  }

  if (checkType === 'streetview_metadata') {
    const distanceM = typeof detail.distance_m === 'number' ? detail.distance_m : null;
    const rawStatus = typeof detail.raw_status === 'string' ? detail.raw_status : 'UNKNOWN';
    const relevantDetail = { distance_m: distanceM, raw_status: rawStatus };
    if (distanceM !== null) {
      return {
        reason: `Nearest Street View panorama is ${Math.round(distanceM)}m from this point (status ${rawStatus}).`,
        relevantDetail,
      };
    }
    return {
      reason: `No usable Street View coverage near this point (status ${rawStatus}).`,
      relevantDetail,
    };
  }

  if (checkType === 'osm_hazard_proximity') {
    const nearestFeature = detail.nearest_feature as
      | { category?: string; tags?: Record<string, string>; osm_id?: number }
      | null
      | undefined;
    const nearestDistanceM = typeof detail.nearest_distance_m === 'number' ? detail.nearest_distance_m : null;
    const isContained = detail.is_contained === true;
    const category = nearestFeature?.category ?? 'hazard';
    const name = nearestFeature?.tags?.name;
    const label = name ? `"${name}" (${category})` : category;
    const relevantDetail = {
      nearest_distance_m: nearestDistanceM,
      is_contained: isContained,
      nearest_feature: nearestFeature ?? null,
    };
    if (isContained) {
      return { reason: `Point falls inside a ${label} feature.`, relevantDetail };
    }
    if (nearestDistanceM !== null) {
      return { reason: `Nearest ${label} feature is ${Math.round(nearestDistanceM)}m away.`, relevantDetail };
    }
    return { reason: `${label} feature found nearby; distance unknown.`, relevantDetail };
  }

  // Unknown check_type -- forward-compatible with a future check this
  // function does not yet know about, rather than throwing.
  return { reason: `${checkType} came back ${outcome}.`, relevantDetail: detail };
}

// Runs one check call against one subject. NEVER throws -- every failure
// mode (network error, non-2xx, non-JSON body) resolves to a tagged
// { ok: false } result instead, which is what lets mapWithConcurrency's
// worker loop keep going past one bad call.
async function runOneCheck(task: CheckTask, authHeader: string): Promise<CheckTaskResult> {
  const { subject, fnName, checkType } = task;
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({ subject_id: subject.id }),
    });

    let body: any = null;
    try {
      body = await res.json();
    } catch (parseErr) {
      return {
        ok: false,
        subjectId: subject.id,
        subjectType: subject.subject_type,
        checkType,
        error: `non-JSON response from ${fnName} (HTTP ${res.status}): ${
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        }`,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        subjectId: subject.id,
        subjectType: subject.subject_type,
        checkType,
        error: `${fnName} returned HTTP ${res.status}: ${body?.error ?? JSON.stringify(body)}`,
      };
    }

    // body is the inserted location_scout_checks row on success (or the
    // skipped/error row -- both functions insert and return those too).
    const outcome = typeof body?.outcome === 'string' ? body.outcome : 'unknown';
    const detail = (body?.detail ?? null) as Record<string, unknown> | null;

    return {
      ok: true,
      subjectId: subject.id,
      subjectType: subject.subject_type,
      checkType,
      outcome,
      detail,
    };
  } catch (err) {
    return {
      ok: false,
      subjectId: subject.id,
      subjectType: subject.subject_type,
      checkType,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
  const { pack_id } = body;

  if (!pack_id || typeof pack_id !== 'string') {
    return jsonResponse({ error: 'pack_id is required' }, 400);
  }

  // location_scout_subjects joined to puzzles on puzzle_id = puzzles.id,
  // filtered to this pack_id and active subjects only. !inner turns the
  // embed into an actual filtering join -- without it, .eq('puzzles.pack_id', ...)
  // does not restrict the top-level rows the way a plain SQL INNER JOIN
  // WHERE clause would. No RLS concern: this runs on the service-role
  // client, which bypasses RLS on location_scout_subjects the same way
  // the two check functions and get_location_scout_subject_point already
  // rely on (confirmed this session -- migration 056 revokes anon/
  // authenticated only, nothing touches service_role).
  const { data: subjectRows, error: subjectsError } = await supabase
    .from('location_scout_subjects')
    .select('id, subject_type, puzzles!inner(pack_id)')
    .eq('is_active', true)
    .eq('puzzles.pack_id', pack_id);

  if (subjectsError) {
    return jsonResponse(
      { error: 'Failed to query location_scout_subjects', detail: subjectsError.message },
      502
    );
  }

  const subjects: Subject[] = (subjectRows ?? []).map((row: any) => ({
    id: row.id,
    subject_type: row.subject_type,
  }));

  const tasks: CheckTask[] = [];
  for (const subject of subjects) {
    for (const { fnName, checkType } of CHECK_FUNCTIONS) {
      tasks.push({ subject, fnName, checkType });
    }
  }

  const results = await mapWithConcurrency(tasks, CHECK_CONCURRENCY, (task) =>
    runOneCheck(task, authHeader)
  );

  const warnings: Array<{
    subject_id: string;
    subject_type: string;
    check_type: string;
    outcome: string;
    reason: string;
    detail: Record<string, unknown>;
  }> = [];

  const callFailures: Array<{
    subject_id: string;
    subject_type: string;
    check_type: string;
    error: string;
  }> = [];

  for (const result of results) {
    if (!result.ok) {
      callFailures.push({
        subject_id: result.subjectId,
        subject_type: result.subjectType,
        check_type: result.checkType,
        error: result.error,
      });
      continue;
    }

    if (result.outcome === 'flag' || result.outcome === 'block') {
      const { reason, relevantDetail } = describeOutcome(result.checkType, result.outcome, result.detail);
      warnings.push({
        subject_id: result.subjectId,
        subject_type: result.subjectType,
        check_type: result.checkType,
        outcome: result.outcome,
        reason,
        detail: relevantDetail,
      });
    }
  }

  return jsonResponse({
    pack_id,
    subjects_checked: subjects.length,
    checks_run: tasks.length,
    warnings,
    call_failures: callFailures,
  });
});
