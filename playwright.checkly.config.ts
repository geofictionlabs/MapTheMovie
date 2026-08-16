import { defineConfig, devices } from '@playwright/test';

// Separate config for the one production Checkly monitor -- deliberately
// not the root playwright.config.ts, which is the staging dev-server
// setup (webServer running `npx vite --mode staging`, baseURL
// localhost:5173). Checkly's infrastructure has no local dev server to
// launch, so this config has no webServer block at all, and points
// baseURL straight at the real deployed site.
//
// geolocation/permissions are deliberately NOT set here as defaults --
// __checks__/hunt-monitor.spec.ts already calls
// context.setGeolocation(...)/context.grantPermissions(['geolocation'])
// explicitly at the start of the test itself, so a config-level default
// would just be redundant with (and immediately overridden by) what the
// spec already does correctly.

export default defineConfig({
  // Scopes Playwright's own file discovery to __checks__/ only --
  // e2e/00-smoke.spec.ts and e2e/01-hunt-loop.spec.ts live in a
  // different directory and are structurally unreachable from here.
  // Verified with `npx playwright test --config=playwright.checkly.config.ts
  // --list` (a safe, non-executing dry-run) before relying on this,
  // per the task's own instruction not to assume the glob is correct --
  // see the session report for the actual output.
  testDir: './__checks__',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: 'https://app.mapthemovie.co.uk',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
