import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { createClient } from '@supabase/supabase-js';

// Production hunt-loop monitor. Adapted from e2e/01-hunt-loop.spec.ts's
// proven logic (that file is untouched -- this is a separate spec) for
// the CHECKLY-MONITOR-BUSINESS/PACK fixture created by
// scripts/013_seed_production_checkly_monitor_hunt.sql on production
// (hnayygbrhrxyyfucgrus), once that script has actually been run there.
//
// Runs against the real deployed app (checkly.config.ts's
// playwrightConfig.use.baseURL = https://app.mapthemovie.co.uk), not a
// local dev server -- there is no staging-style --mode override here,
// the deployed bundle already has production's Supabase project baked
// in at build time.
//
// Reaches the puzzle screen via RESUME (mtm_hunt_progress + App.jsx's
// mount-time restoreHuntProgress()), not by clicking a discovery card.
// Confirmed this session, reading restoreHuntProgressInner() directly:
// it validates straight against hunt_sessions/campaigns and never
// touches businesses or get_active_hunts() at all -- unlike discovery,
// which now correctly excludes this business (is_test_fixture filter,
// migration 088). Session creation itself (steps below) therefore has
// to happen via direct Supabase client calls in this script, mirroring
// App.jsx's ensureAuth()/startHunt() exactly (both re-read fresh from
// source this session: ensureAuth() at App.jsx:4710-4732, startHunt()
// at App.jsx:4876-4991) -- there is no discovery-driven path left that
// could create this session through the UI.

const PUZZLE_ID = '11111111-0000-4000-8000-000000000003';
const PACK_ID = '11111111-0000-4000-8000-000000000002';
const CAMPAIGN_ID = '11111111-0000-4000-8000-000000000004';

const KNOWN_ANSWERS: Array<{ slot: string; answer: number; digit: number }> = [
  { slot: 'A', answer: 11, digit: 1 },
  { slot: 'B', answer: 22, digit: 2 },
  { slot: 'C', answer: 33, digit: 3 },
  { slot: 'D', answer: 44, digit: 4 },
];

// Same Trafalgar Square target as staging's fixture -- 013's own header
// documents this is deliberate reuse, not an oversight.
const TARGET = { latitude: 51.5080, longitude: -0.1281 };
const APPROACH_STEPS = [
  { latitude: 51.5107, longitude: -0.1281 }, // ~300m out
  { latitude: 51.5098, longitude: -0.1281 }, // ~200m out
  { latitude: 51.5089, longitude: -0.1281 }, // ~100m out
  TARGET,                                     // arrival, well within 15m geofence
];

// Production anon key -- NOT a secret, deliberately public, baked into
// every visitor's browser bundle by Vite at build time, same category
// as the URL below. Extracted this session from the live deployed
// bundle (https://app.mapthemovie.co.uk/assets/index-BRNfUG3G.js,
// re-confirmed still the currently-served filename before extracting)
// and verified via its own JWT payload -- role: "anon", ref:
// "hnayygbrhrxyyfucgrus" -- before use, not guessed or requested from
// anyone.
const SUPABASE_URL = 'https://hnayygbrhrxyyfucgrus.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhuYXl5Z2JyaHJ4eXlmdWNncnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MDU3NzksImV4cCI6MjA5NzM4MTc3OX0.eys85WIZBdvgsYiPN-fxIkDdVRFwBydkOQOiYu-lV_I';

