# MapTheMovie — Claude Code Context

## Project

**MapTheMovie** by GeoFiction Labs. Pop-culture geocaching puzzle app.
Players solve movie trivia to unmask GPS coordinates, walk to the hidden
destination, and claim a reward on arrival.

## Live URLs

| URL | Purpose |
|-----|---------|
| `mapthemovie.co.uk` | Marketing landing page |
| `app.mapthemovie.co.uk` | Player app (this repo) |

## Tech Stack

- **Frontend:** React 19 + Vite 8 SPA (PWA)
- **Backend:** Supabase (PostgreSQL + PostgREST + Supabase Auth)
- **Database extras:** PostGIS for geofence / GPS validation
- **Hosting:** Vercel — SPA rewrite + outputDirectory in `vercel.json`
- **Maps:** Leaflet.js
- **Payments:** Stripe — not yet integrated

## Repository Layout

```
mapthemovie-app/          <- this repo (GitHub: geofictionlabs/MapTheMovie)
  src/
    App.jsx               - player-facing app (~1700 lines, state-based nav)
    Dashboard.jsx         - business portal (~1200 lines)
    main.jsx              - entry point: ErrorBoundary + path routing
    ErrorBoundary.jsx     - standalone error boundary component
    index.css             - global reset (dark background forced here)
    lib/supabase.js       - Supabase client (pure ASCII + non-ASCII strip)
  public/
    sw.js                 - service worker: push notifications + asset cache
    privacy.html          - Privacy Policy
    terms.html            - Terms of Service
    favicon.svg
    icons.svg
  index.html              - pre-React dark bg inline style
  vercel.json             - buildCommand, outputDirectory=dist, SPA rewrite
  vite.config.js          - Vite config with process.env define + charset utf8

../mapthemovie/           <- sibling folder (schema + migrations)
  MapTheMovie_Schema.sql  - full schema: 10 tables, 8 RPC functions, RLS
  migrations/
    001_comic_con.sql     - live session, voucher, push tables + RPCs
    002_seed_data.sql     - seed data (generic, no event/location names)
    003_functions_only.sql - corrected get_active_hunts (starts_at/ends_at)
```

## SECURITY — HIGH PRIORITY, UNFIXED

- **`puzzles.real_lat`/`real_lon` are directly readable via the anon key.**
  `puzzles_select_active` RLS policy is `FOR SELECT USING (is_active = TRUE)` —
  a full-row policy with no column restriction. The schema comment even
  documents the assumption: "RLS allows reading the full row; the RPC
  controls which columns are returned" — but nothing stops a client from
  calling `.from('puzzles').select('real_lat,real_lon')` directly via the
  anon key and reading the real destination before solving anything,
  bypassing the entire trivia mechanic. Violates the project's hard rule
  that real coordinates are never client-accessible before solving.
  **Not fixed as of this entry — next security item after tonight's
  waypoints work.** Likely fix: move `real_lat`/`real_lon` (and
  `real_location`) to a locked side table with no RLS policies (same
  pattern as `trivia_variables`/`puzzle_waypoints`), or revoke column-level
  SELECT and force all reads through existing RPCs.

- **`get_puzzle_waypoints` is callable via the anon key despite being
  revoked from it.** Migration `014_real_multistop_waypoints.sql` runs
  `REVOKE ALL ON FUNCTION get_puzzle_waypoints(uuid) FROM PUBLIC` then
  `GRANT EXECUTE ... TO authenticated` — intended to restrict the RPC to
  signed-in (including anonymous-auth) sessions only. Verified live
  against the production Supabase project: calling it with the anon key
  and no session returns the function's own `{"success": false, "error":
  "Session not found"}` response (HTTP 200), not a permission-denied
  error — meaning the anon role can still execute it. Likely cause:
  Supabase grants `EXECUTE` to `anon`/`authenticated` directly (not via
  the `PUBLIC` pseudo-role) at function-creation time, so `REVOKE ALL ...
  FROM PUBLIC` doesn't touch that grant. The RPC itself is SECURITY
  DEFINER and still requires a valid, owned `hunt_sessions` row to return
  real coordinates, so this isn't currently exploitable the same way the
  `real_lat`/`real_lon` issue above is — but the intended access
  restriction is silently not enforced. **Not fixed as of this entry.**
  Same category as the `real_lat`/`real_lon` issue — treat both as one
  combined security pass rather than fixing piecemeal; likely fix is an
  explicit `REVOKE EXECUTE ... FROM anon` (and audit other RPCs created
  the same way for the same gap).

## Supabase

- **Project URL:** `https://hnayygbrhrxyyfucgrus.supabase.co`
- **Dashboard:** `https://supabase.com/dashboard/project/hnayygbrhrxyyfucgrus`
- **Anonymous sign-ins:** ENABLED (required — players auth anonymously on PLAY)
- **Key RPCs:** `get_active_hunts`, `get_puzzle_for_player`, `validate_answer`,
  `unlock_coordinates`, `confirm_arrival`, `go_live`, `get_my_business`,
  `get_business_dashboard`
