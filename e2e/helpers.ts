import type { Frame, Locator, Page } from '@playwright/test';
import * as readline from 'readline';
import { testDocUrl } from './constants';

/**
 * Prompt the test runner for a Gemini API key if none is configured for the
 * current test account. Cached per-process so it is asked at most once.
 * Returns null if the user declines (e.g. presses Enter with no input),
 * letting the caller skip the test.
 *
 * Precedence:
 *   1. GEMINI_API_KEY env var (set once, reuse for the whole run)
 *   2. Interactive stdin prompt
 */
let cachedApiKey: string | null | undefined;
export async function promptForGeminiKey(): Promise<string | null> {
  if (cachedApiKey !== undefined) return cachedApiKey;
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    cachedApiKey = process.env.GEMINI_API_KEY.trim();
    return cachedApiKey;
  }
  if (!process.stdin.isTTY) {
    console.warn(
      '\n[e2e] Gemini API key required for transcription tests but no TTY detected. ' +
        'Set GEMINI_API_KEY env var and re-run to enable tests 16-17.\n'
    );
    cachedApiKey = null;
    return null;
  }

  console.log('\n========================================================================');
  console.log('[e2e] Transcription tests (16-17) need a Gemini API key.');
  console.log('      Paste a key below (or press Enter to skip these tests).');
  console.log('      Get one at: https://aistudio.google.com/app/apikey');
  console.log('========================================================================');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) => {
    rl.question('Gemini API key: ', (input) => {
      rl.close();
      resolve(input);
    });
  });
  const trimmed = answer.trim();
  cachedApiKey = trimmed.length > 0 ? trimmed : null;
  return cachedApiKey;
}

/**
 * Save an API key via the add-on's saveApiKeyAndModel server function by
 * calling google.script.run from inside the sidebar frame. Returns true on
 * success. Requires the sidebar to be open and signed in.
 */
export async function saveGeminiKey(sidebar: Frame, apiKey: string): Promise<boolean> {
  return await sidebar.evaluate(async (key: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const runner = (window as any).google?.script?.run;
      if (!runner) { resolve(false); return; }
      runner
        .withSuccessHandler((r: any) => resolve(!!(r && r.ok)))
        .withFailureHandler(() => resolve(false))
        .saveApiKeyAndModel(key, null, null, null);
    });
  }, apiKey);
}

/** Manifest `addOns.common.name` (right rail icon tooltip varies). */
const ADDON_ICON_LABEL_RE =
  /Metric Book Transcriber|GeneaScript|Транскрибатор метричних книг/i;

const TOP_MENU_TITLE_RE =
  /GeneaScript(\s*[-–]\s*Metric Book Transcriber)?|Транскрибатор метричних книг/i;

const OPEN_SIDEBAR_BTN_RE =
  /Open Sidebar|Open Transcriber Sidebar|Відкрити бічну панель|Открыть боковую панель/i;

export function requireStorageState(): void {
  if (!process.env.PLAYWRIGHT_STORAGE_STATE) {
    throw new Error(
      'Set PLAYWRIGHT_STORAGE_STATE to the path of a Playwright storage state JSON file ' +
        '(see e2e/README.md). Example: export PLAYWRIGHT_STORAGE_STATE=$PWD/e2e/.auth/google.json'
    );
  }
}

