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
- **Hosting:** Vercel — SPA rewrite in `vercel.json` (all routes → `index.html`)
- **Maps:** Leaflet.js
- **Payments:** Stripe — not yet integrated

## Repository Layout

```
mapthemovie-app/          ← this repo
  src/
    App.jsx               — player-facing app (1700+ lines, state-based nav)
    Dashboard.jsx         — business portal (1200+ lines)
    main.jsx              — entry point: ErrorBoundary + path routing
    index.css             — global reset (dark background forced here)
    lib/supabase.js       — Supabase client (pure ASCII, no fallbacks)
  index.html              — inline <style> for pre-React dark flash fix
  vercel.json             — SPA rewrite config
  .env                    — Supabase credentials (never commit)

../mapthemovie/           ← sibling folder (schema + migrations)
  MapTheMovie_Schema.sql  — full schema: 10 tables, 8 RPC functions, RLS
  migrations/
    001_comic_con.sql     — live session, voucher, push tables + RPCs
    002_seed_data.sql     — seed data (content-cleaned, no event names)
    003_functions_only.sql
```

## Supabase

- **Project URL:** `https://hnayygbrhrxyyfucgrus.supabase.co`
- **10 tables:** businesses, campaigns, puzzle_packs, puzzles, profiles,
  redemptions, live_business_sessions, elite_voucher_codes, push_subscriptions, waypoints
- **8 RPCs (SECURITY DEFINER):** `get_active_hunts`, `check_trivia_answer`,
  `validate_gps_arrival`, `draw_elite_voucher`, `go_live`, `get_my_business`,
  `get_business_dashboard`, `record_redemption`
- Full RLS on all tables — trivia answers never exposed to client
- Answer validation via RPC only (never client-side)

## Vercel

- Project ID: `prj_85xidJ9bvKA9SwMqXF6ERCevyLBa`
- Org: `team_fmkJdJQTzIPhRzkZ9postOLB`
- Deploy: `npx vercel --prod` from `mapthemovie-app/`

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

- **NEVER use `var(--anything)` in CSS** — hardcoded hex only, every time
- **NEVER reference** Comic Con, Folkestone, Harbour Arm, specific launch dates or locations
- **Always add** `style={{ background: '#121218', minHeight: '100vh', color: '#F1F0FF' }}`
  on the outermost div of every root component
- **`supabase.js` must be pure ASCII** — no em-dashes, smart quotes, or any
  non-ISO-8859-1 character anywhere in the file (causes `Headers` TypeError on fetch)
- **Progressive waypoints stay** — the trivia → GPS → arrive → voucher flow is core product
- **Simple state-based navigation** — no React Router, `window.location.pathname`
  used only once in `main.jsx` to split player vs dashboard

## Navigation Model

`main.jsx` checks `window.location.pathname`:
- Starts with `/dashboard` → renders `<Dashboard />`
- Everything else → renders `<App />`

Within `<App />` all screen transitions are state-driven (`currentScreen`, `currentView`, etc.).
No client-side router. Vercel SPA rewrite handles deep links.

## Current Status (as of 2026-06-19)

**Fixed:**
- ✅ Blank white page — `html,body,#root { background:#121218 !important }` in
  `index.css`, inline style on every root div, pre-React inline style in `index.html`
- ✅ `TypeError: Failed to execute 'set' on 'Headers'` — `supabase.js` pure ASCII
- ✅ Content cleaned — no Comic Con / Folkestone / Harbour Arm in source or DB
- ✅ ErrorBoundary in `main.jsx` — crashes show dark "Something went wrong" screen

**Next priorities:**
1. Wire game engine to real Supabase data (currently uses mock/placeholder data)
2. Go Live Lock for mobile businesses (Dashboard feature)
3. Nearby hunts discovery map
4. Legal documents (privacy policy, terms)
5. Stripe subscriptions

## Game Flow (Player)

1. Home screen — list of active hunts from `get_active_hunts()` RPC
2. Select hunt — enter trivia phase
3. Trivia — answer validated via `check_trivia_answer()` RPC (never client-side)
4. Each correct answer reveals one GPS coordinate component
5. GPS phase — Leaflet map shows fuzzed pin; player walks to location
6. Arrival — `validate_gps_arrival()` RPC checks PostGIS geofence
7. Voucher — `draw_elite_voucher()` or `record_redemption()` issues reward
