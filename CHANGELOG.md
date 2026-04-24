# 📋 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.4.3] — 2026-04-25

### 🐛 Fixed

- **Homepage card action no longer throws platform error** — `openSidebarFromCard` returned an empty `ActionResponse` object, which the Add-ons platform rejected with _"The value returned from Apps Script has a type that cannot be used by the add-ons platform"_. The sidebar opened anyway (the side-effect ran before the return), but every card-button click logged a platform ERROR. The function now returns `undefined` per the CardService contract for pure side-effect actions. Observed 23 such errors in one week prior to the fix.
- **Rate-limit (HTTP 429) errors now show actionable hint** — Previously surfaced as a generic red ✗ with the raw quota URL. Now classified as `API_RATE_LIMIT` and shown as a pink sidebar banner + orange ⚠ icon on the affected image row, suggesting the user wait a minute, upgrade tier, or reduce batch size.
- **Invalid API key errors now guide to Setup** — Previously surfaced as generic `API_HTTP_ERROR`. Now classified as `API_KEY_INVALID` ("API key not valid") and shown in a sidebar banner pointing to the Setup dialog.

### 🔭 Observability

- **Error metrics no longer double-counted** — Every failed transcription previously emitted both `transcribe_image_api_error` (inside `callGemini`) and `transcribe_image_error` (outer catch), so dashboard error counts were ~2× reality. Removed the inner event; the outer event now carries the full context (`model`, `httpCode`, `apiLatencyMs`, `retried`) by reading enriched properties from the thrown error. `transcribe_image_api_retry` still emits on retry (unique signal).
- **Error context propagation** — Thrown Gemini errors now carry `model`, `apiLatencyMs`, `retried` in addition to the existing `httpCode`/`errorCode`/`apiMessage`, so outer-catch telemetry no longer loses model/latency on failure paths (including `context_extract_error`).

## [1.4.2] — 2026-04-22

### 🐛 Fixed

- **Gemini 503 "overloaded" transient failures now auto-retry once** — `callGemini` sleeps 5 seconds and retries a single time on HTTP 503 before surfacing the error. Production logs showed ~83% of transcription errors over a 2-day window were transient free-tier 503s that succeeded on a second attempt.
- **Overload errors now show actionable hint in sidebar** — When a transcription fails with `API_OVERLOADED`, the sidebar shows a pink banner under the progress bar suggesting the user retry later or switch to a paid-tier model, and the affected image row gets a warning icon with a tooltip instead of a generic red ✗.
- **Better error hints for API misconfiguration** — "Generative Language API not enabled" and "project has been denied access" errors are now classified as `API_NOT_ENABLED` / `API_PROJECT_DENIED` and surface specific guidance in the sidebar banner, instead of bubbling the raw Google error text.

### 🔭 Observability

- **Error classification taxonomy expanded** — `classifyErrorCode` now recognizes 503/overloaded, `API_NOT_ENABLED`, and `API_PROJECT_DENIED`, and parses embedded HTTP codes from error text like `(HTTP 503)`. Thrown Gemini errors now carry `httpCode` / `errorCode` / `apiMessage` properties for downstream telemetry.
- **Stale OAuth consent detection** — `getDrivePickerConfig` now emits a `picker_config_scope_error` event with code `AUTH_REQUIRED_STALE_CONSENT` when the runtime is missing the `script.external_request` scope, making it observable when a user needs to re-consent to the add-on.
- **Server responses include `errorCode`** — All user-facing failure payloads now include the classified `errorCode` so the sidebar can render specialized UI per error class.

## [1.4.1] — 2026-04-21

### 🐛 Fixed

- **Observability: dashboard charts no longer empty** — Log-based metric filters combined `event` and `status` into one regex (`".*event.*status"`), but `logObsEvent` emits the keys in the opposite order, so 5 filters matched zero log entries. Split each into two order-independent AND conditions. Affected metrics: `geneascript_transcribe_images_count`, `geneascript_import_runs_count`, `geneascript_import_image_latency_ms`, `geneascript_estimated_cost_usd_total`, `geneascript_user_activity_count`.
- **Observability: cost metrics now populated for default model** — `gemini-flash-latest` (the default) had no entry in the pricing table, so `estimatedCostUsd` was always `null`. Added paid-tier Standard pricing ($0.50 input / $3.00 output per 1M tokens).
- **Observability: "Total Estimated Cost" widget** — Converted from xyChart to scorecard; the xyChart rejected the underlying distribution metric with a `pickTimeSeriesFilter cannot be a distribution` error.

### 🧰 Chores

- **Observability apply script cleanup** — Removed leftover `debug_log` function and `rg` (ripgrep) dependency from `observability/scripts/apply.sh`.
- **Docs** — `observability/README.md` now lists all 15 managed metrics (was missing 3).

## [1.4.0] — 2026-04-19

### ✨ Added