export async function openGeneascriptSidebar(page: Page): Promise<Frame> {
  await page.goto(testDocUrl(), {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  // Handle "Choose an account" page — click the account if it appears
  try {
    const chooseAccount = page.getByText(/Choose an account|Виберіть обліковий запис|Выберите аккаунт/i);
    if (await chooseAccount.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click the first account — try data-email attr first, then button with email text
      const dataEmailBtn = page.locator('[data-email]').first();
      if (await dataEmailBtn.count() > 0) {
        await dataEmailBtn.click({ timeout: 10_000 });
      } else {
        await page.getByRole('button', { name: /geneascript/i }).first().click({ timeout: 10_000 });
      }
      // Wait for the post-chooser redirect back to the doc URL instead of a fixed sleep.
      await page.waitForURL(/docs\.google\.com/, { timeout: 30_000 }).catch(() => {});
    }
  } catch { /* not on account chooser page */ }

  // Docs can sit on "Loading…" but 60s is plenty; beyond that something is wrong.
  await page.getByRole('menubar').waitFor({ state: 'visible', timeout: 60_000 });

  // Google sometimes pops open the account/avatar card in the top-right
  // after the doc loads ("Hi, Name — Manage your Google Account"). It sits
  // above the sidebar and can intercept clicks. Dismiss it unconditionally.
  await dismissAccountPopup(page);

  async function openViaRailAndCard() {
    await page.getByRole('button', { name: ADDON_ICON_LABEL_RE }).first().click({ timeout: 20_000 });
    await page.getByRole('button', { name: OPEN_SIDEBAR_BTN_RE }).click({ timeout: 30_000 });
  }

  async function openViaTopMenu() {
    // Click Extensions menu first, then hover the add-on submenu to expand it
    await page.getByRole('menuitem', { name: /Extensions|Розширення|Расширения/i }).click({ timeout: 20_000 });
    const addonItem = page.getByRole('menuitem', { name: TOP_MENU_TITLE_RE });
    // Google Docs submenus open on hover, not click — click on a submenu parent dismisses the menu
    await addonItem.hover({ timeout: 20_000 });
    await page.getByRole('menuitem', { name: OPEN_SIDEBAR_BTN_RE }).click({ timeout: 20_000 });
  }

  try {
    await openViaRailAndCard();
  } catch {
    await openViaTopMenu();
  }

  return waitForSidebarFrame(page);
}

export async function waitForSidebarFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const url = frame.url();
      if (!url.includes('googleusercontent.com') && !url.includes('script.google.com')) continue;
      const probe = frame.locator('[data-testid="geneascript-import"]');
      try {
        if ((await probe.count()) > 0) {
          await probe.first().waitFor({ state: 'visible', timeout: 5000 });
          return frame;
        }
      } catch {
        /* next frame */
      }
    }
    await page.waitForTimeout(500);
  }
  // Detect Marketplace install dialog — this is the common failure mode when
  // the signed-in user has not installed the add-on yet.
  const marketplaceOpen = await page.getByRole('heading', { name: /Google Workspace Marketplace/i }).isVisible().catch(() => false);
  if (marketplaceOpen) {
    throw new Error(
      'GeneaScript sidebar not found: the Google Workspace Marketplace install dialog is showing. ' +
        'The signed-in user does not have the add-on installed. Install it manually for this user once, ' +
        'then re-run npx tsx e2e/save-auth.ts to refresh the profile.'
    );
  }
  throw new Error(
    'GeneaScript sidebar iframe not found (expected [data-testid="geneascript-import"]). ' +
      'Confirm the doc URL uses addon_dry_run for your test deployment and the add-on opens the sidebar.'
  );
}

export async function findFrameContaining(
  page: Page,
  predicate: (frame: Frame) => Promise<boolean>
): Promise<Frame | null> {
  for (const frame of page.frames()) {
    try {
      if (await predicate(frame)) return frame;
    } catch {
      /* ignore */
    }
  }
  return null;
}

/** Modal dialogs from HtmlService often appear in a fresh iframe. */
export async function waitForModalText(page: Page, text: string | RegExp): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const frame = await findFrameContaining(page, async (f) => {
      const loc = f.getByText(text, { exact: false });
      return (await loc.count()) > 0;
    });
    if (frame) return frame;
    await page.waitForTimeout(400);
  }
  throw new Error(`No modal iframe contained text matching: ${text}`);
}

export function sidebarImport(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-import"]');
}

export function sidebarSetupAi(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-setup-ai"]');
}

export function sidebarTemplateGallery(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-template-gallery"]');
}

export function sidebarExtract(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-extract"]');
}

export function sidebarRefresh(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-refresh"]');
}

export function sidebarTranscribe(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-transcribe"]');
}

export function sidebarImageCheckboxes(sidebar: Frame): Locator {
  return sidebar.locator('.image-list input.ic[type="checkbox"]');
}

export function sidebarErrorBanner(sidebar: Frame): Locator {
  return sidebar.locator('#errorBanner');
}

