-- ============================================================
-- 013: seed_production_checkly_monitor_hunt.sql
--
-- DRAFT -- NOT RUN. Written for manual review and manual execution
-- against PRODUCTION (hnayygbrhrxyyfucgrus) by Michael. Claude Code has
-- zero production database access and this file has not been run
-- against any database.
--
-- Adapted from mapthemovie-app/scripts/012_seed_fixed_test_hunt.sql
-- (re-read fresh before writing this, confirmed unchanged since this
-- session wrote it). Same structure, same idempotency pattern (fixed
-- hardcoded UUIDs, every INSERT is ON CONFLICT (id) DO UPDATE, same
-- pgcrypto redemption_pin_hash scheme, is_active = true,
-- campaigns.status = 'active'), same "stops at playable, no sessions/
-- redemptions" boundary. Real differences from 012, all deliberate:
--
-- 1. DIFFERENT fixed UUIDs from staging's (staging and production are
--    separate databases, so collision risk is genuinely zero regardless
--    -- confirmed this session -- but distinct IDs avoid any confusion
--    if the two environments are ever compared side by side). New set,
--    documented below.
-- 2. businesses.is_test_fixture = true, explicit (migration 087) -- the
--    entire reason this row exists. Does not default to false here.
-- 3. Unambiguous "monitor", not "test", naming throughout
--    (CHECKLY-MONITOR-BUSINESS / CHECKLY-MONITOR-PACK, not 012's
--    GEOFICTION-TEST-* names) -- this fixture lives permanently on
--    production, unlike a Playwright test run's rows, so it needs to
--    read unmistakably in any admin view. Exactly the reason
--    FlightDeck.jsx now filters on is_test_fixture.
-- 4. Same real, walkable coordinates as staging (Trafalgar Square,
--    51.5080, -0.1281) -- reused deliberately, it's just a location.
-- 5. NO hunt_sessions or redemptions rows -- same boundary as 012.
--    Checkly's own hourly run creates and cleans up its own session/
--    redemption every time; this script only creates the permanent,
--    reusable hunt shell those runs play against.
--
-- Fixed IDs -- hardcode these in the Checkly script/config, do not
-- query for them by name/slug:
--
--   business_id     = 11111111-0000-4000-8000-000000000001
--   pack_id         = 11111111-0000-4000-8000-000000000002
--   puzzle_id       = 11111111-0000-4000-8000-000000000003
--   campaign_id     = 11111111-0000-4000-8000-000000000004
--   trivia_variables (slot A/B/C/D) =
--     11111111-0000-4000-8000-000000000005 / ...006 / ...007 / ...008
--
-- KNOWN correct answers, same as staging's fixture:
--   slot A = 11 (coordinate_digit 1)
--   slot B = 22 (coordinate_digit 2)
--   slot C = 33 (coordinate_digit 3)
--   slot D = 44 (coordinate_digit 4)
--
-- Masked-coordinate scheme identical reasoning to 012: with exactly 4
-- slots, every slot index is < 4, so all four letters land in the
-- latitude digits (masked_lat = 51.ABCD) and masked_lon keeps its
-- placeholder decimal digits (-0.5678) untouched.
--
-- redemption_pin_hash uses the exact scheme confirm_redemption and
-- validate_voucher_code check against (same as 012):
--   encode(digest((pin || business_id::text)::bytea, 'sha256'), 'hex')
-- Fixed monitor PIN: 1234 (not sensitive -- this is a fake business
-- with no real money moving through it). digest() is schema-qualified
-- as extensions.digest, same reason as 012: confirm_redemption/
-- validate_voucher_code SET search_path TO 'public', 'extensions' to
-- reach it, it is not on the default search_path otherwise.
--
-- hunt_type = 'voucher', status = 'active' -- 'active', not the
-- campaigns.status column's own default of 'draft', same reasoning as
-- 012: create_command_center_hunt hardcodes 'active' on every campaign
-- it creates; a 'draft' campaign would not be playable.
--
-- Safe to re-run: every INSERT below is ON CONFLICT (id) DO UPDATE,
-- keyed on the fixed UUIDs above -- running this twice updates the same
-- 5 rows in place, it does not duplicate rows or error.
-- ============================================================