// The exact CHECKLY-MONITOR-PACK "hunt" object get_active_hunts() would
// have returned, if it weren't now correctly excluding this business.
// Built by hand from scripts/013_seed_production_checkly_monitor_hunt.sql's
// real inserted values plus the columns 013 leaves at their schema
// default (theme_tag -> 'evergreen', accent_color -> '7C3AED', both
// confirmed via information_schema this session, not guessed) --
// because that RPC now excludes this business, it can no longer be used
// to fetch this object live, which is exactly why resume (not
// discovery) is the right path here. This becomes `activePack` /
// `saved.pack` on the resume side; restoreHuntProgressInner() only
// actually reads `.difficulty` from it (for get_puzzle_for_player's
// p_difficulty and the STARTING_TAKES lookup) but the full shape is
// reproduced anyway since activePack is stored and rendered elsewhere
// in the app, and a partial object risks an unrelated render crash.
// approx_lat/approx_lon are that RPC's own hashtext-jittered
// display-only fields (a few metres of cosmetic noise) -- not
// reproduced exactly, the real coordinates are used since nothing in
// the resume path validates or compares them to anything.
const PACK = {
  campaign_id: CAMPAIGN_ID,
  pack_id: PACK_ID,
  puzzle_id: PUZZLE_ID,
  pack_name: 'CHECKLY-MONITOR-PACK',
  pack_emoji: '🎬',
  pack_tier: 'standard',
  pack_description: 'Permanent monitoring fixture pack -- created by scripts/013_seed_production_checkly_monitor_hunt.sql. Not real content.',
  tagline: 'Permanent monitoring fixture pack',
  accent_color: '7C3AED',
  theme_tag: 'evergreen',
  genre: 'general',
  coordinate_slots: ['A', 'B', 'C', 'D'],
  masked_lat: '51.ABCD',
  masked_lon: '-0.5678',
  is_free_tier: true,
  venue_category: null as string | null,
  voucher_headline: 'MONITORING FIXTURE -- show this screen to claim your reward',
  difficulty: 'classic',
  postcode_outward: 'WC2N',
  approx_lat: TARGET.latitude,
  approx_lon: TARGET.longitude,
};

// STARTING_TAKES.classic, confirmed fresh from App.jsx this session:
// { casual: 10, classic: 10, expert: 7, cipher: 5 }.
const STARTING_TAKES_CLASSIC = 10;