export function sidebarKeyBanner(sidebar: Frame): Locator {
  return sidebar.locator('#keyBanner');
}

export function sidebarStop(sidebar: Frame): Locator {
  return sidebar.locator('[data-testid="geneascript-stop"]');
}

export function sidebarImageCount(sidebar: Frame): Locator {
  return sidebar.locator('#imgCount');
}

export function sidebarProgressText(sidebar: Frame): Locator {
  return sidebar.locator('#progText');
}

export function sidebarEmptyState(sidebar: Frame): Locator {
  return sidebar.locator('.empty-state');
}

/**
 * Dismiss the Google account/avatar popup ("Hi, X — Manage your Google
 * Account") that sometimes auto-opens in the top-right of Google Docs and
 * intercepts clicks near the sidebar. Closing it is safe and idempotent;
 * if no popup is open this is a no-op.
 */
export async function dismissAccountPopup(page: Page): Promise<void> {
  // Strategy: press Escape (cheap, works when the popup is focused) + click
  // elsewhere in the doc to move focus away from the avatar. If a dedicated
  // close button exists, click it too.
  try {
    const closeBtn = page.getByRole('button', { name: /Close|Закрити|Закрыть/i }).first();
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click({ timeout: 2000 }).catch(() => {});
    }
  } catch { /* no close button */ }
  // Press Escape in case the popup is still open without a visible button.
  await page.keyboard.press('Escape').catch(() => {});
}

/**
 * Disable the Material Design dialog scrim overlay that blocks clicks on
 * Apps Script modal dialog elements rendered in nested iframes. Also kills
 * the Docs "Companion" / feedback-tooltip overlay ([data-fb]) which sits on
 * top of #docs-chrome.companion-enabled and intercepts pointer events on
 * the sidebar iframe area.
 */
export async function disableScrim(page: Page): Promise<void> {
  await page.evaluate(() => {
    const selectors = [
      '.javascriptMaterialdesignGm3WizDialog-dialog__scrim',
      '[class*="WizDialog-dialog__scrim"]',
      '[class*="WizDialog-dialog"]',
      '[data-fb]',
      '#docs-chrome .docs-promotion-tooltip',
      '.docs-promotion-chip',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'none';
      });
    }
    document.querySelectorAll('[class*="WizDialog-dialog__content"]').forEach((el) => {
      (el as HTMLElement).style.pointerEvents = 'auto';
    });
  });
}

/**
 * Click a sidebar button robustly, bypassing occasional Docs overlays
 * (`[data-fb]`, companion banner) that intercept pointer events.
 * Uses a JS .click() dispatched inside the sidebar frame — works even when
 * Playwright considers the element "unstable" due to off-frame overlays.
 */
export async function safeSidebarClick(locator: Locator): Promise<void> {
  await locator.waitFor({ state: 'visible', timeout: 30_000 });
  // Prefer a real user click; if overlays intercept it, dispatch a JS click
  // inside the frame which bypasses pointer-event interception entirely.
  try {
    await locator.click({ timeout: 5000 });
  } catch {
    await locator.evaluate((el) => (el as HTMLElement).click());
  }
}

/**
 * Find the gallery dialog frame by looking for a known element (#previewToggle).
 */
export async function findGalleryFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const count = await frame.locator('#previewToggle').count();
        if (count > 0) return frame;
      } catch { /* skip */ }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Gallery frame with #previewToggle not found');
}

/**
 * Find the custom template editor dialog frame by looking for #tplName input.
 */
export async function findEditorFrame(page: Page): Promise<Frame> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const count = await frame.locator('#tplName').count();
        if (count > 0) return frame;
      } catch { /* skip */ }
    }
    await page.waitForTimeout(500);
  }
  throw new Error('Editor frame with #tplName not found');
}

/** Select all document content and delete it. */
export async function clearDocument(page: Page): Promise<void> {
  // Click into the document editing area first
  await page.locator('.kix-appview-editor').click({ timeout: 30_000 });
  // Select all and delete
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.press('Backspace');
  // Brief wait for Google Docs to sync the deletion
  await page.waitForTimeout(500);
}
