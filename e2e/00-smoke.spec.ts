import { test, expect } from '@playwright/test';

// Stage 1 smoke test: confirms the scaffold itself works before any real
// hunt-flow test is written -- page loads, service worker registration is
// actually blocked (asserted, not assumed from the route handler alone),
// screenshot captured.

test('home page loads and service worker registration is blocked', async ({ page, context }) => {
  // Must be set before any navigation -- App.jsx's registerSW() fires
  // from a mount-time useEffect, so the route handler has to already be
  // in place when the page's first script runs, not added after goto().
  await context.route('**/sw.js', (route) => route.abort());

  await page.goto('/');

  await expect(page).toHaveTitle(/MapTheMovie/);
  await expect(page.locator('#root')).toBeVisible();

  // The actual proof the block worked -- not just that the route handler
  // was registered, but that no service worker registration exists after
  // the page has had time to run its mount-time registerSW() call.
  const registrations = await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations()
  );
  expect(registrations).toHaveLength(0);

  await page.screenshot({ path: 'e2e/screenshots/00-smoke-home.png' });
});
