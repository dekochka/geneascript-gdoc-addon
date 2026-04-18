import type { Frame, Locator, Page } from '@playwright/test';
import { testDocUrl } from './constants';

/** Manifest `addOns.common.name` (right rail icon tooltip varies). */
const ADDON_ICON_LABEL_RE =
  /Metric Book Transcriber|GeneaScript|Транскрибатор метричних книг/i;

const TOP_MENU_TITLE_RE =
  /^GeneaScript$/i;

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
    const chooseAccount = page.getByText('Choose an account');
    if (await chooseAccount.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click the first account (geneascript.support@gmail.com)
      await page.locator('[data-email]').first().click({ timeout: 10_000 });
      await page.waitForTimeout(3000);
    }
  } catch { /* not on account chooser page */ }

  // Docs can sit on "Loading…" for a long time; wait for the editor surface.
  await page.getByRole('menubar').waitFor({ state: 'visible', timeout: 180_000 });

  async function openViaRailAndCard() {
    await page.getByRole('button', { name: ADDON_ICON_LABEL_RE }).first().click({ timeout: 20_000 });
    await page.getByRole('button', { name: OPEN_SIDEBAR_BTN_RE }).click({ timeout: 30_000 });
  }

  async function openViaTopMenu() {
    // Click Extensions menu first, then find the add-on submenu
    await page.getByRole('menuitem', { name: /Extensions/i }).click({ timeout: 20_000 });
    await page.getByRole('menuitem', { name: TOP_MENU_TITLE_RE }).click({ timeout: 20_000 });
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

/** Select all document content and delete it. */
export async function clearDocument(page: Page): Promise<void> {
  // Click into the document editing area first
  await page.locator('.kix-appview-editor').click({ timeout: 30_000 });
  // Select all and delete
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+a`);
  await page.keyboard.press('Backspace');
  // Brief wait for Google Docs to sync the deletion
  await page.waitForTimeout(2000);
}