- Full RLS on all tables — trivia answers never exposed to client
- `validate_answer` receives the FULL answer (e.g. 88), compares against
  `correct_answer`, extracts `coordinate_digit` server-side

## Vercel

- Project: `geofictionlans/mapthemovie-app`
- Deploy: `npx vercel --prod` from `mapthemovie-app/`
- Env vars set in Vercel production (NOT just .env — .env is gitignored):
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- `.env` is gitignored — env vars must be in Vercel dashboard or set via
  `vercel env add` CLI

## Brand Colours — Hardcoded Hex Only

| Token | Hex |
|-------|-----|
| Background | `#121218` |
| Surface | `#1C1C26` |
| Border | `#32324A` |
| Purple | `#7C3AED` |
| Purple light | `#9D5FF5` |
| Gold | `#F59E0B` |
| Gold light | `#FCD34D` |
| Green | `#10B981` |
| Text | `#F1F0FF` |
| Subtext | `#B8B4D8` |
| Muted | `#6B67A0` |

## Critical Rules

- **NEVER use `var(--anything)` in CSS** — hardcoded hex only
- **NEVER reference** Comic Con, Folkestone, Harbour Arm, specific events/dates
- **`supabase.js` must be pure ASCII** — non-ISO-8859-1 chars in that file
  cause `TypeError: Failed to execute 'set' on 'Headers'`
- **Always add** `style={{ background: '#121218', minHeight: '100vh', color: '#F1F0FF' }}`
  on the outermost div of every root component
- **Progressive waypoints stay** — trivia → GPS → arrive → voucher is core product
- **Simple state-based navigation** — no React Router
- **Puzzle input:** no `max` attribute, no `.slice(-1)` — players type the FULL
  answer (e.g. 88), RPC extracts the coordinate digit server-side

## Service Worker Notes

- `public/sw.js` cache name is `mtm-v3` — bump version whenever deploying
  changes that need cache invalidation on existing devices
- HTML navigation requests use **network-first** (always fetches fresh index.html)
- `/assets/` uses **cache-first** (content-hashed, safe to cache forever)
- Old cache names are purged on SW activate

## Navigation Model

`main.jsx` checks `window.location.pathname`:
- Starts with `/dashboard` → renders `<Dashboard />`
- Everything else → renders `<App />`

Within `<App />` all screen transitions are state-driven. No client-side router.

## Game Flow (Player)

1. Home — list of active hunts from `get_active_hunts()` RPC
2. Tap PLAY — anonymous auth via `supabase.auth.signInAnonymously()`
3. `hunt_sessions` row inserted, `get_puzzle_for_player` RPC fetches questions
4. Trivia — player types FULL answer, `validate_answer` RPC checks it and
   extracts coordinate digit (e.g. answer=88, coordinate_digit=8)
5. All slots solved → `unlock_coordinates` RPC returns real lat/lon
6. GPS compass — player walks to location
7. `confirm_arrival` RPC validates PostGIS geofence → issues voucher
8. Arrived screen shows voucher code

## PuzzleCard Data Fields

Each question object from `get_puzzle_for_player` has:
- `slot` — coordinate slot identifier (A, B, C, D...)
- `question_text` — the trivia question
- `movie_title`, `movie_year`, `movie_emoji` — movie context displayed as badge
- `category` — legacy field, shown below movie badge if present
- `hint_text` — optional hint behind toggle

