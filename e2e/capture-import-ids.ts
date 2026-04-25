/**
 * Helper: capture Drive file IDs from the test import folder so test #6 can
 * use the fast-path (importFromDriveFileIds) instead of the brittle picker.
 *
 * Usage:
 *   npx tsx e2e/capture-import-ids.ts
 *
 * Steps:
 *   1. Launches Chromium using the saved profile (/tmp/pw-geneascript-auth)
 *   2. Opens the test doc, waits for the sidebar to load
 *   3. Opens the Drive picker via the sidebar Import button
 *   4. YOU step through the picker manually: navigate to the test folder,
 *      select the 6 test images, click Select
 *   5. The script captures the file IDs passed to importFromDriveFileIds by
 *      intercepting google.script.run calls
 *   6. Prints the IDs in the format expected by e2e/constants.ts
 *
 * Paste the output into IMPORT_TEST_FILE_IDS in e2e/constants.ts (they are
 * not secret — they're file IDs, not access tokens).
 */
import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { testDocUrl } from './constants';

const PROFILE_DIR = process.env.GENEASCRIPT_USER_DATA_DIR || '/tmp/pw-geneascript-auth';

async function main() {
  // Clear Chromium singleton locks so we can reuse the profile.
  for (const name of ['SingletonSocket', 'SingletonLock', 'SingletonCookie', 'RunningChromeVersion']) {
    try { fs.rmSync(path.join(PROFILE_DIR, name), { force: true }); } catch {}
  }

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    ignoreDefaultArgs: ['--enable-automation'],
    viewport: { width: 1280, height: 720 },
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = context.pages()[0] || await context.newPage();

  // Intercept google.script.run.importFromDriveFileIds calls. The script
  // stashes the IDs on window.__capturedImportIds so we can read them
  // from the Node side.
  await context.addInitScript(() => {
    (window as any).__capturedImportIds = null;
    const install = () => {
      const gs: any = (window as any).google?.script;
      if (!gs || !gs.run) { setTimeout(install, 500); return; }
      const origRun = gs.run;
      // google.script.run returns a "builder" object we chain methods on.
      // Wrap the builder so that when importFromDriveFileIds is called we
      // capture its argument and still let the call proceed.
      const wrap = (builder: any): any => {
        return new Proxy(builder, {
          get(target, prop, receiver) {
            const orig = Reflect.get(target, prop, receiver);
            if (typeof orig !== 'function') return orig;
            return (...args: any[]) => {
              if (prop === 'importFromDriveFileIds') {
                (window as any).__capturedImportIds = args[0];
                // eslint-disable-next-line no-console
                console.log('[capture] importFromDriveFileIds ids:', args[0]);
              }
              const r = orig.apply(target, args);
              return r && typeof r === 'object' ? wrap(r) : r;
            };
          },
        });
      };
      Object.defineProperty(gs, 'run', {
        get() { return wrap(origRun); },
        configurable: true,
      });
    };
    install();
  });

  await page.goto(testDocUrl(), { waitUntil: 'domcontentloaded', timeout: 120_000 });

  console.log('\n=== MANUAL STEPS ===');
  console.log('1. Wait for the Google Doc + GeneaScript sidebar to load');
  console.log('2. In the sidebar, click "Import from Drive Files"');
  console.log('3. In the picker dialog, navigate into:');
  console.log(`   "${'ДАТО ф487о1с545 1894 Турильче Вербівки народж - приклад'}"`);
  console.log('4. Switch to list view, sort by name');
  console.log('5. Select the 6 test images (cover-title-page + image00001..image00005)');
  console.log('6. Click "Select"');
  console.log('7. The IDs will be captured; return here.');
  console.log('====================\n');

  // Poll for the captured IDs
  const deadline = Date.now() + 10 * 60 * 1000;
  let ids: string[] | null = null;
  while (Date.now() < deadline) {
    ids = await page.evaluate(() => (window as any).__capturedImportIds || null).catch(() => null);
    if (ids && ids.length > 0) break;
    await page.waitForTimeout(2000);
  }

  if (!ids || ids.length === 0) {
    console.error('\n[capture] Timed out waiting for importFromDriveFileIds call. No IDs captured.');
    await context.close();
    process.exit(1);
  }

  console.log('\n========================================================================');
  console.log('Captured Drive file IDs:');
  console.log('========================================================================\n');
  console.log('export const IMPORT_TEST_FILE_IDS: string[] = [');
  for (const id of ids) console.log(`  '${id}',`);
  console.log('];\n');
  console.log('Paste the above into e2e/constants.ts, replacing the existing');
  console.log('IMPORT_TEST_FILE_IDS declaration. Then close this browser.\n');

  // Leave the browser open so the user can finish the picker flow without interrupting.
  // User closes it manually.
}

main().catch((err) => { console.error(err); process.exit(1); });