test('production hunt monitor: auth, solve, approach, arrival, cleanup', async ({ page, context }) => {
  await context.route('**/sw.js', (route) => route.abort());

  // SHELF LIFE WARNING: this is production's beta access code, confirmed
  // live in the deployed bundle on 16 Aug 2026 (fetched the real JS
  // asset and grepped for the mtm_access/MAPTEST2026 pair -- not
  // assumed to match staging's value just because it happens to today).
  // It is a hardcoded client-side string (App.jsx:2427) with no server
  // validation, so it only changes on a future frontend deploy that
  // edits that line -- there is no way to predict when. If this check
  // ever starts failing specifically at the "wait for puzzle input"
  // assertion below (i.e. it never gets past the access gate), that is
  // the first thing to re-verify, not a sign the hunt/flow itself broke.
  await context.addInitScript(() => {
    localStorage.setItem('mtm_access', 'MAPTEST2026');
  });

  // Start far from the target -- checkly.config.ts sets no default
  // geolocation, so this is set explicitly before navigating rather than
  // relying on a config default the way the staging test could.
  await context.setGeolocation(APPROACH_STEPS[0]);
  await context.grantPermissions(['geolocation']);

  // ---- Steps 1-2: real auth + real session/questions, via the exact
  // same calls ensureAuth()/startHunt() make -- run here directly
  // against Supabase (not through the browser/UI), since the discovery
  // path that used to create this session via a real click no longer
  // surfaces this business at all.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ensureAuth() checks supabase.auth.getUser() first and only calls
  // signInAnonymously() if that comes back empty -- a fresh client here
  // has no existing session to find, so this always takes that branch;
  // no need to replicate the getUser() check for a client that was just
  // constructed.
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError || !authData.user) {
    throw new Error('signInAnonymously failed: ' + authError?.message);
  }
  const userId = authData.user.id;

  // Root cause of the earlier resume failure: this signInAnonymously() call
  // only ever authenticated THIS Node-side `supabase` client -- its session
  // never reached the actual browser Playwright drives, so the browser
  // loaded unauthenticated and restoreHuntProgressInner()'s hunt_sessions
  // lookup ran as anon, which RLS's ownership check (auth.uid() = user_id)
  // correctly filtered to 0 rows regardless of the row's real status.
  // authData.session (not just authData.user) is what needs to be seeded
  // into the browser below -- confirmed present on the real AuthResponse
  // shape (@supabase/auth-js's `{ user, session }`, both nullable) before
  // relying on it here, so this throws clearly instead of silently seeding
  // `undefined` if a future auth change ever omits it.
  const authSession = authData.session;
  if (!authSession) {
    throw new Error('signInAnonymously returned no session');
  }

  // ensureAuth()'s profiles upsert (App.jsx:4723-4726), same shape.
  const { error: profileError } = await supabase.from('profiles').upsert(
    { id: userId },
    { onConflict: 'id' }
  );
  if (profileError) {
    // Non-fatal in the real app too -- it only console.error's there.
    console.error('profiles upsert failed', profileError);
  }

  // startHunt()'s hunt_sessions insert (App.jsx:4888-4898), same
  // columns/values a real call would use. start_lat/start_lon null:
  // in the real app userPos is still null at this exact point too --
  // getUserPos() is fired on click but not awaited before the insert.
  const { data: session, error: sessionError } = await supabase
    .from('hunt_sessions')
    .insert({
      user_id: userId,
      puzzle_id: PUZZLE_ID,
      start_lat: null,
      start_lon: null,
      signal_points: STARTING_TAKES_CLASSIC,
    })
    .select()
    .single();
  if (sessionError || !session) {
    throw new Error('hunt_sessions insert failed: ' + sessionError?.message);
  }
  const sessionId: string = session.id;

  // startHunt()'s get_puzzle_for_player call (App.jsx:4903-4908).
  // p_exclude_ids: [] -- getSeenQuestionIds() reads a per-user
  // localStorage cache that cannot exist yet for this brand-new
  // anonymous user, so a real call would pass an empty array here too.
  // The response itself isn't needed in this script:
  // restoreHuntProgressInner() calls get_puzzle_for_player again on its
  // own once resumed, exactly as it does for a real interrupted-session
  // resume -- this call's only job here is to match startHunt()'s real
  // sequence and confirm the RPC succeeds against this session/puzzle
  // before handing off to the resume path.
  const { error: puzzleError } = await supabase.rpc('get_puzzle_for_player', {
    p_session_id: sessionId,
    p_exclude_ids: [],
    p_difficulty: PACK.difficulty,
  });
  if (puzzleError) {
    throw new Error('get_puzzle_for_player failed: ' + puzzleError.message);
  }

  // ---- Step 3-4: seed mtm_hunt_progress in the exact shape confirmed
  // this session (App.jsx:4571-4584), using real values from steps 1-2
  // above, not placeholders -- plus the Supabase auth session itself,
  // under the exact key/shape @supabase/auth-js's GoTrueClient._saveSession()
  // really writes (confirmed this session from the installed package's own
  // source, not assumed):
  //   - key: `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`
  //     -> 'sb-hnayygbrhrxyyfucgrus-auth-token' for this project, since
  //     lib/supabase.js passes no storageKey override.
  //   - value: JSON.stringify(session) of the FULL session object (no
  //     userStorage is configured, so GoTrueClient doesn't strip `user`
  //     out into a separate key) -- authSession from above is exactly
  //     that object, unmodified.
  // Without this, the browser's own Supabase client mounts unauthenticated
  // and never discovers the session created above.
  await context.addInitScript(
    ({ sessionId, campaignId, pack, startingTakes, authSession }) => {
      localStorage.setItem('sb-hnayygbrhrxyyfucgrus-auth-token', JSON.stringify(authSession));
      localStorage.setItem('mtm_hunt_progress', JSON.stringify({
        session_id: sessionId,
        campaign_id: campaignId,
        pack,
        solved: {},
        signalPoints: startingTakes,
        waypointsMode: false,
        waypoints: [],
        totalWaypoints: 0,
        waypointPhase: 0,
        compassTarget: null,
        screen: 'puzzles',
        savedAt: Date.now(),
      }));
    },
    { sessionId, campaignId: CAMPAIGN_ID, pack: PACK, startingTakes: STARTING_TAKES_CLASSIC, authSession }
  );

  // ---- Step 5: load / and let the app's own mount-time
  // restoreHuntProgress() (App.jsx:4596) pick this up and land on the
  // puzzle screen directly -- reached via resume, not a card click.
  await page.goto('/');

  // Single pg connection, reused for the cleanup deletes below, closed
  // once in `finally`. CHECKLY_MONITOR_DB_URL is RLS-scoped to only
  // this monitor's fixed campaign_id/puzzle_id rows.
  const pgClient = new Client({ connectionString: process.env.CHECKLY_MONITOR_DB_URL });
  await pgClient.connect();

  try {
    // sessionId/userId are already known directly from steps 1-2 above
    // -- no DB lookup needed to identify them the way a discovery-card
    // click (with no visibility into what the browser just created)
    // would have required.
    const firstInput = page.locator('.puzzle-input').first();
    await expect(firstInput).toBeVisible({ timeout: 15_000 });

    for (const { slot, answer, digit } of KNOWN_ANSWERS) {
      const input = page.locator('.puzzle-input').first();
      await expect(input).toBeVisible({ timeout: 15_000 });
      await input.fill(String(answer));
      await page.locator('.puzzle-submit').first().click();

      const badge = page.locator('.puzzle-solved-badge', { hasText: `Digit ${slot} = ${digit}` });
      await expect(badge).toBeVisible({ timeout: 10_000 });
    }

    // All four solved -- app calls unlock_coordinates and transitions to
    // the compass screen after a ~600ms delay (App.jsx), same as
    // 01-hunt-loop.spec.ts's already-proven flow.
    await expect(page.locator('.puzzle-input')).toHaveCount(0, { timeout: 10_000 });
    await page.waitForTimeout(1000);

    // Approach trail -- one setGeolocation per step, waited out past the
    // app's 5-second getCurrentPosition poll interval so each step is
    // actually observed, not skipped.
    for (const point of APPROACH_STEPS.slice(1)) {
      await context.setGeolocation(point);
      await page.waitForTimeout(6000);
    }

    const revealCode = page.locator('.reveal-code');
    await expect(revealCode).toBeVisible({ timeout: 20_000 });
    const codeText = (await revealCode.innerText()).trim();
    expect(codeText).not.toBe('---');
    expect(codeText.length).toBeGreaterThan(0);
  } finally {
    // Cleanup ALWAYS attempts to run, even if an assertion above threw
    // -- a failed check must not also leave orphaned rows on production.
    try {
      const redemptionLookup = await pgClient.query(
        `SELECT id FROM redemptions WHERE session_id = $1`,
        [sessionId]
      );
      for (const row of redemptionLookup.rows) {
        await pgClient.query('DELETE FROM redemptions WHERE id = $1', [row.id]);
      }
      await pgClient.query('DELETE FROM hunt_sessions WHERE id = $1', [sessionId]);
    } finally {
      await pgClient.end();
    }

    const supabaseAdmin = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    // Cascades to delete the profiles row automatically -- confirmed
    // this session via pg_constraint on staging: profiles_id_fkey has
    // confdeltype = 'c' (CASCADE) against auth.users(id). profiles
    // never needs separate handling here.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      // Don't throw from cleanup -- surface it, but a cleanup failure
      // shouldn't mask whether the actual hunt-loop check passed.
      console.error('Cleanup: failed to delete anonymous auth user', userId, error);
    }
  }
});
