# E2E Playwright Test Suite - Complete Design

**Date:** 2026-04-18
**Status:** Draft
**Scope:** Complete the Playwright-based E2E test suite for GeneaScript Google Docs add-on

## Context

GeneaScript has a partially implemented Playwright E2E test suite (5 tests in `e2e/geneascript-addon.spec.ts`) covering sidebar controls, Import, Setup AI, Template Gallery, and a combined Refresh/Extract/Transcribe flow. The suite is ~70% complete. This design expands it to cover all main workflows including document reset, full import with specific folder/images, document result structure verification, and comprehensive error handling.

## Architecture Decision

**Single serial spec file** (`e2e/geneascript-addon.spec.ts`) with expanded helpers in `e2e/helpers.ts`. This pattern is already proven and appropriate for stateful Google Docs add-on testing where each test builds on prior document state.

## Test Account

- **Email:** geneascript.support@gmail.com
- **Auth:** Playwright storage state file at `e2e/.auth/google.json` (gitignored)
- **API Key:** Must be configured in the add-on's Setup AI dialog for transcription tests

## Test Suite (12 Tests, Serial Execution)

### Final Test Order (Serial Execution)

Error tests are interleaved where document state supports them.

| # | Test Name | Type | Precondition | Actions | Assertions |
|---|---|---|---|---|---|
| 1 | Blank out test document | Setup | Doc may have leftover content | Navigate to doc, Ctrl+A, Delete | Doc appears empty (screenshot) |
| 2 | Menu and sidebar open correctly | Happy | Doc is blank | Open via menu/rail, wait for sidebar | All 6 buttons visible: Import, Setup AI, Extract, Template Gallery, Refresh, Transcribe |
| 3 | Empty doc: no images for refresh | Error | Doc is blank | Click Refresh | Empty state message appears in image list |
| 4 | Setup AI dialog | Happy | Sidebar open | Click Setup AI | Modal opens, model select + API key input visible, close with Escape |
| 5 | No API key banner | Error | Sidebar open | Check `#keyBanner` | If key missing: banner visible, Transcribe+Extract disabled. **Skip if key configured.** |
| 6 | Import images from Drive | Happy | Sidebar open, doc blank | Click Import, search "ДАТО ф487о1с545 1894 Турильче Вербівки народж - приклад", select cover + first 5 images (6 total) | Picker loads, images selected, `#imgCount` shows 6. **Post-import verification:** document body contains inline images (screenshot or DOM check), sidebar image list shows all 6 imported images with correct names |
| 7 | Refresh image list | Happy | Images imported | Click Refresh | 6 checkboxes visible, count matches |
| 8 | No image selected: transcribe disabled | Error | Images loaded, none checked | Check button state | Transcribe button (`#goBtn`) is disabled |
| 9 | Extract Context dialog | Happy | Images in doc | Check first image, click Extract | Dialog opens with extract button visible, close with Escape |
| 10 | Template Gallery elements and selection | Happy | Sidebar open | Click Template Gallery, toggle preview, cycle 5 tabs | Each tab has content, preview pane opens, Cancel closes |
| 11 | Transcribe flow (batch) | Happy | Images in doc, API key configured | Select 2 images, Transcribe, handle confirm modal | Progress visible, completion with done count ≥ 1 |
| 12 | Document result structure | Happy | Transcription completed | Take full-page screenshot | Screenshot shows images with transcription text below (visual verification) |

## New Helpers (`e2e/helpers.ts`)

### Functions to Add

```typescript
// Clear all document content
clearDocument(page: Page): Promise<void>
// Ctrl+A, Delete, short wait for sync

// Wait for image list with minimum count
waitForImageList(sidebar: Frame, minCount: number): Promise<void>
// Poll #imgList checkboxes until count >= minCount

// Locator for error banner
sidebarErrorBanner(sidebar: Frame): Locator
// sidebar.locator('#errorBanner')

// Locator for key warning banner
sidebarKeyBanner(sidebar: Frame): Locator
// sidebar.locator('#keyBanner')

// Locator for stop button
sidebarStop(sidebar: Frame): Locator
// sidebar.locator('[data-testid="geneascript-stop"]')

// Locator for image count display
sidebarImageCount(sidebar: Frame): Locator
// sidebar.locator('#imgCount')

// Locator for progress text
sidebarProgressText(sidebar: Frame): Locator
// sidebar.locator('#progText')

// Locator for empty state message
sidebarEmptyState(sidebar: Frame): Locator
// sidebar.locator('.empty-state')
```

## Key Selectors Reference

| Element | Selector | Purpose |
|---|---|---|
| Import button | `[data-testid="geneascript-import"]` | Open Drive picker |
| Setup AI button | `[data-testid="geneascript-setup-ai"]` | Open API config dialog |
| Extract button | `[data-testid="geneascript-extract"]` | Open context extraction dialog |
| Template Gallery button | `[data-testid="geneascript-template-gallery"]` | Open template browser |
| Refresh button | `[data-testid="geneascript-refresh"]` | Reload image list |
| Transcribe button | `[data-testid="geneascript-transcribe"]` | Start batch transcription |
| Stop button | `[data-testid="geneascript-stop"]` | Stop batch in progress |
| Image count | `#imgCount` | Number of images in list |
| Key banner | `#keyBanner` | "No API key" warning |
| Error banner | `#errorBanner` | Error message display |
| Progress text | `#progText` | Batch progress message |
| Progress bar | `#progBar` | Visual progress indicator |
| Image checkboxes | `.image-list input.ic[type="checkbox"]` | Image selection |
| Empty state | `.empty-state` | No-images message |
| Confirm modal | `#confirmModal` | Replace confirmation dialog |
| Confirm Yes | `#confirmYes` | Confirm replacement button |

## Environment Variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PLAYWRIGHT_STORAGE_STATE` | Yes | — | Path to Google auth session JSON |
| `GENEASCRIPT_TEST_DOC_URL` | No | Built-in demo doc URL | Override test document |
| `GENEASCRIPT_RUN_IMPORT_PICKER` | Yes (for test 6) | — | Set to `1` to run full import flow |

## Auth Setup Instructions

1. `npm install`
2. Generate Google session:
   ```bash
   npx playwright codegen "https://docs.google.com/" --save-storage=e2e/.auth/google.json
   ```
3. In the opened browser, sign in as `geneascript.support@gmail.com`
4. Navigate to the test doc URL to establish session cookies
5. Close the browser window
6. Verify `.auth/` is gitignored

## Verification Plan

1. **Run full suite headed:**
   ```bash
   export PLAYWRIGHT_STORAGE_STATE=$PWD/e2e/.auth/google.json
   export GENEASCRIPT_RUN_IMPORT_PICKER=1
   npx playwright test --headed
   ```
2. Verify all 12 tests pass (or skip with clear reason)
3. Check HTML report: `npx playwright show-report`
4. Review screenshots captured for test 9 (document structure) and test 1 (blank doc)
5. Run without import picker to verify skip/default paths work:
   ```bash
   unset GENEASCRIPT_RUN_IMPORT_PICKER
   npx playwright test --headed
   ```

## Files to Modify

| File | Changes |
|---|---|
| `e2e/geneascript-addon.spec.ts` | Rewrite with 12 tests in revised order |
| `e2e/helpers.ts` | Add ~7 new helper functions |
| `e2e/constants.ts` | Add import folder search string constant |
| `e2e/README.md` | Update setup instructions, document all env vars, test account info |
| `.gitignore` | Ensure `e2e/.auth/` is explicitly listed |
