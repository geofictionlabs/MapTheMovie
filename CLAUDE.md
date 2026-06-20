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
