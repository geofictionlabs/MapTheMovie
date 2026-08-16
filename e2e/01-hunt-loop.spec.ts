import { test, expect } from '@playwright/test';

// Real hunt-loop test against the fixed seed data
// (scripts/012_seed_fixed_test_hunt.sql). Drives the app's own real
// anonymous-auth flow (ensureAuth() fires on hunt-card tap, not on page
// load -- confirmed by reading App.jsx before writing this), solves all
// four known-answer slots, walks a simulated GPS approach trail into the
// puzzle's 15m geofence, and confirms arrival server-side.
//
// The hunt card renders `hunt.pack_name` (get_active_hunts()'s field,
// confirmed live), which is puzzle_packs.name = "GEOFICTION-TEST-PACK"
// -- NOT campaigns.name ("TEST FIXTURE HUNT -- GEOFICTION-TEST-BUSINESS")
// as originally assumed. Confirmed by reading HuntCard's JSX directly.
//
// Undiscovered until the first real run: the whole app is gated behind
// an AccessGate screen ("PRIVATE BETA -- ENTER ACCESS CODE") that
// neither this session's earlier static investigation nor the task
// description anticipated. accessGranted is just
// localStorage.getItem('mtm_access') === 'MAPTEST2026' (App.jsx:4488),
// a client-side-only check with the code hardcoded in the shipped
// bundle (App.jsx:2427) -- not a real security boundary, just a beta
// visibility gate. Pre-seeded via addInitScript below rather than
// driven through the UI, equivalent to a returning tester who already
// has it in localStorage.

const KNOWN_ANSWERS: Array<{ slot: string; answer: number; digit: number }> = [
  { slot: 'A', answer: 11, digit: 1 },
  { slot: 'B', answer: 22, digit: 2 },
  { slot: 'C', answer: 33, digit: 3 },
  { slot: 'D', answer: 44, digit: 4 },
];

// ~300m north of the puzzle target (51.5080, -0.1281), for a genuine
// approach trail. playwright.config.ts defaults context geolocation to
// the exact target already, so this test overrides it to a far point
// first, then steps inward.
const TARGET = { latitude: 51.5080, longitude: -0.1281 };
const APPROACH_STEPS = [
  { latitude: 51.5107, longitude: -0.1281 }, // ~300m out
  { latitude: 51.5098, longitude: -0.1281 }, // ~200m out
  { latitude: 51.5089, longitude: -0.1281 }, // ~100m out
  TARGET,                                     // arrival, well within 15m geofence
];

test('full hunt loop: auth, solve, approach, arrival', async ({ page, context }) => {
  await context.route('**/sw.js', (route) => route.abort());
  await context.addInitScript(() => {
    localStorage.setItem('mtm_access', 'MAPTEST2026');
  });

  // Start far from the target -- the config's default would otherwise
  // already read as "at the destination" before the hunt even starts.
  await context.setGeolocation(APPROACH_STEPS[0]);

  await page.goto('/');

  // Real ensureAuth()/signInAnonymously() fires on this click, not before.
  const huntCard = page.getByText('GEOFICTION-TEST-PACK', { exact: false });
  await expect(huntCard).toBeVisible({ timeout: 15_000 });
  await huntCard.click();

  for (const { slot, answer, digit } of KNOWN_ANSWERS) {
    const input = page.locator('.puzzle-input').first();
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill(String(answer));
    await page.locator('.puzzle-submit').first().click();

    const badge = page.locator('.puzzle-solved-badge', { hasText: `Digit ${slot} = ${digit}` });
    await expect(badge).toBeVisible({ timeout: 10_000 });
  }

  // All four solved -- app calls unlock_coordinates and transitions after
  // a ~600ms delay (App.jsx). Report reality rather than assume a
  // selector: wait for the puzzle cards to leave the DOM, then capture
  // what's actually on screen.
  await expect(page.locator('.puzzle-input')).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e/screenshots/01-after-all-solved.png', fullPage: true });
  console.log('POST-SOLVE SCREEN TEXT:', await page.locator('body').innerText());

  // Approach trail -- one setGeolocation per step, waited out past the
  // app's 5-second getCurrentPosition poll interval so each step is
  // actually observed, not skipped.
  for (const point of APPROACH_STEPS.slice(1)) {
    await context.setGeolocation(point);
    await page.waitForTimeout(6000);
  }

  await page.screenshot({ path: 'e2e/screenshots/02-at-arrival.png', fullPage: true });

  const revealCode = page.locator('.reveal-code');
  await expect(revealCode).toBeVisible({ timeout: 20_000 });
  const codeText = await revealCode.innerText();
  console.log('ARRIVAL SCREEN voucher code element text:', codeText);
  expect(codeText.trim()).not.toBe('---');
  expect(codeText.trim().length).toBeGreaterThan(0);
});