## Dashboard (Business)

- Auth: magic link email → `supabase.auth.signInWithOtp`
- Go Live: `go_live` RPC captures GPS, creates `live_business_sessions` row
- Real-time: Supabase Realtime channel on `redemptions` INSERT → push notification
- Tabs: Overview, Vouchers, Themes, History, Settings

## Current Status (as of 2026-06-20)

**Working end-to-end:**
- App loads with dark background on all devices
- Hunt list loads from `get_active_hunts` RPC
- Anonymous auth on PLAY
- Trivia questions display with movie context badge on all slots
- Full numeric answers submitted to `validate_answer` RPC
- Coordinate slots fill in as questions solved
- GPS compass activates after all slots solved
- Business dashboard: Go Live, real-time redemption alerts

**Next priorities:**
1. Complete full arrival + voucher flow test
2. Go Live Lock for mobile businesses (Dashboard)
3. Nearby hunts discovery map
4. Legal documents review
5. Stripe subscriptions

## Known Follow-ups

- **Cache `get_puzzle_for_player`'s question set on `hunt_sessions`**, mirroring
  how `unlock_coordinates` caches `session_dest_lat`/`session_dest_lon` per
  session (`migrations/004_question_variety.sql`). Right now the RPC does
  `ORDER BY RANDOM()` on every call, so anything that re-fetches puzzle
  questions mid-hunt (e.g. `restoreHuntProgress` in `App.jsx`, after a phone
  call / backgrounded app / closed browser) may show different trivia for
  unsolved slots than the player originally saw. Solved digits stay valid
  either way — this is a continuity/UX gap, not a correctness bug.

- **`delete_user_data` can't self-delete a `platform_admin` who has issued
  `business_strikes`.** `business_strikes.issued_by` is `NOT NULL` with no
  `ON DELETE` handling — deleting that admin's `auth.users` row will hit an
  FK violation and roll back (a safe failure, not silent corruption, but it
  does mean the deletion request fails rather than completing). Not
  reassigned to the sentinel deleted-user placeholder because it represents
  an admin *acting on* a business, not a player's own activity. Left
  unhandled deliberately — `platform_admins` is a tiny, manually-curated set
  for a sole founder, not a near-term risk. Revisit if admin headcount grows.

- **Card genre is now authored, not guessed — for new packs only.**
  Migration 016 added `puzzle_packs.genre` (one of the 8 `THEMES` keys)
  and Command Center now has a genre picker on save. `detectGenre()` in
  `App.jsx` still exists as a fallback for packs created before migration
  016, which have `genre = NULL` (`pp.genre || detectGenre(...)`). No
  backfill was run — old packs keep using the heuristic indefinitely
  unless someone authors a real genre for them directly in the DB.

- **Cross-hunt question repetition — considered solved by migration 017,
  no additional fix planned.** Two separate repetition problems, two
  separate existing fixes:
  - *Within one hunt* (e.g. Back to the Future on both pin 1 and pin 2):
    fixed by `exclude_movies` on `generate-trivia-question` — Command
    Center derives already-used movie titles straight from the waypoints
    already on the map and passes them into every subsequent generation
    call (see `CommandCenter.jsx`'s `fetchQuestionFor`).
  - *Across different hunts* (the same AI-generated question showing up
    in hunt after hunt over time): once questions are promoted into
    `trivia_pool` via `promote_question_to_pool`, `get_pooled_question`'s
    `ORDER BY times_used ASC, RANDOM()` naturally spreads usage across
    the whole pool instead of clustering on a few popular rows. No
    additional dedup logic needed *if* questions actually get promoted
    into the pool regularly — this only helps hunts that draw from the
    pool, not ones still generating fresh via AI every time.
  - **Not yet true today**: the Command-Center-integration step that
    actually tries the pool first and falls back to AI (mentioned in
    migration 017's own header) hasn't been built — see that migration's
    comments. Until it exists, every hunt still generates fresh via AI
    with no cross-hunt awareness at all; this section describes the
    intended fix, not current live behaviour.
