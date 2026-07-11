# Session Notes — 27 June 2026

## Completed Today
- HuntSelectionScreen genre-differentiated cards deployed
- Dashboard Go Live pin drop map fixed
- Stale session bug fixed
- Landing page connected to GitHub (mapthemovie-landing repo)
- Projector hero design live on mapthemovie.co.uk
- Supabase query fixed to use theme_tag not genre
- Profiles 400 error removed

## Tomorrow — START HERE
### Priority 1: Run this SQL in Supabase SQL Editor
File: 003_kent_hunts_seed.sql (in Downloads)
This creates 8 hunts x 5 waypoints x 12 questions across Kent
Routes already planned at 5 min walk spacing — see below

### Hunt Routes (5 waypoints each, ~400m apart)
HORROR Folkestone: 51.0789/1.1756 → 51.0801/1.1789 → 51.0812/1.1812 → 51.0798/1.1834 → 51.0773/1.1812
SCIFI Canterbury: 51.2739/1.0889 → 51.2756/1.0867 → 51.2789/1.0812 → 51.2798/1.0798 → 51.2751/1.0778
ACTION Maidstone: 51.2718/0.5217 → 51.2734/0.5189 → 51.2721/0.5167 → 51.2709/0.5189 → 51.2698/0.5212
ROMANCE TunbridgeWells: 51.1323/0.2634 → 51.1334/0.2612 → 51.1312/0.2598 → 51.1298/0.2589 → 51.1289/0.2601
COMEDY Margate: 51.3856/1.3789 → 51.3847/1.3836 → 51.3834/1.3856 → 51.3823/1.3845 → 51.3812/1.3823
THRILLER Dover: 51.1289/1.3034 → 51.1301/1.3056 → 51.1312/1.3078 → 51.1298/1.3101 → 51.1278/1.3089
GENERAL Gillingham: 51.3923/0.5501 → 51.3912/0.5478 → 51.3901/0.5456 → 51.3878/0.5445 → 51.3856/0.5423
80S Broadstairs: 51.3623/1.4389 → 51.3612/1.4412 →

## Git State at End of Session
Branch: main (up to date with origin/main, clean working tree)

### Last 10 commits
2d3821a fix: use theme_tag not genre, coordinate_slots from puzzles not pack
f27929c feat: genre-differentiated hunt cards with unique visual identities
ad3492c fix: always show pin drop on go live, force close stale sessions
abc80c3 fix: go live fallback to pin drop, isLive state only true if active session
22ad592 fix: pin drop modal timing, puzzle guard, map centre geolocation
588855c fix: puzzle_packs genre+coordinate_slots in query and mapping, remove profiles 400
4d7d62c fix: coord masking, genre theme from puzzle_packs, clue count
d03636c feat: hunt card genre themes, coloured difficulty pills, coord fix
76b37ff feat: hunt cards genre themes, difficulty colours, coord fix
507671e fix: remove dead entry fee code, use prize_amount_gbp for prize pool

## Repos
- App: C:\Users\mgree\Desktop\geofictionlabs\mapthemovie-app → github.com/geofictionlabs/MapTheMovie
- Landing: C:\Users\mgree\Desktop\geofictionlabs\mapthemovie-deploy → github.com/geofictionlabs/mapthemovie-landing
- Schema: C:\Users\mgree\Desktop\geofictionlabs\mapthemovie\migrations\
