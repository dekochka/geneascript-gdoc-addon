/**
 * Generate Playwright storage state for Google sign-in.
 * Uses Playwright's bundled Chromium with automation detection spoofed.
 *
 * Usage:
 *   npx tsx e2e/save-auth.ts
 *
 * Steps:
 *   1. Chromium opens to accounts.google.com
 *   2. Sign in as geneascript.support@gmail.com
 *   3. Navigate to the test doc URL (printed in console)
 *   4. Wait for the doc + GeneaScript menu to load
 *   5. Come back to the terminal and press Enter — session is saved
 */
import { chromium } from 'playwright';
import * as readline from 'readline';
import { testDocUrl } from './constants';

const PROFILE_DIR = process.env.GENEASCRIPT_USER_DATA_DIR || '/tmp/pw-geneascript-auth';

async function main() {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
    ],
    ignoreDefaultArgs: ['--enable-automation'],
  });

  // Spoof navigator.webdriver so Google doesn't detect automation
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://accounts.google.com', { waitUntil: 'domcontentloaded' });

  console.log('\n=== MANUAL STEPS ===');
  console.log('1. Sign in as geneascript.support@gmail.com in the browser');
  console.log('2. Then paste this URL in the address bar:');
  console.log(`   ${testDocUrl()}`);
  console.log('3. Wait for the doc to load and GeneaScript menu to appear under Extensions');
  console.log('4. Come back HERE and press Enter to save the session');
  console.log('====================\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => {
    rl.question('Press Enter after the doc + add-on are loaded...', () => {
      rl.close();
      resolve();
    });
  });

  await context.storageState({ path: 'e2e/.auth/google.json' });
  console.log(`\nSession saved to e2e/.auth/google.json`);
  console.log(`Profile saved to ${PROFILE_DIR}`);

  await context.close();
}

main().catch(console.error);
