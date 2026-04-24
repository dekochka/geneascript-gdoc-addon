import { test as base, chromium, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistent Chromium profile with Google auth.
 * Created by `npx tsx e2e/save-auth.ts`.
 *
 * We launch the source profile directly. Copying to a scratch dir breaks
 * Google auth because Chrome's v10 cookie encryption binds to the original
 * profile path / OS keychain scope, so copied cookies fail to decrypt and
 * the session appears signed out.
 *
 * Side-effects: don't run two test processes simultaneously against this
 * profile (Chrome locks SingletonSocket). Tests run serially, so fine.
 */
const SOURCE_PROFILE = process.env.GENEASCRIPT_USER_DATA_DIR || '/tmp/pw-geneascript-auth';

function clearSingletonLocks() {
  for (const name of ['SingletonSocket', 'SingletonLock', 'SingletonCookie', 'RunningChromeVersion']) {
    fs.rmSync(path.join(SOURCE_PROFILE, name), { force: true });
  }
}

export const test = base.extend<{ page: Page; context: BrowserContext }>({
  context: async ({}, use) => {
    clearSingletonLocks();
    const context = await chromium.launchPersistentContext(SOURCE_PROFILE, {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      locale: process.env.GENEASCRIPT_LOCALE || 'en-US',
      viewport: { width: 1280, height: 720 },
      recordVideo: process.env.GENEASCRIPT_RECORD_VIDEO === '1'
        ? { dir: 'test-results/videos', size: { width: 1280, height: 720 } }
        : undefined,
    });

    // Spoof navigator.webdriver so Google Docs loads add-ons normally
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    const page = context.pages()[0] || await context.newPage();
    await use(page);
  },
});

export { expect } from '@playwright/test';
