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
    App.jsx               - player-facing app (5,000+ lines, state-based nav)
                            large enough that targeted investigations should use
                            a subagent rather than reading it into the main session
    Dashboard.jsx         - business portal (2,035 lines)
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
  migrations/             - numbered 001-070; list the directory rather than
                            relying on this file, which will always drift
```

## SECURITY

- **RESOLVED — verified live in production 2026-07-25 (this entry previously
  said "Not fixed"; kept rather than deleted so the before/after and the
  verification method are on record).** `puzzles.real_lat`/`real_lon` are NOT
  readable via the anon key or a real anonymous-auth session, despite
  `puzzles_select_active` still being a full-row RLS policy with no column
  restriction (`FOR SELECT USING (is_active = TRUE)`). The actual fix is at
  the grant level, not RLS: `migrations/028_fix_real_coordinate_exposure.sql`
  runs `REVOKE ALL ON public.puzzles FROM anon, authenticated` followed by a
  column-level `GRANT SELECT (id, pack_id, title, description, sort_order,
  masked_lat, masked_lon, coordinate_slots, difficulty, walk_time_min,
  is_active)` — 11 columns, with `real_lat`/`real_lon`/`real_location`/
  `geofence_radius_m` deliberately absent. Verified two independent ways:
  (1) `information_schema.column_privileges` shows exactly those 11 columns
  granted to `anon`/`authenticated`, nothing else; (2) live REST tests
  against production — bare anon key AND a real anonymous-auth session
  (`role: authenticated`, `is_anonymous: true` — the actual state a player
  is in mid-hunt, not the bare `anon` role) both return `42501 permission
  denied for table puzzles` when `real_lat`/`real_lon` are requested, while
  permitted columns (`id`, `title`, `masked_lat`, etc.) return real rows
  normally in the same session.

  **Warning for whoever hits this 42501 next:** it is EXPECTED for
  coordinate columns. PostgREST's own error hint reads "Grant the required
  privileges to the current role with: GRANT SELECT ON public.puzzles TO
  anon" — **do NOT follow that hint.** Running it grants table-wide SELECT
  and re-exposes every real coordinate to any client, silently undoing
  migration 028's column allowlist. If a new feature genuinely needs a
  currently-excluded column, add that one column to the existing `GRANT
  SELECT (...)` list in a new migration — never re-grant the whole table.

- **STILL UNFIXED — re-verified live in production 2026-07-25 (not stale,
  confirmed accurate, unlike the item above).** `get_puzzle_waypoints` is
  callable via the anon key despite being revoked from it. Migration
  `014_real_multistop_waypoints.sql` runs `REVOKE ALL ON FUNCTION
  get_puzzle_waypoints(uuid) FROM PUBLIC` then `GRANT EXECUTE ... TO
  authenticated` — intended to restrict the RPC to signed-in (including
  anonymous-auth) sessions only. Re-tested two ways against production
  today: bare anon key, and a real anonymous-auth session (`role:
  authenticated`, `is_anonymous: true` — the actual state a player is in
  mid-hunt). **Both return HTTP 200 with `{"success": false, "error":
  "Session not found"}`, not `42501`** — confirming the anon role can
  still execute the function; it just doesn't own a real `hunt_sessions`
  row in this test, so no coordinates come back. Likely cause unchanged:
  Supabase grants `EXECUTE` to `anon`/`authenticated` directly (not via
  the `PUBLIC` pseudo-role) at function-creation time, so `REVOKE ALL ...
  FROM PUBLIC` doesn't touch that grant. The RPC itself is SECURITY
  DEFINER and still requires a valid, owned `hunt_sessions` row to return
  real coordinates, so this isn't currently exploitable the same way the
  `real_lat`/`real_lon` issue above was — but the intended access
  restriction is silently not enforced.

  **Migration 029 does NOT fix this — confirmed by reading it, not
  assumed.** `029_enforce_sequential_slot_solving.sql` only touches
  `validate_answer` (closes a *different* gap: out-of-order slot solving
  that could otherwise inflate `solved_count` and cause migration 028's
  phase-gating inside `get_puzzle_waypoints` to hand back coordinates for
  unsolved slots). Migration 028 itself rewrote `get_puzzle_waypoints`'s
  *body* to add that phase-gating, but never touched its `GRANT`/`REVOKE`
  — the anon-execute grant is still exactly what migration 014 left it as.
  No migration after 014 changes the grant on this function.

  Same category as the `real_lat`/`real_lon` issue was — treat both as one
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
  `correct_answer`, extracts `coordinate_digit` server-side, and returns it to
  the client under the key `digit`, not `coordinate_digit`.

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

## Standing Rules — Database and Relay

**Build every function replacement from a live `pg_get_functiondef` pull.**
Unconditional. Never from a migration file. Never from reasoning that a file
"must still match live because nothing has touched it since" — that exemption is
exactly how migration 052 silently reverted 046's coordinate fix and reintroduced
a live coordinate leak. Postgres replaces a function whole with no diff, so a
reverted fix leaves no trace. Michael runs the query and pastes the result; wait
for it rather than substituting a file.

**`validate_answer` must return a scalar `jsonb`.** Never `RETURNS TABLE`, never
`RETURNS SETOF`. The frontend reads `data.correct`, not `data[0].correct`
(App.jsx, handleSubmitAnswer). If PostgREST returns an array, every property read
becomes undefined, `correct` is falsy, and every submission — right or wrong —
renders as incorrect with no error shown. Silently unsolvable puzzle.

Seven load-bearing keys, none of which may be renamed:
`signal_points_remaining`, `correct`, `digit`, `all_solved`, `locked_out`,
`locked_until`, `attempts_remaining`.

`digit` in particular: it is NOT `coordinate_digit`. Renaming it for consistency
with the column name breaks slot solving. Adding new keys is safe — no caller
spreads, destructures exhaustively, or schema-validates.

Also: `signal_points_remaining` must be a real number, not a string — the
frontend guards on `typeof === 'number'` and fails silently on `"3"`. And
`attempts_remaining` must be absent or null when there is no lockout, never 0 —
the test is `!= null`.

**`CREATE OR REPLACE` cannot change a `RETURNS TABLE` or `RETURNS SETOF`
signature.** Adding a column to the return type is a return-type change and
Postgres rejects it with "cannot change return type of existing function". It
needs an explicit `DROP FUNCTION IF EXISTS fn(argtypes);` first. The DROP takes
the function's grants with it, so the REVOKE/GRANT block afterwards is required
to restore access — not a harmless re-issue. DROP + CREATE count as one logical
statement; they must run together.

**Every admin RPC needs both halves of the gate.** `is_platform_admin()` inside
the function body AND an explicit `REVOKE EXECUTE ON FUNCTION fn(argtypes) FROM
anon;`. This is a standing requirement for every new RPC, not a fix for one past
bug. `REVOKE ALL ... FROM PUBLIC` does NOT reach anon in this database — Supabase
grants EXECUTE to anon/authenticated directly at function-creation time, not via
the PUBLIC pseudo-role. Neither half is sufficient alone: the body guard without
the revoke leaves the function callable, and the revoke without the body guard
leaves it open to any authenticated player.

**Two deploy paths. Confusing them has cost hours twice.**
- Edge Functions — auto-deploy via GitHub Actions on push to main
- Frontend — requires `npx vercel --prod` manually. CI does NOT ship it.

Verify a deploy by content, not by hash: fetch the deployed chunk and grep for a
distinctive string. If a change is pure control flow with no new strings, say so
rather than claiming a check that wasn't possible.

**Never request or accept a service-role key, database connection string, or
Supabase access token.** A service-role key bypasses RLS entirely and would undo
the security posture built across several sessions. If blocked, say what is
blocking and ask for a query to be run instead.

STAGING EXCEPTION (added 15 Aug 2026): The rule above applies fully to
PRODUCTION (hnayygbrhrxyyfucgrus). It does NOT apply to the staging
project (dlypoersysiovufzaigv): staging holds schema only, zero real
user data, and was built specifically as a safe environment for this
kind of work. A STAGING_DB_URL value may be read and used freely for
staging — querying, running supabase test db, writing and executing
pgTAP tests. This exception is scoped to staging by project ref; if a
new staging project is ever created, update this line to match.
Production access rules are completely unchanged by this exception.

**Type long content directly into the reply body.** File contents, SQL, and diffs
must be typed out in the reply, never referenced from a tool result — the
copy-paste relay truncates and corrupts them, and has already done so repeatedly.
For very long files use the clipboard, and remember the clipboard holds one thing
at a time.

**"Success. No rows returned" means no error was thrown — not that the state is
correct.** Always follow with a real verification query. This has already caught
a REVOKE that silently hadn't applied.

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
   extracts coordinate digit (e.g. answer=88, coordinate_digit=8), and returns
   it to the client under the key `digit`, not `coordinate_digit`.
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
  - **STALE — this was true when written, not true now (third stale doc
    entry corrected today, same day as the real_lat/real_lon and
    get_puzzle_waypoints re-verifications above).** The pool-first
    integration this bullet describes as "not yet built" is live: verified
    directly in `CommandCenter.jsx`'s `fetchQuestionFor` (~line 498) —
    every waypoint generation calls `supabase.rpc('get_pooled_question', ...)`
    first and only falls through to `generateTriviaQuestion` (AI) when the
    pool call returns no match (`.maybeSingle()` unwraps zero rows to a
    real `null`, migration 034). So cross-hunt dedup via the pool genuinely
    is active for any genre/digit/difficulty combination that already has
    promoted rows — it just does nothing for a genre with no pool history
    yet (e.g. a newly-added allowlist genre on day one), which will always
    miss the pool and fall through to cold AI generation regardless of
    this code path working correctly.
