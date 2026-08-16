import { PlaywrightCheck, Frequency } from 'checkly/constructs'

// Replaces the old BrowserCheck construct -- pg and @supabase/supabase-js
// aren't in Checkly's curated BrowserCheck runtime package list
// (confirmed this session, npx checkly test failed with
// DependencyParseError). PlaywrightCheck is the correct construct for a
// spec with real npm dependencies: it installs from this project's own
// package.json/lockfile natively, not a fixed runtime whitelist.
//
// API shape confirmed directly against the installed checkly CLI's own
// bundled reference doc this session
// (node_modules/checkly/dist/ai-context/skills-command/references/configure-playwright-checks.md)
// and PlaywrightCheckProps' own .d.ts
// (node_modules/checkly/dist/constructs/playwright-check.d.ts) -- not
// the checks.playwrightConfigPath/checks.playwrightChecks shape
// originally assumed for this step, which does not exist anywhere in
// either source. That shape appears to have been an unverified claim;
// the real API is this standalone construct, same pattern BrowserCheck
// used.
//
// playwrightConfigPath is resolved relative to THIS file, not the
// project root (confirmed in both sources) -- '../playwright.checkly.config.ts'
// is correct from __checks__/.
//
// Deliberately no pwTags/pwProjects here -- exclusion of
// e2e/00-smoke.spec.ts and e2e/01-hunt-loop.spec.ts is enforced by
// playwright.checkly.config.ts's own testDir scoping (verified this
// session via `npx playwright test --config=playwright.checkly.config.ts
// --list`: exactly 1 test, hunt-monitor.spec.ts, found), a structural
// guarantee rather than a tag that could be accidentally left off a
// future spec file.

new PlaywrightCheck('mapthemovie-hunt-monitor', {
  name: 'MapTheMovie -- production hunt loop monitor',
  playwrightConfigPath: '../playwright.checkly.config.ts',
  frequency: Frequency.EVERY_1H,
  locations: ['eu-west-2'],
})
