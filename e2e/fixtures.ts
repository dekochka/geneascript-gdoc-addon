import { test as base, chromium, type Page, type BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistent Chromium profile with Google auth.
 * Created by `npx tsx e2e/save-auth.ts`.
 *
 * We copy it to a temp directory each run so it doesn't conflict with
 * other browser instances using the same profile.
 */
const SOURCE_PROFILE = process.env.GENEASCRIPT_USER_DATA_DIR || '/tmp/pw-geneascript-auth';
const RUN_PROFILE = '/tmp/pw-geneascript-e2e-run';

function copyProfile() {
  fs.rmSync(RUN_PROFILE, { recursive: true, force: true });
  fs.cpSync(SOURCE_PROFILE, RUN_PROFILE, {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      // Skip Chrome lock files that prevent reuse
      return !['SingletonSocket', 'SingletonLock', 'SingletonCookie', 'RunningChromeVersion'].includes(name);
    },
  });
}

export const test = base.extend<{ page: Page; context: BrowserContext }>({
  context: async ({}, use) => {
    copyProfile();
    const context = await chromium.launchPersistentContext(RUN_PROFILE, {
      headless: false,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
      locale: 'en-US',
      viewport: { width: 1280, height: 720 },
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