- **Custom Templates** — Create, edit, duplicate, and delete personal transcription templates via the Template Gallery:
  - Clone from official templates or create blank with starter scaffold (Output Format, Instructions, Context Defaults)
  - Per-section "Reset to inherited" for templates based on official ones
  - Tabbed editor dialog with Role, Input Structure, Output Format, Instructions, and Context Defaults sections
  - Export custom templates to document for collaborator access (Shared badge, read-only)
  - "My Templates" section in Template Gallery with Custom/Shared badges and action buttons
  - Max 5 custom templates per user, stored in User Properties
  - Full EN/UK/RU localization for all custom template UI (~40 new i18n keys)

- **Playwright E2E test suite** — 17 serial browser tests covering all main add-on workflows against a live Google Doc with a real Google session:
  1. Blank out test document
  2. Menu and sidebar open correctly (6 core buttons)
  3. Empty doc — no images for refresh
  4. Setup AI dialog
  5. No API key banner (skipped when key exists)
  6. Import images from Drive via Google Picker (opt-in via `GENEASCRIPT_RUN_IMPORT_PICKER=1`)
  7. Refresh image list
  8. No image selected — transcribe disabled
  9. Extract Context dialog
  10. Template Gallery preview tabs (5 tabs + preview toggle)
  11. Gallery shows My Templates section with create buttons
  12. Create blank custom template, fill editor tabs, verify isolation, save
  13. Apply custom template, verify sidebar label updates
  14. Duplicate custom template, verify in reloaded gallery
  15. Delete custom templates with inline confirm modal
  16. Batch transcribe (2 images, waits for completion)
  17. Document result structure screenshot
- **E2E infrastructure** — Persistent Chrome profile auth (`e2e/save-auth.ts`), Playwright fixtures, shared helpers for sidebar/modal frame discovery, Google Material Design scrim workarounds, CDP mouse events for Google Picker automation.
- **Project spec** — Added `project/SPEC-13-E2E-PLAYWRIGHT.md` and design doc `project/designs/2026-04-18-e2e-playwright-suite-design.md`.

### 🐛 Fixed

- **Apply custom template** — `applyTemplate()` now accepts `custom_*` template IDs; previously rejected them as "Unknown template".
- **Editor tab isolation** — Each section tab (Role, Input Structure, Output Format, Instructions, Context Defaults) now uses its own textarea; previously all tabs shared a single textarea causing edits to bleed across sections.
- **Gallery scrolling** — Template Gallery content is now scrollable; previously the "Review Template" preview section was invisible because flex layout compressed it to zero height when content exceeded the dialog.
- **Sidebar template label** — Sidebar now shows the correct template name after applying a custom template; previously showed "None" because `loadTemplateLabel` only checked OOB templates.

### 🔧 Changed

- **Gallery layout** — Moved "Review Template" section above "My Templates" for easier access to OOB template content.
- **Popup transitions** — All dialog transitions (Edit, Create, Duplicate, Delete) now show a "Loading…" indicator instead of silently closing.
- **Confirmation dialogs** — Replaced native browser `confirm()` (which showed ugly iframe URLs) with styled inline confirmation modals for Delete, Export, and Reset actions.
- **Removed scaffold checkbox** — Removed "Scaffold missing Context fields from template" option from Template Gallery to simplify the UI.
- **`.gitignore`** — Added `playwright-report/` and `e2e/.auth/` exclusions.
- **`CLAUDE.md`** — Updated spec range (SPEC-1–13), added `project/designs/` reference and project materials location rule.

## [1.2.0] — 2026-04-18

### ✨ Added

- **Copy Full Prompt** — Two new entry points in the Template Gallery dialog let users copy the exact prompt text sent to the Gemini API (with document context injected) to the clipboard, for use in AI Studio, ChatGPT, or fine-tuning datasets:
  - **"Copy prompt" icon button** — top-right corner of the gallery dialog, always visible.
  - **"Full Prompt" tab** — 6th tab in the review panel, shows the assembled prompt with a blue "Copy to clipboard" bar.
- **`getFullPromptForClient(templateId)`** — New server function in `TemplateGallery.gs` that assembles the full prompt identically to `buildPrompt()`.
- **Project spec** — Added `project/SPEC-12-COPY-FULL-PROMPT.md` and UI mockups under `project/mocks/`.

### 🔧 Changed

- **Branding simplification** — Shortened the add-on name throughout the UI:
  - Extensions menu: **GeneaScript** (was "GeneaScript Metric Book Transcriber").
  - Sidebar title: **GeneaScript Transcriber** (was "GeneaScript Metric Book Transcriber").
  - Manifest `addOns.common.name`: **GeneaScript Transcriber** (was "Metric Book Transcriber").
