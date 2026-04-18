# GeneaScript Playwright E2E

End-to-end tests for the GeneaScript Google Docs add-on. Tests drive **Google Docs** with a **saved Google account session** and the **test deployment** of the add-on. The doc URL includes Google's `addon_dry_run=…` query parameter so you don't need to click Execute in Apps Script each time.

## Prerequisites

1. **Chrome** (Playwright uses the Google Chrome channel)
2. **Test account:** `geneascript.support@gmail.com`
3. A **Gemini API key** saved via Setup AI in the test account (required for transcription tests; others are skipped if missing)

## One-time auth setup (storage state)

Playwright cannot log in to Google without a stored session. You need to:
1. Get a fresh `addon_dry_run` URL from Apps Script
2. Run `playwright codegen` with that URL to save a browser session

### Step 1: Get the test deployment URL

1. Open the Apps Script project:
   https://script.google.com/home/projects/1546_ac3ulyKTfblQLJNHqRrJBNScAuuA8b6_93rcCmESqxPQwaXief_y
2. Go to **Deploy → Test Deployments**
3. Select **Latest Version** and **GeneaScript Demo document**
4. Click **Execute** — a new browser tab opens with the test doc
5. Copy the full URL from the address bar — it contains the `addon_dry_run` token

The URL will look like:
```
https://drive.google.com/open?id=1fPALk9wQPJlEuEae2gLmj5wre_WLexVIcLZAdbAKODg&addon_dry_run=AAnXSK9GaLGl...long_token...
```

### Step 2: Generate the auth session

```bash
cd /path/to/geneascript-gdoc-addon
npm install

# Paste the full URL from Step 1 (replace the example token below if expired).
# IMPORTANT: use single quotes around the URL (the & would be interpreted by the shell otherwise).
npx playwright codegen --save-storage=e2e/.auth/google.json 'https://drive.google.com/open?id=1fPALk9wQPJlEuEae2gLmj5wre_WLexVIcLZAdbAKODg&addon_dry_run=AAnXSK9GaLGlrrLUqJkarWJEgMLsG62SvXJx_kC3Nv-dNg50CyHxxGA6tvO-5qkdKnFl6tfbbn0M5jhMpL4zNsCXYOJyHbEFnGI4lsKFjEwiIPxrxPXiC0a98LCWazpzFP5cB6yeDsSx'
```

In the opened browser:
1. Sign in as `geneascript.support@gmail.com`
2. Wait for the Google Doc to fully load (you should see the GeneaScript menu or sidebar)
3. Close the browser window — the session is saved automatically

The session file is gitignored under `e2e/.auth/`. Re-run these steps if the session expires or the `addon_dry_run` token becomes invalid.

## Environment variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PLAYWRIGHT_STORAGE_STATE` | **Yes** | — | Path to Google auth session JSON |
| `GENEASCRIPT_TEST_DOC_URL` | No | Built-in demo doc URL | Override test document (must include `addon_dry_run`) |
| `GENEASCRIPT_RUN_IMPORT_PICKER` | **Yes** for import test | — | Set to `1` to run the full Drive import flow |

## Run tests

```bash
export PLAYWRIGHT_STORAGE_STATE=$PWD/e2e/.auth/google.json

# Run all tests (import test skipped without picker flag)
npm run test:e2e

# Run with full import flow (6 images from Drive)
export GENEASCRIPT_RUN_IMPORT_PICKER=1
npm run test:e2e

# Headed mode (visible browser)
npm run test:e2e:headed

# Debug / UI mode
npm run test:e2e:debug
npm run test:e2e:ui
```

## Test suite (12 tests, serial)

| # | Test | Type | Key assertions |
|---|------|------|----------------|
| 1 | Blank out test document | Setup | Document cleared, screenshot saved |
| 2 | Menu and sidebar open correctly | Happy | All 6 sidebar buttons visible |
| 3 | Empty doc: no images for refresh | Error | Empty state message or zero count after refresh |
| 4 | Setup AI dialog | Happy | Modal opens, form fields visible |
| 5 | No API key banner | Error | `#keyBanner` visible, Transcribe+Extract disabled (skips if key exists) |
| 6 | Import images from Drive | Happy | 6 images imported, sidebar list updated, doc contains images |
| 7 | Refresh image list | Happy | Checkboxes visible, count > 0 |
| 8 | No image selected: transcribe disabled | Error | Transcribe button disabled when nothing checked |
| 9 | Extract Context dialog | Happy | Dialog opens with extract button |
| 10 | Template Gallery preview tabs | Happy | All 5 tabs have content, preview pane works |
| 11 | Batch transcribe | Happy | Progress bar, completion message (skips without API key) |
| 12 | Document result structure | Happy | Full-page screenshot for visual verification |

Tests run serially — each builds on document state from previous tests.

## Screenshots

Test artifacts are saved to `test-results/`:
- `01-blank-doc.png` — document after clearing
- `06-after-import.png` — document after importing 6 images
- `12-document-result-structure.png` — document after transcription

## After changing the sidebar HTML

`data-testid` attributes live in `addon/Code.gs` (`getSidebarHtml`). Push with `clasp push` before expecting the latest UI in Docs.

## Troubleshooting

- **Session expired:** Re-run `npx playwright codegen` to regenerate `e2e/.auth/google.json`
- **Sidebar not found:** Ensure the doc URL has a valid `addon_dry_run` token for the test deployment
- **Import test skipped:** Set `GENEASCRIPT_RUN_IMPORT_PICKER=1`
- **Transcribe test skipped:** Configure a Gemini API key via Setup AI in the test account
- **Slow Google Picker:** The picker can take 60-120s to load; tests have appropriate timeouts
- **Tests failing on CI:** E2E tests require a saved Google session; cannot run in stateless CI without encrypted auth state
