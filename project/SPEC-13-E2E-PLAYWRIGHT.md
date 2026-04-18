# Feature specification: E2E Playwright Test Suite

**Status:** Draft
**Target version:** Unreleased (testing infrastructure)
**Related:** All SPEC files (tests verify features from SPEC-1 through SPEC-12)

---

## 1. Overview and user story

**What we are building and why**

Complete the partially implemented Playwright E2E test suite to cover all main GeneaScript add-on workflows. The suite runs against a real Google Doc using a saved browser session, testing the full user journey from document setup through transcription and result verification.

**User story**

- As a developer, I want a comprehensive E2E test suite so that I can verify all add-on workflows after code changes without manual testing.
- As a developer, I want automated error state verification so that regressions in error handling are caught early.

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|--------|
| Expand test suite to 12 tests | `e2e/geneascript-addon.spec.ts` | Rewrite with revised test order |
| Add helper functions | `e2e/helpers.ts` | 7 new locator/utility functions |
| Add constants | `e2e/constants.ts` | Import folder search string, image count |
| Update test docs | `e2e/README.md` | Auth setup, env vars, test account |
| Gitignore auth | `.gitignore` | Ensure `e2e/.auth/` listed |

**Out of scope**

- CI/CD pipeline integration (requires encrypted secrets management — future work)
- Eval framework completion (separate spec)
- Visual regression baselines (screenshot comparison tooling)
- Performance/load testing
- OAuth service account auth (tests use saved browser session)

## 3. UI and frontend (Phase 3 when non-trivial)

**Entry point**

Tests are run via CLI: `npx playwright test`

**Components / behavior**

Tests interact with these add-on UI elements via Playwright browser automation:

- **GeneaScript menu** (Extensions → GeneaScript → Open Sidebar)
- **Sidebar** (iframe): Import, Setup AI, Extract, Template Gallery, Refresh, Transcribe, Stop buttons
- **Image list** with checkboxes, count display, empty state
- **Modals** (iframes): Setup AI dialog, Extract Context dialog, Template Gallery dialog, Confirm replace modal
- **Banners**: `#keyBanner` (no API key warning), `#errorBanner` (error messages)
- **Progress UI**: `#progress`, `#progText`, `#progBar`, `#progTime`

**Error states tested**

| Error | Trigger | Expected UI | Test # |
|-------|---------|-------------|--------|
| Empty doc / no images | Refresh on blank doc | `.empty-state` message | 3 |
| No API key | Key not configured | `#keyBanner` visible, buttons disabled | 5 |
| No image selected | No checkboxes checked | Transcribe button disabled | 8 |

## 4. Apps Script backend (Phase 4)

No backend changes. Tests verify existing backend functions through the UI.

**Functions tested (via UI interaction)**

| Function | Tested In |
|----------|-----------|
| `showTranscribeSidebar()` / `buildHomepageCard()` | Tests 2, 3, 5 |
| `importFromDriveFolder()` | Test 6 |
| `getImageList()` / refresh | Tests 3, 7 |
| `openExtractContextDialog()` | Test 9 |
| `showTemplateGalleryDialog()` | Test 10 |
| `transcribeImageByIndex()` | Test 11 |

**OAuth / manifest**

- New or changed scopes: **No**

## 5. Edge cases

- Google session expires between test runs → re-generate `e2e/.auth/google.json`
- Google Picker takes >120s to load → test has 120s timeout, fails with clear message
- API key not configured → tests 5 detects this, test 11 skips transcription
- Doc already has content from previous run → test 1 blanks it
- Import picker search returns no results → test fails with folder not found
- Sidebar opens via rail icon vs top menu → helper tries both paths with fallback

## 6. Acceptance criteria (Phase 5)

- [ ] All 12 tests pass when run headed with valid storage state and import picker flag
- [ ] Tests 3, 5 handle missing API key gracefully (skip or verify banner)
- [ ] Import test selects from folder "ДАТО ф487о1с545 1894 Турильче Вербівки народж - приклад" — cover + 5 images
- [ ] After import, document body contains inline images and sidebar image list shows all 6 imported images
- [ ] Test 1 successfully blanks the document regardless of prior state
- [ ] Test 12 captures a screenshot showing transcription results in the document
- [ ] All sidebar buttons verified visible with correct `data-testid` attributes
- [ ] Template Gallery test cycles through all 5 preview tabs
- [ ] Transcribe test handles confirm modal and waits for completion
- [ ] README documents auth setup for geneascript.support@gmail.com
- [ ] `.gitignore` includes `e2e/.auth/`
- [ ] No secrets or credentials committed in source
- [ ] HTML report generated and reviewable via `npx playwright show-report`

## 7. Manual / Google-side steps (if any)

- **One-time auth setup**: Run `npx playwright codegen` and sign in as geneascript.support@gmail.com to generate `e2e/.auth/google.json`
- **API key**: Must be configured once via the add-on's Setup AI dialog in the test account
- **Test document**: Uses the existing GeneaScript Demo doc with `addon_dry_run` token