- **Homepage card cleaned up** — Removed duplicate card header title (manifest name already shown in dark bar). Updated description to "Import images into a document and transcribe them using AI with predefined templates." Button renamed to "Open GeneaScript sidebar" (EN) / "Відкрити GeneaScript" (UK) / "Открыть GeneaScript" (RU).
- **Sidebar template button** — Removed "Template:" prefix; button now shows just the template name (e.g. "📚 Galician Greek Catholic (19th c.)"), fitting on one line.
- **Template Gallery** — Removed "Currently using: ..." line (redundant with the selected radio button).
- **I18n** — Added `gallery.tab.full_prompt`, `gallery.copy_prompt`, `gallery.copy_to_clipboard`, `gallery.copied`, `gallery.copy_failed`, `gallery.copy_prompt_hint` in all three locales (EN/UK/RU). Updated `card.blurb`, `card.button`, `menu.title`, and `auth.required` strings.
- **Installation docs** — Simplified to Marketplace-only path (removed developer Options 1–3). Direct link to the published listing.
- **Site pages** — Added links to Google Workspace™ Marketplace, Telegram, YouTube, GitHub, and support email on all locale index pages and README.

## [1.1.1] — 2026-04-11

### ✨ Added

- **Localized documentation site (geneascript.com)** — User Guide, Installation, Privacy Policy, and Terms are published under **`/en/`**, **`/uk/`**, and **`/ru/`** with a language hub at **`/`**. Chrome (nav, footer, language switcher, `hreflang`) is driven by `docs/_data/site_i18n.yml`.
- **`jekyll-redirect-from`** — Legacy URLs (`/USER_GUIDE.html`, `/INSTALLATION.html`, `/PRIVACY_POLICY.html`, `/TERMS_OF_SERVICE.html`) redirect to the English locale pages.
- **Template Gallery — Generic verbatim template (`generic_plain`)** — Third profile for non–metric-book images: handwritten letters, typescript, diaries, and similar text. Prompt instructs a literal transcription in the **original language and script** (no modernization of spelling in the body). Output is **Transcription** plus short **`original` / `en` / `ru` / `uk`** summary lines; **Quality Metrics** and **Assessment** are not requested for this template. Labels and descriptions are localized (EN / UK / RU) in **`addon/I18n.gs`**; context defaults use the same Context field scaffold as other templates.

### 🔧 Changed

- **Repository doc paths** — Canonical Markdown sources for the public guides live under **`docs/en/`** (plus **`docs/uk/`** and **`docs/ru/`** translations). **`README.md`**, **`STORE_LISTING.md`**, and **`HELP_URL`** in the add-on point to the new locations.
- **`docs/DESIGN.md`** — Uses the default layout with **`lang: en`** for consistent navigation.
- **Sidebar footer** — Shows version **v1.1.1**; **Help** link targets **`https://geneascript.com/en/USER_GUIDE.html`**.

### 📚 Documentation

- **Ukrainian and Russian** site pages mirror the English structure; UK/RU User Guide and Installation are concise editions; Privacy and Terms are fully translated for the site.
- **Google™ trademark attribution (Workspace Marketplace compliance)** — **™** added for Google product names in **`docs/STORE_LISTING.md`** (short + detailed descriptions and footnote), **`README.md`**, English guides (**`USER_GUIDE`**, **`INSTALLATION`**, **`PRIVACY_POLICY`**, **`TERMS_OF_SERVICE`**), site chrome (**`_config.yml`**, **`site_i18n.yml`**, **`home.html`**, hub pages), and UK/RU Privacy/Terms footers; **`TERMS_OF_SERVICE`** (EN) adds a **Trademarks** section. **`SPEC-4`** and this changelog reference **`docs/en/TERMS_OF_SERVICE.md`**.

## [1.1.0] — 2026-04-11

### ✨ Added

- **Interface localization (EN / UK / RU)** — Menus, dialogs, sidebar, Drive picker, template gallery, and homepage card use translations. Language follows the Google account locale by default, with an explicit override (**Interface language**) in **Setup AI** and **Settings** (stored in User Properties as `UI_LOCALE`). Unsupported account locales fall back to English.
- **`addon/I18n.gs`** — Central string tables, `t()`, `getEffectiveLocale()`, and client JSON helpers for `HtmlService` injection.
- **`project/SPEC-11-i18n.md`** — Product and technical spec for i18n scope and testing.

### 🔧 Changed

- **Extensions menu locale** — Menu labels align with **Interface language** / account locale after Editor add-on auth (`AuthMode.NONE` vs `LIMITED`); handlers refresh the custom menu when locale context is available.

### 🐛 Fixed

- **Template Gallery** — Renamed inner loop variable in `getTemplateGalleryHtml` so it no longer shadows the global `t()` i18n helper (fixes dialog failing to open).
- **Template Gallery RPC errors** — Failure handlers use localized fallback text when `google.script.run` returns an error without `message` (avoids **Ошибка: undefined** / similar).
- **Extract Context dialog** — Image `<option>` labels (from document headings) are HTML-escaped before `innerHTML` assignment so markup in titles cannot break the dialog DOM.

### 📚 Documentation

- **USER_GUIDE.md** / **INSTALLATION.md** — Interface language subsection.
- **PRIVACY_POLICY.md** — Discloses optional UI language preference stored in User Properties.

## [1.0.0] — 2026-04-05

### ✨ Added

