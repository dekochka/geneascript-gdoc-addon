import { test, expect } from './fixtures';
import {
  openGeneascriptSidebar,
  clearDocument,
  disableScrim,
  findGalleryFrame,
  findEditorFrame,
  sidebarExtract,
  sidebarImport,
  sidebarRefresh,
  sidebarSetupAi,
  sidebarTemplateGallery,
  sidebarTranscribe,
  sidebarImageCheckboxes,
  sidebarKeyBanner,
  sidebarImageCount,
  sidebarProgressText,
  sidebarEmptyState,
  waitForModalText,
  waitForSidebarFrame,
} from './helpers';
import { IMPORT_FOLDER_SEARCH, IMPORT_IMAGE_COUNT } from './constants';

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// 1. Blank out test document
// ---------------------------------------------------------------------------
test('GeneaScript: blank out test document', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  void sidebar; // sidebar opened as side-effect; we work on the doc itself

  await clearDocument(page);
  await page.screenshot({ path: 'test-results/01-blank-doc.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// 2. Menu and sidebar open correctly
// ---------------------------------------------------------------------------
test('GeneaScript: open card, sidebar, core controls', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  await expect(sidebarImport(sidebar)).toBeVisible();
  await expect(sidebarSetupAi(sidebar)).toBeVisible();
  await expect(sidebarExtract(sidebar)).toBeVisible();
  await expect(sidebarTemplateGallery(sidebar)).toBeVisible();
  await expect(sidebarRefresh(sidebar)).toBeVisible();
  await expect(sidebarTranscribe(sidebar)).toBeVisible();
});

// ---------------------------------------------------------------------------
// 3. Empty doc: no images for refresh
// ---------------------------------------------------------------------------
test('GeneaScript: empty doc — no images for refresh', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  await sidebarRefresh(sidebar).click();
  // After refresh on an empty doc, expect zero image count
  await expect(sidebarImageCount(sidebar)).toHaveText('0', { timeout: 120_000 });
});

// ---------------------------------------------------------------------------
// 4. Setup AI dialog
// ---------------------------------------------------------------------------
test('GeneaScript: Setup AI dialog', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarSetupAi(sidebar).click();

  const dlg = await waitForModalText(page, /Setup AI|Налаштування ШІ|Настройка ИИ/i);
  await expect(dlg.locator('select, input').first()).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press('Escape');
});

// ---------------------------------------------------------------------------
// 5. No API key banner (skip if key configured)
// ---------------------------------------------------------------------------
test('GeneaScript: no API key banner', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  const keyBanner = sidebarKeyBanner(sidebar);
  const bannerVisible = await keyBanner.isVisible().catch(() => false);

  if (!bannerVisible) {
    test.skip(true, 'API key is already configured — cannot test missing-key state.');
    return;
  }

  await expect(keyBanner).toBeVisible();
  // When key is missing, Transcribe and Extract should be disabled
  await expect(sidebarTranscribe(sidebar)).toBeDisabled();
  await expect(sidebarExtract(sidebar)).toBeDisabled();
});

