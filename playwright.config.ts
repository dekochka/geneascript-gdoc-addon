import { defineConfig, devices } from '@playwright/test';
import { DEFAULT_TEST_DOC_URL } from './e2e/constants';

/**
 * GeneaScript add-on E2E runs against a real Google Doc. You must supply a saved
 * Google session (see e2e/README.md). Use a doc URL that includes `addon_dry_run=...`
 * so the latest test deployment loads without Apps Script "Execute" each time.
 *
 * Auth: Uses a persistent Chrome profile directory (not storageState) because
 * Google's httpOnly auth cookies cannot be exported via Playwright's storageState.
 * Run `npx tsx e2e/save-auth.ts` to create the profile.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  // Per-test default. Tests that genuinely need longer (e.g. #16 batch
  // transcribe) call test.setTimeout() explicitly. Previously 10 min global.
  timeout: 3 * 60 * 1000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.GENEASCRIPT_TEST_DOC_URL || DEFAULT_TEST_DOC_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'en-US',
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },
  },
});
