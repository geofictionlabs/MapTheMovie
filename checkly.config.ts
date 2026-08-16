import { defineConfig } from 'checkly'

// Shape confirmed directly against the installed checkly CLI's own
// bundled onboarding template
// (node_modules/checkly/dist/ai-context/onboarding-boilerplate/checkly-config-template.ts)
// this session -- not guessed from memory or web docs, which were
// incomplete on this exact question. No checkly.config.ts existed yet;
// `npx checkly login` only authenticates, it doesn't scaffold a project.
//
// runtimeId and playwrightConfig (both present in an earlier version of
// this file) were removed once the project's one check became a
// PlaywrightCheck instead of a BrowserCheck: both are explicitly
// BrowserCheck/Multistep-only per
// node_modules/checkly/dist/ai-context/skills-command/references/configure-playwright-checks.md
// ("Do not use runtimeId for Playwright Check Suites"; playwrightConfig
// has no effect on a PlaywrightCheck, which gets its real Playwright
// config from playwrightConfigPath on the construct itself instead, see
// __checks__/hunt-monitor.check.ts). Leaving either in place would have
// been dead, misleading config now that no BrowserCheck exists in this
// project.
const config = defineConfig({
  projectName: 'MapTheMovie Production Monitoring',
  logicalId: 'mapthemovie-production-monitoring',
  checks: {
    // Defaults only -- the hunt-monitor check sets its own
    // frequency/locations explicitly and those take precedence.
    frequency: 60,
    locations: ['eu-west-2'],
    // Still needed: this is what makes the CLI discover
    // __checks__/hunt-monitor.check.ts at all, regardless of which
    // construct type is declared inside it.
    checkMatch: '**/__checks__/**/*.check.ts',
  },
  cli: {
    runLocation: 'eu-west-2',
    reporters: ['list'],
    retries: 0,
  },
})

export default config