// ---------------------------------------------------------------------------
// 6. Import images from Drive
// ---------------------------------------------------------------------------
test('GeneaScript: Import images from Drive', async ({ page }) => {
  if (process.env.GENEASCRIPT_RUN_IMPORT_PICKER !== '1') {
    test.skip(true, 'Set GENEASCRIPT_RUN_IMPORT_PICKER=1 to run the full import flow.');
    return;
  }

  const sidebar = await openGeneascriptSidebar(page);
  await sidebarImport(sidebar).click();

  // The Google Picker is inside an Apps Script dialog, rendered in nested iframes.
  // A Material Design dialog scrim overlays the iframe in the main frame, blocking
  // Playwright's locator.click(). Solution: temporarily disable pointer-events on
  // the scrim overlay via CSS manipulation, then click normally.

  // Wait for the dialog to fully load
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/06-picker-dialog.png', fullPage: true });

  // Disable the Material Design dialog scrim so picker elements become clickable.
  // The scrim is a div with class containing "javascriptMaterialdesignGm3WizDialog"
  // in the main frame that intercepts all pointer events over the dialog iframe.
  async function disableScrim(): Promise<void> {
    await page.evaluate(() => {
      // Target scrim overlays and dialog containers that intercept pointer events
      const selectors = [
        '.javascriptMaterialdesignGm3WizDialog-dialog__scrim',
        '[class*="WizDialog-dialog__scrim"]',
        '[class*="WizDialog-dialog"]',
      ];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el) => {
          (el as HTMLElement).style.pointerEvents = 'none';
        });
      }
      // Also ensure iframe containers allow pointer events through
      document.querySelectorAll('[class*="WizDialog-dialog__content"]').forEach((el) => {
        (el as HTMLElement).style.pointerEvents = 'auto';
      });
    });
  }

  // Find the picker frame — it contains Google Picker elements (doclist classes)
  async function findPickerFrame(): Promise<import('@playwright/test').Frame> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      for (const frame of page.frames()) {
        if (frame === page.mainFrame()) continue;
        try {
          const count = await frame.locator('[aria-label="List view"], .doclist-grid-doc-thumb, [data-type]').count();
          if (count > 0) return frame;
        } catch { /* skip */ }
      }
      await page.waitForTimeout(1000);
    }
    throw new Error('Picker frame not found');
  }

  await disableScrim();
  const picker = await findPickerFrame();

  // Step 1: Navigate into the target folder by double-clicking
  const folderText = picker.getByText(/ДАТО ф487/i).first();
  await folderText.dblclick({ timeout: 30_000 });
  await page.waitForTimeout(4000);

  await page.screenshot({ path: 'test-results/06-picker-in-folder.png', fullPage: true });

  // Re-disable scrim after navigation (dialog may re-render)
  await disableScrim();

  // The picker elements exist in deeply nested iframes. Some (like folder text)
  // are accessible via locator.click(), but others (like List View button) have
  // zero bounding box in the frame Playwright finds them in. For those, we use
  // CDP Input.dispatchMouseEvent to send trusted mouse events at viewport coords.
  const cdp = await page.context().newCDPSession(page);
  async function cdpClick(x: number, y: number, opts?: { shift?: boolean }): Promise<void> {
    if (opts?.shift) await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Shift', code: 'ShiftLeft', modifiers: 8 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: opts?.shift ? 8 : 0 });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: opts?.shift ? 8 : 0 });
    if (opts?.shift) await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Shift', code: 'ShiftLeft', modifiers: 0 });
  }

  // Step 2: Switch to List View — the icon button is at top-right of picker
  // From consistent screenshots (1280x720 viewport), the list view icon is at ~(1053, 235)
  await cdpClick(1053, 235);
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/06-picker-list-view.png', fullPage: true });

  // Step 3: Sort by name — click the "Name" column header
  // From screenshots: "Name" header is at y≈303, files start at y≈349
  // The column header is a thin row above the first file
  await cdpClick(170, 303);
  await page.waitForTimeout(1000);
  // Click again if already sorted ascending (to ensure ascending order)
  await page.screenshot({ path: 'test-results/06-picker-sorted.png', fullPage: true });

  // Step 4: Select files — click first file, then Shift+click last for range select
  // After sorting by Name ascending, order is:
  //   cover-title-page.jpg (row 1, y≈349)
  //   image00001.jpg       (row 2, y≈397)
  //   image00002.jpg       (row 3, y≈445)
  //   image00003.jpg       (row 4, y≈493)
  //   image00004.jpg       (row 5, y≈541)
  //   image00005.jpg       (row 6, y≈589)
  //   image00006.jpg       (row 7)
  //   image00007.jpg       (row 8)
  // Click first file (cover-title-page.jpg)
  await cdpClick(300, 349);
  await page.waitForTimeout(300);

  // Shift+click image00005.jpg (row 6) to select range of 6 files
  await cdpClick(300, 589, { shift: true });
  await page.waitForTimeout(500);

  await page.screenshot({ path: 'test-results/06-picker-selected.png', fullPage: true });

  // Step 5: Click Select button — from screenshots it's at bottom-left ~(185, 638)
  await cdpClick(185, 638);
  await page.waitForTimeout(2000);

  // Step 6: Handle "Importing" confirmation dialog — click OK button
  // The dialog is a Google Apps Script alert rendered on top of the page.
  // Wait for it to appear, then click OK via CDP at its coordinates or find it in frames.
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/06-import-confirm.png', fullPage: true });

  const okDeadline = Date.now() + 30_000;
  let okClicked = false;
  while (Date.now() < okDeadline && !okClicked) {
    // Try page-level OK button first (Apps Script alerts render in main frame)
    try {
      const okBtn = page.getByRole('button', { name: /^OK$/i }).first();
      if ((await okBtn.count()) > 0 && await okBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await okBtn.click({ timeout: 3000 });
        okClicked = true;
        break;
      }
    } catch { /* skip */ }

    // Try CDP click at typical OK button position (~860, 415 from screenshot)
    if (!okClicked) {
      await cdpClick(860, 415);
      await page.waitForTimeout(1000);
      // Check if dialog closed by seeing if sidebar is accessible
      try {
        const refreshVisible = await sidebarRefresh(sidebar).isVisible({ timeout: 1000 });
        if (refreshVisible) { okClicked = true; break; }
      } catch { /* dialog still open */ }
    }

    // Also try all frames
    if (!okClicked) {
      for (const frame of page.frames()) {
        try {
          const okBtn = frame.getByRole('button', { name: /^OK$/i }).first();
          if ((await okBtn.count()) > 0) {
            const box = await okBtn.boundingBox();
            if (box && box.width > 0) {
              await cdpClick(box.x + box.width / 2, box.y + box.height / 2);
              okClicked = true;
              break;
            }
          }
        } catch { /* skip */ }
      }
    }
    if (!okClicked) await page.waitForTimeout(1000);
  }

  // Wait for import to complete — the dialog shows "Importing N images..."
  // then closes automatically. Wait up to 3 minutes for it.
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'test-results/06-importing.png', fullPage: true });

  // Wait for the "Import Drive Images" dialog to close.
  // Try closing it via the X button or Escape, and wait for sidebar to be accessible.
  const importDeadline = Date.now() + 180_000;
  while (Date.now() < importDeadline) {
    // Check if dialog is gone by trying to access sidebar
    await disableScrim();
    try {
      const refreshBtn = sidebarRefresh(sidebar);
      if (await refreshBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
        // Try clicking — if it works, dialog is gone
        try {
          await refreshBtn.click({ timeout: 3000 });
          break; // Success — dialog closed and sidebar accessible
        } catch { /* still blocked */ }
      }
    } catch { /* skip */ }

    // Try to close any remaining dialog/overlay
    // Close button (X) of "Import Drive Images" is at approximately (1143, 63)
    await cdpClick(1143, 63);
    await page.waitForTimeout(1000);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(2000);
  }

  // After import dialog closes, the sidebar iframe may have stale state.
  // Reload the page to get a clean sidebar, then verify imported images.
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
  const freshSidebar = await openGeneascriptSidebar(page);

  await sidebarRefresh(freshSidebar).click({ timeout: 30_000 });
  const boxes = sidebarImageCheckboxes(freshSidebar);
  // Verify at least IMPORT_IMAGE_COUNT images exist (may have more from previous imports)
  await expect(boxes.first()).toBeVisible({ timeout: 120_000 });
  const count = await boxes.count();
  expect(count).toBeGreaterThanOrEqual(IMPORT_IMAGE_COUNT);

  // Screenshot showing doc with imported images
  await page.screenshot({ path: 'test-results/06-after-import.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// 7. Refresh image list
// ---------------------------------------------------------------------------
test('GeneaScript: refresh image list', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  await sidebarRefresh(sidebar).click();
  const boxes = sidebarImageCheckboxes(sidebar);
  await expect(boxes.first()).toBeVisible({ timeout: 120_000 });

  const count = await boxes.count();
  expect(count).toBeGreaterThanOrEqual(1);
  await expect(sidebarImageCount(sidebar)).not.toHaveText('0', { timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 8. No image selected: transcribe disabled
// ---------------------------------------------------------------------------
test('GeneaScript: no image selected — transcribe disabled', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  // Wait for image list to load
  await sidebarRefresh(sidebar).click();
  await expect(sidebarImageCheckboxes(sidebar).first()).toBeVisible({ timeout: 120_000 });

  // Ensure no checkboxes are checked
  const boxes = sidebarImageCheckboxes(sidebar);
  const count = await boxes.count();
  for (let i = 0; i < count; i++) {
    await boxes.nth(i).uncheck();
  }

  // Transcribe button should be disabled when nothing is selected
  await expect(sidebarTranscribe(sidebar)).toBeDisabled({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 9. Extract Context dialog
// ---------------------------------------------------------------------------
test('GeneaScript: Extract Context dialog', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);

  // Refresh and select first image
  await sidebarRefresh(sidebar).click();
  const boxes = sidebarImageCheckboxes(sidebar);
  await expect(boxes.first()).toBeVisible({ timeout: 120_000 });
  await boxes.nth(0).check();

  await expect(sidebarExtract(sidebar)).toBeEnabled();
  await sidebarExtract(sidebar).click();

  const extractDlg = await waitForModalText(
    page,
    /Cover Image|Обкладинка|Обложка|Extract metadata|Витягніть метадані|Извлеките метаданные/i
  );
  await expect(extractDlg.locator('#extractBtn, button').first()).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press('Escape');
});

// ---------------------------------------------------------------------------
// 10. Template Gallery elements and selection
// ---------------------------------------------------------------------------
test('GeneaScript: Template Gallery preview tabs', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarTemplateGallery(sidebar).click();

  await disableScrim(page);
  const gal = await findGalleryFrame(page);

  // Toggle preview pane
  await gal.locator('#previewToggle').click({ timeout: 30_000 });
  await expect(gal.locator('#previewWrap.open')).toBeVisible({ timeout: 30_000 });

  // Cycle through all 5 tabs
  const tabs = [
    /Context|Контекст/i,
    /Role|Роль/i,
    /Columns|Колонки/i,
    /Output Format|Формат виводу|Формат вывода/i,
    /Instructions|Інструкції|Инструкции/i,
  ];
  for (const tRe of tabs) {
    await disableScrim(page);
    await gal.getByRole('button', { name: tRe }).click({ timeout: 30_000 });
    await expect(gal.locator('#tabContent')).not.toBeEmpty({ timeout: 30_000 });
  }

  await disableScrim(page);
  await gal.getByRole('button', { name: /Cancel|Скасувати|Отмена/i }).click({ timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 11. Custom Templates: My Templates section visible
// ---------------------------------------------------------------------------
test('GeneaScript: gallery shows My Templates section', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarTemplateGallery(sidebar).click();

  await disableScrim(page);
  const gal = await findGalleryFrame(page);

  // "My Templates" section should be present (empty state or with cards)
  await expect(
    gal.getByText(/My Templates|Мої шаблони|Мои шаблоны/i).first()
  ).toBeVisible({ timeout: 30_000 });

  // Create buttons should be visible
  await expect(
    gal.getByText(/Create from Template|Створити з шаблону|Создать из шаблона/i).first()
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    gal.getByText(/Create Blank|Створити порожній|Создать пустой/i).first()
  ).toBeVisible({ timeout: 15_000 });

  await page.screenshot({ path: 'test-results/11-gallery-my-templates.png', fullPage: true });

  await disableScrim(page);
  await gal.getByRole('button', { name: /Cancel|Скасувати|Отмена/i }).click({ timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 12. Custom Templates: Create blank, fill editor, save
// ---------------------------------------------------------------------------
test('GeneaScript: create blank custom template', async ({ page }) => {
  test.setTimeout(180_000);
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarTemplateGallery(sidebar).click();

  await disableScrim(page);
  const gal = await findGalleryFrame(page);

  // Click "Create Blank"
  await disableScrim(page);
  await gal.getByText(/Create Blank|Створити порожній|Создать пустой/i).first().click({ timeout: 30_000 });

  // Wait for the editor dialog to open (replaces gallery)
  await page.waitForTimeout(3000);
  await disableScrim(page);
  const editor = await findEditorFrame(page);

  // Fill in name and description
  await editor.locator('#tplName').fill('E2E Test Template', { timeout: 15_000 });
  await editor.locator('#tplDesc').fill('Automated test template for E2E', { timeout: 15_000 });

  // Fill in Role section (first tab, already active)
  await editor.locator('#sec_role').fill('You are an E2E test transcription specialist.', { timeout: 15_000 });

  // Switch to Input Structure tab and fill
  await disableScrim(page);
  await editor.getByRole('button', { name: /Input Structure|Структура введення|Структура ввода/i }).click({ timeout: 15_000 });
  await editor.locator('#sec_inputStructure').fill('Test input structure content.', { timeout: 15_000 });

  // Switch to Output Format tab and verify it has separate content
  await disableScrim(page);
  await editor.getByRole('button', { name: /Output Format|Формат виводу|Формат вывода/i }).click({ timeout: 30_000 });
  const outputVal = await editor.locator('#sec_outputFormat').inputValue();
  // Output Format should have scaffold text (not the role text we typed)
  expect(outputVal).not.toContain('E2E test transcription specialist');

  await page.screenshot({ path: 'test-results/12-editor-filled.png', fullPage: true });

  // Click Save
  await disableScrim(page);
  await editor.locator('#saveBtn').click({ timeout: 15_000 });

  // Wait for "Saved" status and gallery to reopen
  await page.waitForTimeout(3000);
  await disableScrim(page);

  // Gallery should reopen with the new template visible
  const galAfter = await findGalleryFrame(page);
  await expect(
    galAfter.getByText('E2E Test Template').first()
  ).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'test-results/12-gallery-with-custom.png', fullPage: true });

  await disableScrim(page);
  await galAfter.getByRole('button', { name: /Cancel|Скасувати|Отмена/i }).click({ timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 13. Custom Templates: Apply custom template
// ---------------------------------------------------------------------------
test('GeneaScript: apply custom template', async ({ page }) => {
  test.setTimeout(180_000);
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarTemplateGallery(sidebar).click();

  await disableScrim(page);
  const gal = await findGalleryFrame(page);

  // Click on the custom template card to select it
  await disableScrim(page);
  const customCard = gal.locator('.card', { has: gal.getByText('E2E Test Template') }).first();
  await customCard.click({ timeout: 30_000 });

  // Verify it's selected
  await expect(customCard).toHaveClass(/selected/, { timeout: 10_000 });

  // Click Apply
  await disableScrim(page);
  await gal.locator('#applyBtn').click({ timeout: 15_000 });

  // Wait for success status and dialog to close
  await expect(gal.locator('#statusMsg')).toContainText(/applied|застосовано|применён/i, { timeout: 30_000 });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'test-results/13-applied-custom.png', fullPage: true });

  // Verify sidebar template label updated (polls every 2s)
  await expect(
    sidebar.locator('#templateLabel')
  ).toContainText('E2E Test Template', { timeout: 15_000 });
});

// ---------------------------------------------------------------------------
// 14. Custom Templates: Duplicate custom template
// ---------------------------------------------------------------------------
test('GeneaScript: duplicate custom template', async ({ page }) => {
  test.setTimeout(180_000);
  const sidebar = await openGeneascriptSidebar(page);
  await sidebarTemplateGallery(sidebar).click();

  await disableScrim(page);
  const gal = await findGalleryFrame(page);

  // Click Duplicate on the custom template
  await disableScrim(page);
  const duplicateBtn = gal.locator('.card', { has: gal.getByText('E2E Test Template') })
    .first()
    .locator('.action-link', { hasText: /Duplicate|Дублювати|Дублировать/i });
  await duplicateBtn.click({ timeout: 30_000 });

  // The gallery closes and reopens — wait for the fresh gallery to render.
  await page.waitForTimeout(5000);

  // Poll until we find a gallery frame (with #previewToggle) that also
  // contains the duplicated template name.
  const deadline = Date.now() + 60_000;
  let galAfter: import('@playwright/test').Frame | null = null;
  while (Date.now() < deadline) {
    await disableScrim(page);
    for (const frame of page.frames()) {
      try {
        const hasToggle = (await frame.locator('#previewToggle').count()) > 0;
        const hasCopy = (await frame.getByText('E2E Test Template (copy)').count()) > 0;
        if (hasToggle && hasCopy) { galAfter = frame; break; }
      } catch { /* skip */ }
    }
    if (galAfter) break;
    await page.waitForTimeout(1000);
  }

  expect(galAfter).not.toBeNull();
  await page.screenshot({ path: 'test-results/14-duplicated.png', fullPage: true });

  await disableScrim(page);
  await galAfter!.getByRole('button', { name: /Cancel|Скасувати|Отмена/i }).click({ timeout: 30_000 });
});

// ---------------------------------------------------------------------------
// 15. Custom Templates: Delete custom templates (cleanup)
// ---------------------------------------------------------------------------
test('GeneaScript: delete custom templates', async ({ page }) => {
  test.setTimeout(240_000);
  const sidebar = await openGeneascriptSidebar(page);

  // Delete all custom templates created during testing (up to 3 iterations).
  // A gallery dialog may already be open from the previous test's duplicate flow.
  for (let i = 0; i < 3; i++) {
    await disableScrim(page);

    // Check if gallery is already open; if not, open it from sidebar
    let gal: import('@playwright/test').Frame | null = null;
    for (const frame of page.frames()) {
      try {
        if ((await frame.locator('#previewToggle').count()) > 0) { gal = frame; break; }
      } catch { /* skip */ }
    }
    if (!gal) {
      await sidebarTemplateGallery(sidebar).click({ timeout: 30_000 });
      await page.waitForTimeout(3000);
      await disableScrim(page);
      try {
        gal = await findGalleryFrame(page);
      } catch {
        break;
      }
    }

    // Scroll down in gallery to see custom template cards
    await disableScrim(page);

    // Find any Delete button in custom template cards
    const deleteBtn = gal.locator('.action-danger').first();
    if ((await deleteBtn.count()) === 0) {
      // No custom templates left — close gallery and exit
      await disableScrim(page);
      await gal.getByRole('button', { name: /Cancel|Скасувати|Отмена/i }).click({ timeout: 15_000 });
      break;
    }

    await disableScrim(page);
    await deleteBtn.click({ timeout: 15_000 });

    // Handle custom confirm modal
    await page.waitForTimeout(1000);
    await disableScrim(page);
    const confirmYes = gal.locator('#confirmYes');
    if (await confirmYes.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmYes.click({ timeout: 10_000 });
    }

    // Wait for gallery to reload after delete (new dialog replaces old one)
    await page.waitForTimeout(5000);
    // Reset gal to null so next iteration re-discovers the fresh frame
    gal = null;
  }

  // Verify sidebar reverted to an OOB template label
  await disableScrim(page);
  await page.waitForTimeout(5000);
  const label = await sidebar.locator('#templateLabel').textContent();
  expect(label).not.toContain('E2E Test Template');

  await page.screenshot({ path: 'test-results/15-deleted-all.png', fullPage: true });
});

// ---------------------------------------------------------------------------
// 16. Transcribe flow (batch)
// ---------------------------------------------------------------------------
test('GeneaScript: batch transcribe (needs API key) [16]', async ({ page }) => {
  test.setTimeout(600_000);
  const sidebar = await openGeneascriptSidebar(page);

  // Check if API key is present
  const keyBanner = sidebarKeyBanner(sidebar);
  if (await keyBanner.isVisible().catch(() => false)) {
    test.skip(true, 'No Gemini API key — complete Setup AI once, then re-run.');
    return;
  }

  // Refresh image list
  await sidebarRefresh(sidebar).click();
  await expect(sidebarImageCount(sidebar)).not.toHaveText('0', { timeout: 120_000 });

  const boxes = sidebarImageCheckboxes(sidebar);
  const count = await boxes.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // Select up to 2 images for transcription
  const toTranscribe = Math.min(2, count);
  for (let i = 0; i < toTranscribe; i++) {
    await boxes.nth(i).check();
  }

  await expect(sidebarTranscribe(sidebar)).toBeEnabled();
  await sidebarTranscribe(sidebar).click();

  // Handle "replace existing transcription?" confirmation modal if visible
  const replaceModal = sidebar.locator('#confirmModal');
  if (await replaceModal.isVisible().catch(() => false)) {
    await sidebar.locator('#confirmYes').click();
  }

  // Wait for progress to appear and complete
  await expect(sidebar.locator('#progress')).toBeVisible({ timeout: 30_000 });
  await expect(sidebarProgressText(sidebar)).toContainText(
    /Done:|Готово:|succeeded|успішно|успешно|помилок/i,
    { timeout: 480_000 }
  );
});

// ---------------------------------------------------------------------------
// 17. Document result structure (screenshot)
// ---------------------------------------------------------------------------
test('GeneaScript: document result structure after transcription [17]', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  void sidebar;

  // Take a full-page screenshot to visually verify transcription results
  // are inserted below the images in the document
  await page.screenshot({
    path: 'test-results/12-document-result-structure.png',
    fullPage: true,
  });
});
