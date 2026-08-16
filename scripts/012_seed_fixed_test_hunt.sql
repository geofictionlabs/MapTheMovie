-- ============================================================
-- 012: seed_fixed_test_hunt.sql
--
-- Creates ONE fixed, known-good, idempotent test hunt on STAGING ONLY
-- (dlypoersysiovufzaigv). Mirrors what create_command_center_hunt
-- (mapthemovie/migrations, most recently redefined in 069) does for a
-- single-destination, 4-slot hunt -- same table order, same
-- masked-coordinate scheme, same voucher-campaign PIN guard -- but with
-- fixed hardcoded UUIDs and values instead of admin-entered ones, and
-- safe to re-run (every INSERT is ON CONFLICT (id) DO UPDATE).
--
-- This script does NOT call create_command_center_hunt itself: that
-- function generates a new random UUID on every call and has no
-- ON CONFLICT handling, so it cannot be made idempotent. This script
-- reproduces its INSERT shapes directly with fixed values instead.
--
-- Every ID below is fixed -- hardcode these same values in any pgTAP
-- test or Playwright fixture that needs this hunt, rather than
-- querying for them by name/slug:
--
--   business_id     = 00000000-0000-4000-8000-000000000001
--   pack_id         = 00000000-0000-4000-8000-000000000002
--   puzzle_id       = 00000000-0000-4000-8000-000000000003
--   campaign_id     = 00000000-0000-4000-8000-000000000004
--   trivia_variables (slot A/B/C/D) =
--     00000000-0000-4000-8000-000000000005 / ...006 / ...007 / ...008
--
-- Real-world location: no prior "physical walkthrough" coordinates were
-- found referenced anywhere in either repo's git history or the
-- session-notes files on disk (checked this session -- git log --all
-- --grep, and direct grep of both repos and the Desktop handoff/session
-- files, zero matches). Trafalgar Square, London (51.5080, -0.1281) was
-- picked instead: real, public, walkable, and unconnected to any of the
-- banned event/venue references in CLAUDE.md's Critical Rules.
--
-- KNOWN correct answers -- the entire point of a fixed fixture:
--   slot A = 11 (coordinate_digit 1)
--   slot B = 22 (coordinate_digit 2)
--   slot C = 33 (coordinate_digit 3)
--   slot D = 44 (coordinate_digit 4)
--
-- Masked-coordinate scheme mirrors create_command_center_hunt exactly
-- for a 4-slot hunt: with exactly 4 slots, every slot index is < 4, so
-- all four letters land in the latitude digits (masked_lat becomes
-- fully letter-substituted, 51.ABCD) and the longitude digits are never
-- touched (masked_lon keeps its placeholder decimal digits, -0.5678) --
-- same "sign and integer part real, decimal digits synthetic" rule
-- migration 060 documents for that function, computed by hand here
-- since this script writes the rows directly.
--
-- redemption_pin_hash uses the exact scheme confirm_redemption and
-- validate_voucher_code actually check against (confirmed via live
-- pg_get_functiondef this session, migrations 043/051 lineage):
--   encode(digest((pin || business_id::text)::bytea, 'sha256'), 'hex')
-- Fixed test PIN: 1234. digest() is schema-qualified as extensions.digest
-- because confirm_redemption/validate_voucher_code both explicitly
-- SET search_path TO 'public', 'extensions' to reach it -- it is not on
-- the default search_path otherwise.
--
-- hunt_type = 'voucher', status = 'active'. 'active', not the
-- campaigns.status column's own default of 'draft' -- confirmed by
-- reading create_command_center_hunt's live body this session, which
-- hardcodes 'active' on every campaign it creates. A 'draft' campaign
-- would not be playable.
--
-- STOPS at "the hunt exists and is playable" -- same boundary as
-- create_command_center_hunt itself, which never touches hunt_sessions
-- or redemptions. Those come from actually playing the hunt
-- (Playwright) or a test's own throwaway fixture, not from this script.
--
-- Safe to re-run: every INSERT below is ON CONFLICT (id) DO UPDATE,
-- keyed on the fixed UUIDs above -- running this twice updates the same
-- 5 rows in place, it does not duplicate rows or error.
-- ============================================================

