import { defineConfig, devices } from '@playwright/test';

// Confirmed empirically this session: `npm run dev` (package.json's "dev"
// script, plain `vite`, no explicit server.port in vite.config.js) listens
// on 5173, Vite's default -- checked via netstat + a direct curl against
// the running process, not assumed.
const DEV_SERVER_URL = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',

  use: {
    baseURL: DEV_SERVER_URL,
    // Trafalgar Square -- matches scripts/012_seed_fixed_test_hunt.sql's
    // fixed puzzle real_lat/real_lon exactly (51.5080, -0.1281).
    geolocation: { latitude: 51.5080, longitude: -0.1281 },
    permissions: ['geolocation'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  webServer: {
    // --mode staging loads .env.staging on top of .env (Vite's own
    // mode-specific env file convention), overriding VITE_SUPABASE_URL/
    // VITE_SUPABASE_ANON_KEY to point at staging instead of whatever
    // .env has. Verified directly via vite's loadEnv() before relying on
    // it: mode=staging resolves to dlypoersysiovufzaigv, default mode
    // resolves to the production project in .env -- confirmed, not
    // assumed. Invokes the vite binary directly rather than `npm run
    // dev` so the --mode flag isn't subject to npm's argument-passing
    // quirks on Windows.
    command: 'npx vite --mode staging',
    url: DEV_SERVER_URL,
    reuseExistingServer: true,
    timeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