- **Template Gallery** — New "Select Template" dialog accessible from sidebar and menu. Users choose a domain-specific template that controls the transcription prompt, context defaults, and output format. Two initial templates ship:
  - **Galician Greek Catholic (19th c.)** — Latin/Polish/Ukrainian registers from Galician Greek Catholic parishes. Column headers in Latin with Cyrillic equivalents.
  - **Russian Imperial Orthodox (Metricheskaya Kniga)** — Pre-reform Russian Cyrillic registers with Church Slavonic influence. Patronymics standard, Julian calendar dates.
- **Template review (tabbed preview)** — "Show Template Review" expands a tabbed view with five tabs: Context (live document context), Role, Columns, Output Format, and Instructions.
- **Per-document template persistence** — Selected template stored in Document Properties; each document remembers its template independently.
- **Context tab shows live document context** — Template Gallery Context tab reads the actual Context block from the document, falling back to template defaults when no context exists.
- **"Extract Context from Cover Image" button** — Context tab includes a convenience button to open the Extract Context dialog directly.
- **Drive REST API helper** — New `getDriveFileById_` helper using `UrlFetchApp` + Drive REST API v3, replacing `DriveApp.getFileById()` which does not work with `drive.file` scope.

### 🔧 Changed

- **Prompt.gs refactored** — Now delegates to `TemplateGallery.gs` for the active template's prompt; backward compatible (defaults to Galician template for existing documents).
- **ContextTemplate.gs refactored** — Now delegates to `TemplateGallery.gs` for template-specific context defaults.
- **Sidebar template indicator** — Sidebar shows the currently selected template name with a clickable button to open the Template Gallery.
- **Picker default tab** — Google Picker now opens on the "Google Drive" (folders) tab by default, allowing users to select a folder first.
- **Sidebar polling removed** — Removed automatic 3-second polling for image list refresh; manual "Refresh" button retained.
- **Drive API whitelisted** — Added `https://www.googleapis.com/` to `urlFetchWhitelist` in manifest for Drive REST API calls.

### 🐛 Fixed

- **Drive import with `drive.file` scope** — Replaced `DriveApp.getFileById()` (requires `drive.readonly`) with Drive REST API via `UrlFetchApp`, fixing "No accessible JPEG/PNG/WebP files found" error when importing Picker-selected files.
- **Duplicate images in Picker** — Added client-side deduplication of file IDs before sending to server.
- **Context boundary detection** — `getContextFromDocument()` now uses `getContextRange()` for proper boundary detection, stopping at HEADING2 elements and page breaks instead of reading into image sections.
- **Extra blank lines after context extraction** — Stale list items (from template defaults with more entries than extracted data) are now removed instead of set to a space character. All blank paragraphs in the context block are cleaned up after upsert.

### 📚 Documentation

- **USER_GUIDE.md** — Added "Template Gallery" section covering template selection, review, and per-document behavior.
- **PRIVACY_POLICY.md** — Updated to accurately disclose operational telemetry (event types, latency, token usage, anonymized user IDs) per Google OAuth verification feedback.

## [0.9.1] — 2026-04-04

### ✨ Added

- **Detailed import error reporting** — Import result dialog now shows specific failed files with names, sizes, and reasons (e.g., "• 631-12-33_0003.jpg - Too large (3.60 MB)"). Helps users identify which images failed instead of just showing a count.

### 🔧 Changed

- **Sidebar auto-refresh** — Sidebar now automatically polls for document changes every 3 seconds when idle and refreshes the image list when new images are detected (e.g., after import completes). No more manual refresh button click needed.
- **Import dialog timing** — Picker success message now stays open for 4 seconds (increased from 1 second) to allow time to read detailed error information.
- **Sidebar version** — Updated footer from v0.8.0 to v0.9.1.

### 🐛 Fixed

- **Silent import failures** — Large images (>3-4 MB) that fail to import due to Google Docs size limits are now clearly reported with file name and size instead of silently creating empty sections.
- **Stale sidebar after import** — Fixed sidebar not updating automatically after Drive import completes; polling mechanism now detects image count changes and triggers refresh.

## [0.9.0-oauth-scope-migration] — 2026-04-04

### 🔐 Security & Compliance

- **OAuth scope narrowed** — Migrated from `drive.readonly` to `drive.file` scope per Google Workspace Marketplace verification requirements. Add-on now only accesses files explicitly selected by users via Google Picker, following least-privilege principle.
- **Google Picker API integration** — Replaced manual file URL/ID input with native Google Picker UI for Drive file selection, improving security and user experience.

### ✨ Added

- **Dual-view Google Picker** — "Import Book from Drive Files" now opens a Google Picker with two tabs:
  - **Images tab**: Flat view of all accessible images (JPEG, PNG, WebP)
  - **Folders tab**: Folder browser with breadcrumb navigation and image-only filtering
- **Parent folder auto-detection** — Picker automatically starts in the document's parent folder (if the document is saved in Drive), aligning with typical workflow where users create the doc in the same folder as images.
- **Client-side MIME validation** — Selected files are validated by MIME type before import; non-image files automatically filtered with clear user feedback.
- **Multi-select support** — Users can select up to 30 images at once in the Picker.
- **Brief usage instructions** — Picker shows helpful instructions for 3 seconds when opening (auto-hide).
- **Comprehensive logging** — Added detailed server-side (`Logger.log`) and client-side (`console.log`) logging throughout Picker lifecycle for troubleshooting.