-- 1. businesses
INSERT INTO businesses (
  id, name, slug, description, address, postcode, location,
  contact_name, contact_email, contact_phone,
  billing_tier, is_active, redemption_pin_hash
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'GEOFICTION-TEST-BUSINESS',
  'geofiction-test',
  'Fixed test fixture business -- created by scripts/012_seed_fixed_test_hunt.sql. Not a real business.',
  'Trafalgar Square, London',
  'WC2N 5DN',
  'SRID=4326;POINT(-0.1281 51.5080)'::geography,
  'Test Fixture Contact',
  'test-fixture@example.invalid',
  '+440000000000',
  'starter',
  true,
  encode(extensions.digest(('1234' || '00000000-0000-4000-8000-000000000001')::bytea, 'sha256'), 'hex')
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
  redemption_pin_hash = EXCLUDED.redemption_pin_hash,
  updated_at = now();

-- 2. puzzle_packs
INSERT INTO puzzle_packs (
  id, name, slug, tagline, description, content_type, tier, price_gbp,
  is_active, genre
) VALUES (
  '00000000-0000-4000-8000-000000000002',
  'GEOFICTION-TEST-PACK',
  'geofiction-test-pack',
  'Fixed test fixture pack',
  'Fixed test fixture pack -- created by scripts/012_seed_fixed_test_hunt.sql. Not real content.',
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
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  'TEST FIXTURE PUZZLE -- DO NOT USE AS REAL CONTENT',
  'Fixed test fixture puzzle -- created by scripts/012_seed_fixed_test_hunt.sql.',
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
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000003',
  'A',
  'TEST_FIXTURE_MOVIE_A',
  2000,
  '🎬',
  'TEST FIXTURE QUESTION FOR SLOT A -- not real trivia. The correct answer is always 11.',
  11,
  1,
  'Test fixture extraction note for slot A -- not real content.',
  'Fixed test fixture. Correct answer: 11.',
  'e.g. 11',
  2,
  0
),
(
  '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000003',
  'B',
  'TEST_FIXTURE_MOVIE_B',
  2000,
  '🎬',
  'TEST FIXTURE QUESTION FOR SLOT B -- not real trivia. The correct answer is always 22.',
  22,
  2,
  'Test fixture extraction note for slot B -- not real content.',
  'Fixed test fixture. Correct answer: 22.',
  'e.g. 22',
  2,
  1
),
(
  '00000000-0000-4000-8000-000000000007',
  '00000000-0000-4000-8000-000000000003',
  'C',
  'TEST_FIXTURE_MOVIE_C',
  2000,
  '🎬',
  'TEST FIXTURE QUESTION FOR SLOT C -- not real trivia. The correct answer is always 33.',
  33,
  3,
  'Test fixture extraction note for slot C -- not real content.',
  'Fixed test fixture. Correct answer: 33.',
  'e.g. 33',
  2,
  2
),
(
  '00000000-0000-4000-8000-000000000008',
  '00000000-0000-4000-8000-000000000003',
  'D',
  'TEST_FIXTURE_MOVIE_D',
  2000,
  '🎬',
  'TEST FIXTURE QUESTION FOR SLOT D -- not real trivia. The correct answer is always 44.',
  44,
  4,
  'Test fixture extraction note for slot D -- not real content.',
  'Fixed test fixture. Correct answer: 44.',
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
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'TEST FIXTURE HUNT -- GEOFICTION-TEST-BUSINESS',
  'active',
  '2026-01-01T00:00:00Z',
  '2030-01-01T00:00:00Z',
  100,
  'TEST FIXTURE -- show this screen to claim your reward',
  'Fixed test fixture campaign -- created by scripts/012_seed_fixed_test_hunt.sql. Not a real offer.',
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