-- 1. businesses
INSERT INTO businesses (
  id, name, slug, description, address, postcode, location,
  contact_name, contact_email, contact_phone,
  billing_tier, is_active, is_test_fixture, redemption_pin_hash
) VALUES (
  '11111111-0000-4000-8000-000000000001',
  'CHECKLY-MONITOR-BUSINESS',
  'checkly-monitor',
  'Permanent monitoring fixture business -- created by scripts/013_seed_production_checkly_monitor_hunt.sql. Played by an automated Checkly check hourly. Not a real business.',
  'Trafalgar Square, London',
  'WC2N 5DN',
  'SRID=4326;POINT(-0.1281 51.5080)'::geography,
  'Monitoring Fixture Contact',
  'checkly-monitor@example.invalid',
  '+440000000000',
  'starter',
  true,
  true,
  encode(extensions.digest(('1234' || '11111111-0000-4000-8000-000000000001')::bytea, 'sha256'), 'hex')
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  address = EXCLUDED.address,
  postcode = EXCLUDED.postcode,
  location = EXCLUDED.location,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  billing_tier = EXCLUDED.billing_tier,
  is_active = EXCLUDED.is_active,
  is_test_fixture = EXCLUDED.is_test_fixture,
  redemption_pin_hash = EXCLUDED.redemption_pin_hash,
  updated_at = now();

-- 2. puzzle_packs
INSERT INTO puzzle_packs (
  id, name, slug, tagline, description, content_type, tier, price_gbp,
  is_active, genre
) VALUES (
  '11111111-0000-4000-8000-000000000002',
  'CHECKLY-MONITOR-PACK',
  'checkly-monitor-pack',
  'Permanent monitoring fixture pack',
  'Permanent monitoring fixture pack -- created by scripts/013_seed_production_checkly_monitor_hunt.sql. Not real content.',
  'movie',
  'standard',
  0.00,
  true,
  'general'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  content_type = EXCLUDED.content_type,
  tier = EXCLUDED.tier,
  price_gbp = EXCLUDED.price_gbp,
  is_active = EXCLUDED.is_active,
  genre = EXCLUDED.genre,
  updated_at = now();

-- 3. puzzles
INSERT INTO puzzles (
  id, pack_id, title, description, masked_lat, masked_lon,
  real_lat, real_lon, geofence_radius_m, coordinate_slots,
  difficulty, walk_time_min, is_active
) VALUES (
  '11111111-0000-4000-8000-000000000003',
  '11111111-0000-4000-8000-000000000002',
  'MONITORING FIXTURE PUZZLE -- DO NOT USE AS REAL CONTENT',
  'Permanent monitoring fixture puzzle -- created by scripts/013_seed_production_checkly_monitor_hunt.sql.',
  '51.ABCD',
  '-0.5678',
  51.5080,
  -0.1281,
  15,
  ARRAY['A','B','C','D'],
  2,
  15,
  true
)
ON CONFLICT (id) DO UPDATE SET
  pack_id = EXCLUDED.pack_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  masked_lat = EXCLUDED.masked_lat,
  masked_lon = EXCLUDED.masked_lon,
  real_lat = EXCLUDED.real_lat,
  real_lon = EXCLUDED.real_lon,
  geofence_radius_m = EXCLUDED.geofence_radius_m,
  coordinate_slots = EXCLUDED.coordinate_slots,
  difficulty = EXCLUDED.difficulty,
  walk_time_min = EXCLUDED.walk_time_min,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- 4. trivia_variables -- one row per slot, KNOWN correct_answer
INSERT INTO trivia_variables (
  id, puzzle_id, slot, movie_title, movie_year, movie_emoji,
  question_text, correct_answer, coordinate_digit, extraction_note,
  hint_text, placeholder, difficulty, sort_order
) VALUES
(
  '11111111-0000-4000-8000-000000000005',
  '11111111-0000-4000-8000-000000000003',
  'A',
  'CHECKLY_MONITOR_MOVIE_A',
  2000,
  '🎬',
  'MONITORING FIXTURE QUESTION FOR SLOT A -- not real trivia. The correct answer is always 11.',
  11,
  1,
  'Monitoring fixture extraction note for slot A -- not real content.',
  'Fixed monitoring fixture. Correct answer: 11.',
  'e.g. 11',
  2,
  0
),
(
  '11111111-0000-4000-8000-000000000006',
  '11111111-0000-4000-8000-000000000003',
  'B',
  'CHECKLY_MONITOR_MOVIE_B',
  2000,
  '🎬',
  'MONITORING FIXTURE QUESTION FOR SLOT B -- not real trivia. The correct answer is always 22.',
  22,
  2,
  'Monitoring fixture extraction note for slot B -- not real content.',
  'Fixed monitoring fixture. Correct answer: 22.',
  'e.g. 22',
  2,
  1
),
(
  '11111111-0000-4000-8000-000000000007',
  '11111111-0000-4000-8000-000000000003',
  'C',
  'CHECKLY_MONITOR_MOVIE_C',
  2000,
  '🎬',
  'MONITORING FIXTURE QUESTION FOR SLOT C -- not real trivia. The correct answer is always 33.',
  33,
  3,
  'Monitoring fixture extraction note for slot C -- not real content.',
  'Fixed monitoring fixture. Correct answer: 33.',
  'e.g. 33',
  2,
  2
),
(
  '11111111-0000-4000-8000-000000000008',
  '11111111-0000-4000-8000-000000000003',
  'D',
  'CHECKLY_MONITOR_MOVIE_D',
  2000,
  '🎬',
  'MONITORING FIXTURE QUESTION FOR SLOT D -- not real trivia. The correct answer is always 44.',
  44,
  4,
  'Monitoring fixture extraction note for slot D -- not real content.',
  'Fixed monitoring fixture. Correct answer: 44.',
  'e.g. 44',
  2,
  3
)
ON CONFLICT (id) DO UPDATE SET
  puzzle_id = EXCLUDED.puzzle_id,
  slot = EXCLUDED.slot,
  movie_title = EXCLUDED.movie_title,
  movie_year = EXCLUDED.movie_year,
  movie_emoji = EXCLUDED.movie_emoji,
  question_text = EXCLUDED.question_text,
  correct_answer = EXCLUDED.correct_answer,
  coordinate_digit = EXCLUDED.coordinate_digit,
  extraction_note = EXCLUDED.extraction_note,
  hint_text = EXCLUDED.hint_text,
  placeholder = EXCLUDED.placeholder,
  difficulty = EXCLUDED.difficulty,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 5. campaigns
INSERT INTO campaigns (
  id, business_id, pack_id, name, status, starts_at, ends_at,
  max_redemptions, voucher_headline, voucher_detail, hunt_type, difficulty
) VALUES (
  '11111111-0000-4000-8000-000000000004',
  '11111111-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000002',
  'CHECKLY MONITOR HUNT -- CHECKLY-MONITOR-BUSINESS',
  'active',
  '2026-01-01T00:00:00Z',
  '2030-01-01T00:00:00Z',
  100,
  'MONITORING FIXTURE -- show this screen to claim your reward',
  'Permanent monitoring fixture campaign -- created by scripts/013_seed_production_checkly_monitor_hunt.sql. Not a real offer.',
  'voucher',
  'classic'
)
ON CONFLICT (id) DO UPDATE SET
  business_id = EXCLUDED.business_id,
  pack_id = EXCLUDED.pack_id,
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at,
  max_redemptions = EXCLUDED.max_redemptions,
  voucher_headline = EXCLUDED.voucher_headline,
  voucher_detail = EXCLUDED.voucher_detail,
  hunt_type = EXCLUDED.hunt_type,
  difficulty = EXCLUDED.difficulty,
  updated_at = now();