### 🔧 Changed

- **Import dialog size** — Increased from 400×120px to 1100×700px to properly contain Google Picker (1051×650px, Google's API maximum).
- **Import user flow** — Simplified to Picker-only flow (removed manual file URL/ID fallback per user feedback).
- **Status feedback** — Enhanced import status messages: "Importing X images... (skipped Y non-image files)" with pluralization.
- **OAuth consent screen** — Users now see "View and manage Google Drive files that you have opened or created with this app" instead of broader "See, edit, create, and delete all of your Google Drive files".

### 🐛 Fixed

- **HTML formatting issue** — Fixed `.join('\\n')` creating literal `\n` text in Picker HTML.
- **Comment syntax error** — Fixed `/` → `//` in `getDrivePickerConfig()` that was breaking parent folder detection.
- **Picker size constraint** — Fixed parent dialog size constraining Picker; now properly sized for full Picker display.
- **Non-image file selection** — Added client-side filtering to prevent non-image files from being imported even if they slip through Picker's MIME filter.

### 📚 Documentation

- **USER_GUIDE.md** — Complete rewrite of "Import Book from Drive Files" section describing new Picker UI, two tabs, multi-select, and folder navigation.
- **DESIGN.md** — Section 2.3 "Drive import architecture" completely revised: removed manual fallback references, added dual Picker view architecture, documented parent folder detection.
- **INSTALLATION.md** — Added "Setting up Google Picker API for Production" section for publishers/deployers with step-by-step GCP Console setup, mermaid diagram, and script properties configuration.
- **SPEC-9-OAUTH-SCOPE-MIGRATION.md** — NEW: Comprehensive specification for OAuth scope migration, Picker integration, and security model.
- **CLAUDE.md** — NEW: Project guidance document for Claude Code sessions with development commands, architecture overview, and common gotchas.
- **Screenshots** — Added `v0.9-export-from-drive-picker.jpg` and `v0.9-export-from-drive-folder-filter.jpg` showing new Picker UI.

### ⚠️ Breaking Changes

- **OAuth scope change** — Users who previously authorized the add-on with `drive.readonly` will be prompted to re-authorize with the new `drive.file` scope on their next use of "Import from Drive Files".
- **Manual file URL/ID input removed** — The manual fallback (paste file URLs/IDs) has been removed in favor of the Picker-only flow.

### 🔗 References

- Google OAuth verification requirements addressed
- Picker API documentation: https://developers.google.com/picker
- OAuth scope documentation: https://developers.google.com/drive/api/guides/api-specific-auth

## [0.8.0-cover-context-extraction] — 2026-04-03

### ✨ Added

- **Cover context extraction flow** — Added a new AI-assisted flow to extract Context metadata from a selected cover/title image after Drive import, with entry points in both the sidebar and extension menu.
- **Review before apply** — Added an editable extraction dialog so users can review and adjust extracted fields before writing updates to the document `Context` section.
- **Dedicated extraction prompt file** — Added `addon/ContextExtractionPrompt.gs` to keep context-extraction prompting separate from transcription prompting.
- **Feature spec** — Added `project/SPEC-8-COVER-CONTEXT-EXTRACTION.md` documenting UX design, technical design, contracts, and acceptance criteria for v0.8.0.

### 🔧 Changed

- **Sidebar actions** — Added **Extract Context from Selected Image** action and bumped sidebar footer version to `v0.8.0`.
- **Menu actions** — Added **Extract Context from Cover Image** item under **Extensions → Metric Book Transcriber**.
- **Context writeback behavior** — Added targeted context upsert/merge logic for known labels and list sections while preserving unrelated user-authored lines.
- **Sidebar action order** — Reordered top-to-bottom flow to better match user workflow: Import → Setup AI → Extract Context → image selection → Transcribe.
- **Import UX** — Sidebar now auto-refreshes image list after Drive import completes, without requiring manual refresh.

### 🐛 Fixed

- **Stale index recovery** — Added label-based fallback resolution for transcribe/extract when body indices shift after document mutations.
- **Context placement** — Fixed context range boundary detection so updates are written to the top `Context` section instead of the document bottom.
- **Apply errors on sparse Context** — Fixed empty-text and last-paragraph edge cases during section updates.
- **Leading blank lines in Context** — Normalized context opening spacing to a single leading blank line after apply.

### 📚 Documentation

- Updated `docs/USER_GUIDE.md` with the new cover-context extraction workflow and troubleshooting notes.

## [0.7.0-ai-config-improvements] — 2026-04-03

### 🔧 Changed

- **Setup naming and copy clarity** — Renamed user-facing setup entry to **Setup AI** in menu/sidebar and dialog title, and clarified setup instructions for API key/model updates.
- **Setup links** — Updated API-key creation link to `https://aistudio.google.com/api-keys` and replaced setup pricing guidance link with Gemini API pricing docs.
- **Setup form usability** — Added compact parameter impact hints and tightened spacing to reduce scrolling in the setup popup.
- **Gemini 3 thinking-level mapping precision** — Updated request building so `minimal` is sent as `thinkingLevel: "minimal"` for Gemini Flash/Flash-Lite, while Gemini 3.1 Pro keeps the compatibility mapping to `thinkingLevel: "low"` to avoid API errors.
- **Observability parameter verification** — Validated and retained setup-parameter telemetry (`temperature`, `maxOutputTokens`, `thinkingMode`, `thinkingBudget`) on `transcribe_image_api_start` and end-to-end token/cost/latency metrics on API/done events during manual execution tests.

### 📚 Documentation

- Updated `README.md`, `docs/INSTALLATION.md`, and `docs/USER_GUIDE.md` to reflect **Setup AI** naming, new links, and the added parameter guidance notes.

## [0.6.0-ai-config-params] — 2026-03-30

### ✨ Added

- **Request parameter controls in setup** — Extended **Setup AI** with per-user Gemini request tuning: `temperature` (default `0.1`), `maxOutputTokens`, and model-aware thinking controls (`thinking mode`, optional `thinking budget` when supported).

### 🔧 Changed

- **Config persistence** — Setup now stores API key, model, and request settings together in User Properties and reuses them for transcription requests.
- **Gemini request wiring** — `callGemini` now builds `generationConfig` from saved user settings instead of hardcoded values, including conditional thinking config by model family.
- **Setup modal styling** — Updated setup popup primary action button to use the same blue primary style language as the sidebar.
- **Setup naming and guidance** — Renamed user-facing setup entry to **Setup AI**, updated API-key creation link to `aistudio.google.com/api-keys`, and replaced setup pricing guidance link with Gemini API pricing docs.

### 🐛 Fixed

- **Setup misconfiguration prevention** — Added client/server validation for request fields to block invalid numeric values and unsupported thinking combinations before sending API requests.

### 📚 Documentation

- Updated `README.md`, `docs/INSTALLATION.md`, and `docs/USER_GUIDE.md` with the new setup parameter workflow and validation guidance.

## [0.5.0-observability] — 2026-03-29

### ✨ Added

- **Observability spec** — Added `project/SPEC-6-OBSERVABILITY.md` with canonical telemetry event schema, metric contracts, dashboard requirements, and rollout/verification guidance for Google Cloud Observability.
- **Structured observability telemetry** — Added `OBS:{...}` JSON event logging for import, transcribe (single/sidebar worker), Gemini API calls, setup actions, and error paths with correlated `runId` and hashed document identifiers.
- **Cost telemetry** — Added per-image cost estimation fields (`estimatedCostUsd`, `pricingVersion`) derived from Gemini prompt/output token usage for priced model variants.
- **User-level telemetry labels** — Added privacy-safe anonymized user key (`userKey`) on observability events to support per-user usage, cost, and token monitoring.
- **Observability-as-code assets** — Added versioned Google Cloud assets under `observability/` including dashboard JSON and provisioning script to upsert log-based metrics and dashboards via `gcloud`.

### 🐛 Fixed

- **Metric extraction source** — Updated log-based metric filters/extractors to parse Apps Script logs from `jsonPayload.message` (instead of `textPayload`) so metrics ingest consistently.
- **Dashboard empty panels for sparse runs** — Reduced chart alignment windows on key transcribe/user widgets so manually triggered test runs appear promptly instead of showing “No data”.
- **Provisioning reliability** — Hardened dashboard upsert workflow in `observability/scripts/apply.sh` with update-then-recreate fallback when dashboard etags drift.

### 🔧 Changed

- **Transcribe telemetry units** — Added second-based latency fields (`apiLatencySec`, `latencySec`) and kilobyte image size field (`imageKBytes`) while retaining millisecond/byte source fields for compatibility.
- **Dashboard metrics and charts** — Updated dashboard widgets to use count-friendly aligners for event counters, new second/kilobyte metrics, total estimated cost aggregation, model-grouped views, and user-based charts (DAU/MAU approximation, per-user images/tokens/cost).
- **Metric labels** — Extended selected log-based metrics with `model` and/or `user` labels for grouped analysis in Monitoring.

### 📚 Documentation

- **Docs restructuring** — Added `observability/README.md` with setup/apply/verify flow and moved detailed observability guidance from the root `README.md` to this focused document.
- **Repo metadata** — Added `.python-version` for local environment consistency.

## [0.4.0] — 2026-03-22

### ✨ Added

- **Sidebar panel** — **Extensions → Metric Book Transcriber → Open Sidebar** opens a persistent HTML sidebar with the document’s inline images (labels from Heading 2 or “Image N”), **Select All**, **Refresh**, and **Transcribe Selected** for one or many images.
- **Batch transcription** — Processes selected images in **ascending document order**; each successful run returns `insertedCount` so the client can shift body indices and keep insertions under the correct images. Live progress: counter, current label, elapsed time, ETA (after first image), **Stop** to halt after the current image.
- **Per-image status** in the list: success (✓), `MAX_TOKENS` warning (⚠), failure (✗ with hover tooltip). Failed images do not stop the batch; summary shows succeeded/failed counts and total time.
- **Overwrite confirmation** — Custom in-sidebar modal when re-transcribing images that already have text below them (lists affected labels; Cancel / Continue).
- **AI disclaimer** — Short notice at the top of the sidebar that output is a best guess and must be reviewed.
- **Card Service homepage** — `homepageTrigger` in `appsscript.json` with `buildHomepageCard()` so the right-side add-on icon shows a card with **Open Transcriber Sidebar** instead of “No homepage card…”.
- **Project spec** — `project/SPEC-5-SIDEBAR-BATCH.md` (UX flows, limits, contracts, acceptance criteria).

### 🔧 Changed

- **`callGemini`** — Returns `{ text, finishReason }` for truncation handling and sidebar status. **`maxOutputTokens`** set to **32768**; **`thinkingConfig.thinkingBudget`** set to **2048** (thinking-required models reject 0; avoids huge internal “thinking” token use).
- **Help URL** — User Guide link in menu and sidebar points to **https://geneascript.com/USER_GUIDE.html**.
- **Sidebar footer** — Shows version **v0.4.0**.

### 📚 Documentation

- **USER_GUIDE** — Sidebar and batch workflow, Mermaid flows, new screenshots (`GeneaScriptAddOn-Extensions-Menu-OpenPanel.jpg`, `GeneaScript-SidePanel-BatchTranscription-InProgress.jpg`, `GeneaScript-SidePanel-BatchTranscription-Completed.jpg`), troubleshooting for sidebar and right-panel icon.
- **INSTALLATION**, **STORE_LISTING**, **PRIVACY_POLICY** — Updated for sidebar, batch (explicit user action), and marketplace copy.

[0.4.0]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.4.0
[0.5.0-observability]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.5.0-observability
[0.6.0-ai-config-params]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.6.0-ai-config-params
[0.7.0-ai-config-improvements]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.7.0-ai-config-improvements
[0.8.0-cover-context-extraction]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.8.0-cover-context-extraction
[0.9.0-oauth-scope-migration]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.9.0-oauth-scope-migration

## [0.3.1] — 2026-03-15

### 🔧 Changed (marketplace prep with fixes)

- **Manifest `urlFetchWhitelist`** — Added explicit `urlFetchWhitelist` in `appsscript.json` for `https://generativelanguage.googleapis.com/`. Required for Google Workspace add-ons using `UrlFetchApp` when creating a versioned deployment; fixes deployment error "An explicit urlFetchWhitelist is required for all Google Workspace add-ons using UrlFetchApp."
- **Gemini 3.1 Flash Lite model id** — Option now uses `gemini-3.1-flash-lite-preview` (correct API model id) instead of `gemini-3.1-flash-lite` (fixes 404 from generateContent).

## [0.3.0](https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.3.0-marketplace-prep) — 2026-03-15

### ✨ Added

- **🏪 Marketplace publishing preparation** — Manifest, documentation, and code changes to support publishing the add-on to the Google Workspace Marketplace.
- **`addOns` block in manifest** — Added `addOns.common` (name, logoUrl) and `addOns.docs` sections to `appsscript.json` for proper Editor add-on registration.
- **Help menu items** — Added "Help / User Guide" and "Report an issue" items to the add-on menu (open GitHub pages).
- **Privacy Policy** (`docs/PRIVACY_POLICY.md`) — Describes data access, storage, third-party API usage, and user controls. Required for Marketplace listing.
- **Terms of Service** (`docs/en/TERMS_OF_SERVICE.md`) — Standard terms for the open-source add-on. Required for Marketplace listing.
- **Store listing copy** (`docs/STORE_LISTING.md`) — Drafted application name, short/detailed descriptions, category, support links, and graphic asset checklist for the Marketplace SDK console.
- **Model selection** — Users can choose the Gemini model in the API key dialog and change it anytime: **Gemini Flash Latest** (default, free tier ~20 requests/day), **Gemini 3.1 Flash Lite** (500 requests/day), or **Gemini 3.1 Pro Preview** (best quality, billing). Model choice stored per user. Rate limits link in dialogs and docs.
- **Setup API key & model menu** — New menu item **Extensions → Metric Book Transcriber → Setup API key & model** opens a dialog to update API key and/or model (key optional — leave blank to keep current). Option to clear stored API key.
- **Error handling** — Transcription and API errors (e.g. 429 quota) are shown in the dialog with full message and a Close button instead of failing silently. When "Authorisation is required" appears (e.g. collaborators), the add-on shows guidance to install/authorize the add-on for their account.
- **Import from Drive logging** — Additional `Logger.log` in `importFromDriveFolder` for folder ID, folder name, file counts, and completion stats to aid troubleshooting. Clearer error when Drive API is not enabled in GCP (with link to enable it).

### 🔧 Changed

- **Default model** — Switched from `gemini-3.1-pro-preview` to **gemini-flash-latest** for free-tier friendly default (~20 requests/day). Removed `thinkingConfig` and reduced `maxOutputTokens` for Flash compatibility.
- **API key dialog** — Now includes model dropdown; supports "update" mode when opened from **Setup API key & model** (key optional, Save then close). First-time flow unchanged (key required, Save & Continue starts transcription).
- **Installation docs** — Added "Option 0: Install from Marketplace" as the recommended path in `INSTALLATION.md`; updated installation path diagram and logo section. Documented Setup API key & model, model options, rate limits link, and troubleshooting (authorisation, 429, Drive API for custom GCP).
- **README** — Added Marketplace install section, links to Privacy Policy and Terms of Service, fixed broken screenshot reference. Overview updated: model options, Setup API key & model menu, rate limits link.
- **User Guide** — Workflow and API key step updated for model choice and Setup API key & model. Troubleshooting: authorisation error (collaborators), quota/429, rate limits link.

### 📚 Documentation

- Added project spec `SPEC-4-PUBLISH-MARKETPLACE.md` describing the full scope of the publishing project (code changes, docs, manual GCP/Marketplace steps, graphic assets, success criteria, risks).

[0.3.1]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.3.1

[0.3.0]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.3.0-marketplace-prep

## [0.2-gscript-beta](https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.2-gscript-beta) — 2026-03-14

### ✨ Added

- **🔑 In-flow API key setup** — When the API key is not yet configured, the first run of **Transcribe Image** shows a "Set API Key" dialog with brief instructions and a link to [Google AI Studio](https://aistudio.google.com/app/apikey). The user enters the key, clicks **Save & Continue**, and the transcription proceeds automatically — no need to navigate to Project Settings.

### 🐛 Fixed

- **Truncated transcriptions** — Increased `maxOutputTokens` from 8,192 to 65,536 and set `thinkingLevel: "low"` in the Gemini API request. The default HIGH thinking level consumed most of the token budget on internal reasoning, leaving too few tokens for the actual transcription (pages with many records were cut off). Also filter out model "thought" parts so only real text is inserted.
- **Diagnostic logging** — `callGemini()` now logs `finishReason`, token usage (prompt / candidates / thoughts), and warns when the response is truncated (`MAX_TOKENS`).

### 🔧 Changed

- **Transcribe flow refactored** — `transcribeSelectedImage()` now delegates to `doTranscribeFlow()` (selection validation + awaiting dialog) after the API key check. New helper `saveApiKey()` persists the key from the dialog.
- **API key stored in User Properties** — Switched from `PropertiesService.getScriptProperties()` to `PropertiesService.getUserProperties()`. Each user's key is now private to their Google account; other users of the same published add-on cannot see or use another user's key/quota.
- **Language labels in prompt** — Changed language summary labels from short codes (`ru`, `ua`, `en`) to full words (`russian`, `ukrainian`, `english`) to prevent the model from hallucinating incorrect labels (e.g. `run:` instead of `ru:`).

### 📚 Documentation

- README, Installation, User Guide, and Design doc updated to describe the in-app API key prompt and link to Google AI Studio.
- Added project spec `SPEC-3-APIKEY-SETUP.md`.

## [0.1-poc](https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.1-poc) — 2026-02-22 🎉

Initial proof-of-concept release.

### ✨ Added

- **📁 Import Book from Drive Folder** — Menu action that prompts for a Google Drive folder URL or ID, then:
  - Injects a **Context** block at the top of the document (if not present) using a full sample template with bold labels (archive name, reference, villages, common surnames, etc.) from `ContextTemplate.gs`.
  - Imports images from the folder (JPEG, PNG, WebP only), natural-sorted by filename (e.g. page_2 before page_10).
  - For each image: inserts a **Heading 2** with the image name (no extension), a **Source Image Link** line (bold label + clickable link to the Drive file), the image (scaled to document content width), and a page break.
  - Limits to 30 images in this version; skips invalid or oversized images and reports how many were added/skipped.
  - Handles invalid URL, access denied, and empty folder with clear alerts.
- **✍️ Transcribe Image** — Menu action that sends the selected metric book image plus the document's Context section to the **Gemini API** (gemini-3.1-pro-preview), then inserts the structured transcription directly below the image with:
  - Page header, per-record fields (address, names, notes), language summaries (Russian, Ukrainian, Latin, English) as bullets, **Quality Metrics** (blue) and **Assessment** (red).
- **📄 Context template** — Separate `ContextTemplate.gs` with sample template text and bold labels; used when building the doc via Import from Drive.
- **📚 Documentation** — README (overview, mermaid flow diagram), User Guide (Import from Drive, Transcribe step-by-step, troubleshooting), Installation (test deployment, container-bound, clasp), Design doc.
- **📋 Project specs** — SPEC.md (transcription spec), SPEC-1-POC.md, SPEC-2-GDRIVE-to-GDOC.md (Drive Folder Importer spec).
- **🔐 OAuth** — `drive.readonly` scope in manifest for folder access; API key stored in Script Properties only (not in code).

[1.2.0]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v1.2.0
[1.1.1]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v1.1.1
[1.1.0]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v1.1.0
[1.0.0]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v1.0.0
[0.1-poc]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.1-poc
