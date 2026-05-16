# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GeneaScript Transcriber** is a Google Docs add-on that transcribes images of 19th/20th-century metric books (birth, marriage, death registers) using the Google AI (Gemini) API. Users import images from Google Drive into a document, then transcribe them individually or in batches using domain-specific templates (Galician Greek Catholic, Russian Imperial Orthodox, or Generic verbatim). The add-on inserts structured transcriptions with multi-language summaries (Russian, Ukrainian, Latin, English) directly below each image.

## Development Commands

### Deploy to Apps Script
`.clasp.json` sets `rootDir: "addon"` — `clasp push` deploys only the `addon/` directory.
```bash
# Push code changes to Google Apps Script
clasp push

# Create a new Apps Script version (after git release)
clasp version "Release v0.x.x"
```

### Observability (Google Cloud Monitoring)
```bash
# Apply log-based metrics and dashboards to GCP
cd observability/scripts
./apply.sh
```

### Weekly Operational Review (`/weekly-report`)
Manually-triggered routine that pulls 7 days of GCP logs, produces a
structured report in `project/operations/weeklyreports/`, and on approval
executes prioritised fixes on a dedicated branch under hard guardrails.
Type `/weekly-report` in Claude Code. Script: `observability/scripts/fetch-weekly-logs.sh`.

**Note:** `project/operations/` is a private git submodule pointing to
`geneascript-ops` (reports contain per-user operational data that doesn't
belong in this public repo). Initial clone: `git clone --recurse-submodules`
or run `git submodule update --init` after cloning.

### E2E Tests (Playwright)
Tests drive Google Docs with a saved Google session and a test deployment (`addon_dry_run` URL).
```bash
# Requires saved auth session at e2e/.auth/google.json
export PLAYWRIGHT_STORAGE_STATE=$PWD/e2e/.auth/google.json

npm run test:e2e              # Run all tests (import test skipped without picker flag)
npm run test:e2e:headed       # Visible browser
npm run test:e2e:debug        # Debug mode
npm run test:e2e:ui           # Playwright UI mode

# Enable full Drive import flow
export GENEASCRIPT_RUN_IMPORT_PICKER=1
npm run test:e2e
```
Tests run serially — each builds on document state from previous tests. See `e2e/README.md` for auth setup.

### Eval Framework (Prompt Quality)
```bash
# Run transcription eval against golden datasets
export GEMINI_API_KEY=...
npx tsx eval/scripts/run-eval.ts
```
See `eval/README.md` for golden dataset structure and scoring dimensions.

### Manual Testing in Google Docs
For changes not covered by E2E, test manually:
  1. Push changes with `clasp push`
  2. Open a test Google Doc
  3. Test via Extensions → GeneaScript menu

## Architecture

### File Structure
- **`addon/`** — Apps Script source code
  - `Code.gs` — Core logic: menu handlers, transcription worker, Drive import, context extraction, API calls
  - `Prompt.gs` — Transcription prompt template with `{{CONTEXT}}` placeholder
  - `ContextTemplate.gs` — Template for imported document context section
  - `ContextExtractionPrompt.gs` — Prompt for extracting context from cover images
  - `I18n.gs` — UI localization (EN/UK/RU); locale stored in User Property `UI_LOCALE`
  - `TemplateGallery.gs` — Region/religion-specific transcription template registry; selected template stored in Document Property `SELECTED_TEMPLATE_ID`
  - `CustomTemplate.gs` — Custom template CRUD, storage (User Properties), and editor dialog; max 5 custom templates per user
  - `Observability.gs` — Structured logging helpers for telemetry (logObsEvent, error classification, cost estimation)
  - `appsscript.json` — Add-on manifest: OAuth scopes, add-on config, runtime settings

- **`docs/`** — User documentation: **`docs/en/`** (plus **`docs/uk/`**, **`docs/ru/`** for the site), STORE_LISTING, DESIGN; GitHub Pages uses Jekyll under **`docs/`**
- **`project/`** — Specs (SPEC.md, SPEC-1 through SPEC-13, TEMPLATE-SPEC.md), **`project/designs/`** — initial design proposals and brainstorm artifacts
- **`e2e/`** — Playwright E2E tests: `geneascript-addon.spec.ts`, `fixtures.ts`, `helpers.ts`; requires saved Google session in `e2e/.auth/google.json`
- **`eval/`** — Prompt quality eval framework: golden datasets (`eval/golden/`), LLM-as-judge scoring scripts, prompt working copies
- **`observability/`** — GCP monitoring config, metrics apply script, dashboards JSON

### Key Architecture Patterns

**Document Structure Convention:**
- Document starts with a **Context** section (heading + structured metadata: archive reference, date range, villages, surnames)
- Followed by imported images, each with: Heading 2 (image name), Source Image Link, the image, page break
- Transcriptions are inserted as new paragraphs immediately after the selected image

**API Integration:**
- Gemini API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL_ID}:generateContent`
- Request payload: `contents[0].parts` array with text (prompt) + inline_data (base64 image)
- API key + model + request settings stored in User Properties (per-user, private)
- Timeout: 60 seconds

**State Management:**
- User Properties (per-user, private): `GEMINI_API_KEY`, `GEMINI_MODEL_ID`, `GEMINI_REQUEST_TEMPERATURE`, `GEMINI_REQUEST_MAX_OUTPUT_TOKENS`, `GEMINI_REQUEST_THINKING_MODE`, `GEMINI_REQUEST_THINKING_BUDGET`, `UI_LOCALE`
- Document Properties (per-document, shared): `SELECTED_TEMPLATE_ID` (transcription template)
- All other state is in the active Google Doc or user's Drive folder

**Error Handling:**
- All server functions use try/catch with structured error payloads: `{ ok: false, message: "..." }`
- Client `.withSuccessHandler` / `.withFailureHandler` pattern
- Observability errors logged with `logObsEvent('error', { errorCode, errorMessage, ... })`

**Context Extraction:**
- Searches document body for paragraph with text "Context" (exact match, case-sensitive)
- Collects following paragraphs until next heading or MAX_CONTEXT_PARAGRAPHS (50) limit
- If "Context" not found, uses empty string (model can still transcribe but less accurately)

**Image Selection:**
- User must select a single InlineImage in the document
- Script validates selection via `DocumentApp.getActiveDocument().getSelection()`
- Image blob converted to base64: `Utilities.base64Encode(blob.getBytes())`

## Spec-Driven Development (SDD)

Follow `.cursor/rules/spec-driven-workflow.mdc` for all non-trivial features:

**Authority order:**
1. Active spec (`project/SPEC-*.md` for the feature in scope)
2. `project/SPEC.md` (product goals, prompt behavior, output format)
3. Implementation (`addon/*.gs`)
4. User-facing docs (`docs/`)

**Phases (do not skip for full SDD):**
1. **Ingestion & Analysis** — Read spec, extract requirements, list edge cases. PAUSE for confirmation.
2. **Implementation Plan** — Step-by-step plan, exact files, data contracts. PAUSE for approval.
3. **UI First (conditional)** — Build UI with mocks if non-trivial, push for user testing. PAUSE.
4. **Server-side & Wiring** — Implement Apps Script logic, remove mocks, wire `google.script.run`.
5. **Verification** — Walk spec acceptance criteria, check scopes/privacy, no hardcoded secrets.

**Triggering SDD:** User says "Run SDD Phases 1–2 for `project/SPEC-X.md` and pause for approval."

**Lightweight mode:** For tiny fixes or changelog-only changes, read related spec section if exists, skip formal phases unless requested.

**New work without a spec:** Propose new `project/SPEC-N-SHORT-NAME.md` from `project/TEMPLATE-SPEC.md` and confirm before substantial implementation.

**Project materials location:** All brainstorm artifacts, design proposals, research notes, and planning documents must be stored under `project/` (e.g., `project/designs/` for initial designs, `project/SPEC-*.md` for specs). Do not create planning/design documents outside the `project/` directory.

## Release & Change Management

Follow `.cursor/rules/release-change-management.mdc`:

**Version sources of truth:**
- **Git tags** on `main` branch (format: `v0.x.y` or `v0.x.y-suffix`)
- **CHANGELOG.md** (Keep a Changelog format)
- Apps Script versions created via `clasp version` after Git release

**After commits/pushes — always ask:**
- Do not create tags, GitHub releases, or `clasp version` without explicit user confirmation
- Ask: should this get a new Git tag, GitHub Release, and `clasp version`?

**Release flow (when approved):**
1. **Analyze** — Review changes since last tag: `git log $(git describe --tags --abbrev=0)..HEAD`
2. **Changelog** — Update `CHANGELOG.md` with new version section
3. **Approval** — Show drafted changelog and proposed tag. PAUSE for confirmation.
4. **Execution** — Commit changelog, create tag, push:
   ```bash
   git add CHANGELOG.md
   git commit -m "chore: release vX.Y.Z"
   git tag vX.Y.Z
   git push origin main --tags
   ```
5. **GitHub Release** — Create release for tag: `gh release create <tag> --title "..." --notes-file <file>`
6. **Apps Script** — Always after GitHub release:
   ```bash
   clasp push --force
   clasp version "Release vX.Y.Z"
   clasp deploy -V <version_number> -d "Release vX.Y.Z"
   ```
7. **GitHub Project** — Close related issues (auto-moves to Done); verify board reflects release

**Constraints:**
- Never tag or version without explicit confirmation
- Keep tag naming consistent (semver with optional suffix)
- Never skip git hooks or amend published commits
- **Always update `ADDON_VERSION`** in `addon/Code.gs` (line ~28) when bumping the version — this constant drives both the homepage card footer and the sidebar footer. Search for `var ADDON_VERSION`

## GitHub Projects Integration

**Project:** [GeneaScript Development](https://github.com/users/dekochka/projects/1) (Board view)
**Project number:** 1 | **Owner:** dekochka

**When to update the project:**
- **New feature/bug identified** → Create GitHub Issue with labels, add to project in Triage
- **Spec approved for implementation** → Move issue to Backlog, set Priority/Type
- **Implementation starts** → Move issue to In Progress
- **PR opened** → PR auto-added via workflow (linked to issue)
- **Work completed** → Close issue (auto-moves to Done via workflow)
- **Weekly ops review** → Create issues for prioritised fixes from ops report

**Status columns:** Triage → Backlog → In Progress → In Review → Done

**Custom fields:**
- Priority: `High` / `Medium` / `Low`
- Type: `Bug` / `Feature` / `Maintenance` / `Documentation` / `Template`

**Labels:** `bug`, `urgent`, `enhancement`, `ui-ux`, `gas-backend`, `template-request`, `documentation`

**Scope requirement:** Token must have `project` scope — run `gh auth refresh -s project` if missing.

**Key IDs (for `gh project item-edit` commands):**
- Project ID: `PVT_kwHODws4ms4BXPGR`
- Status field: `PVTSSF_lAHODws4ms4BXPGRzhSdWgw`
  - Triage: `a2e7a206` | Backlog: `f75ad846` | In Progress: `47fc9ee4` | In Review: `865ddf26` | Done: `98236657`
- Priority field: `PVTSSF_lAHODws4ms4BXPGRzhSdWjI`
  - High: `fb61c7c2` | Medium: `fe9545eb` | Low: `b80d61d0`
- Type field: `PVTSSF_lAHODws4ms4BXPGRzhSdWjo`
  - Bug: `40be0622` | Feature: `b66ee32a` | Maintenance: `de9e6fc3` | Documentation: `5f6817d1` | Template: `3fb161cd`

**Relationship to specs:** GitHub Issues are lightweight public summaries; specs (`project/SPEC-*.md`) remain the detailed authority. Issues link to specs but don't duplicate full technical content.

## OAuth Scopes & Manifest

**Current scopes** (in `addon/appsscript.json`):
- `documents.currentonly` — Read/write active document
- `drive.file` — Access Drive files explicitly opened by the user via the picker
- `script.external_request` — Call Gemini API (whitelist locked to `generativelanguage.googleapis.com` and `www.googleapis.com`)
- `script.container.ui` — Show dialogs/sidebar

**Scope changes require:**
- Update `addon/appsscript.json`
- Review `project/SPEC-4-PUBLISH-MARKETPLACE.md` for privacy/verification implications
- Update `docs/en/PRIVACY_POLICY.md` (and uk/ru site copies if needed) if data access changes

## Observability

**Structured telemetry:**
- All events logged with prefix `OBS:` followed by JSON
- `logObsEvent(eventName, payload)` in `Observability.gs`
- Events include: `transcribe_image_start`, `transcribe_image_completed`, `transcribe_image_error`, `import_started`, `import_completed`, etc.
- User key anonymized via SHA-256 hash of temporary active user key

**Log-based metrics** (managed by `observability/scripts/apply.sh`):
- `geneascript_transcribe_images_count` — Successful transcriptions
- `geneascript_import_runs_count` — Completed imports
- `geneascript_errors_count` — All errors
- Token/cost metrics: `geneascript_prompt_tokens`, `geneascript_output_tokens`, `geneascript_total_tokens`, `geneascript_estimated_cost_usd`
- Latency metrics: `geneascript_transcribe_latency_ms`, `geneascript_import_image_latency_ms`
- User activity: `geneascript_user_activity_count` (for MAU/DAU)

**Dashboard:** `observability/dashboards/geneascript-observability.json`

**GCP project:** `geneascript-extension` (NOT `geneascript`). Required for any `gcloud logging read`, `gcloud logging metrics`, or `gcloud monitoring` command. Set as default via `gcloud config set project geneascript-extension`.

**Fetch structured OBS events directly:**
```bash
gcloud logging read 'resource.type="app_script_function" AND jsonPayload.message:"OBS:" AND timestamp >= "YYYY-MM-DDTHH:MM:SSZ"' \
  --format=json --limit 5000
```
Server-side cap is 5000 entries per call. Parse to NDJSON via `jq -r '.[] | .jsonPayload.message' | grep '"event":"<name>"' | sed 's/^OBS://' | jq -c '.'`. The pre-built weekly summary (`observability/scripts/fetch-weekly-logs.sh`) wraps this and writes aggregated JSON to `project/operations/weeklyreports/data/`.

## External Communication

**Always draft and confirm before posting any external-facing message.** Never post directly without showing the user the full content first and waiting for explicit approval.

Applies to: GitHub issue comments / PR comments / release notes, Telegram messages to users, email replies, Slack/Discord posts, public docs site updates, Marketplace listing edits, and any other channel visible to people outside this laptop.

Workflow:
1. Draft the full message in the chat (both languages if applicable — typically EN + UK).
2. Wait for user confirmation or revisions.
3. Only after explicit "ok" / "post it" / equivalent — invoke the tool that publishes (e.g., `gh issue comment`, `gh pr comment`, `gh release create`).

Why: external messages are public, often hard to edit cleanly, and reach real users (some non-technical, some power users tracking every word). One ambiguous claim baked into a v1.4.4 release note or a GitHub reply lives forever in search results.

## Key Constraints

- **No secrets in code** — API keys stored in User Properties only
- **Single-file Apps Script pattern** — Prefer inline HTML in `Code.gs` over separate `.html` unless spec requires it
- **E2E tests require saved Google session** — Cannot run in stateless CI without `e2e/.auth/google.json`
- **Context size limits** — MAX_CONTEXT_PARAGRAPHS = 50, MAX_IMPORT_IMAGES = 50 (raised from 30 in v1.4.6 based on OBS latency data; SPEC-16 will split this into separate inline/link-only caps)
- **Image MIME types** — JPEG, PNG, WebP only
- **Timeout** — 60 seconds for Gemini API calls

## Common Gotchas

- **Context heading is case-sensitive** — Must be exactly "Context"
- **Image selection required** — User must click on image before running "Transcribe Image"
- **User Properties are per-user** — Each user has their own API key/settings; changes don't affect others
- **Natural sort for imports** — Files sorted naturally (image_2.jpg before image_10.jpg) via `naturalSortFiles()`
- **Observability user key** — Uses `Session.getTemporaryActiveUserKey()` hashed with SHA-256; not persistent across sessions
- **Thinking mode/budget** — Only supported by certain models (e.g., gemini-3.1-pro-preview); flash models ignore these parameters

## Entry Points

**Menu handlers** (in `Code.gs`):
- `onOpen(e)` — Creates "GeneaScript" menu
- `onInstall(e)` — Calls `onOpen()` for initial install
- `showTranscribeSidebar()` — Opens sidebar for batch transcription workflow
- `transcribeSelectedImage()` — Single-image transcription from menu
- `importFromDriveFolder()` — Import images from Drive folder dialog
- `openExtractContextDialog()` — Extract context from cover image dialog
- `showSetupApiKeyAndModelDialog()` — API key and model configuration dialog

**Sidebar homepage** (add-on card):
- `buildHomepageCard()` — Entry point for add-on homepage (sidebar card)

## Maintenance Notes

- **Prompt changes:** Update `addon/Prompt.gs` AND ensure alignment with `project/SPEC.md`
- **Model changes:** Update constants in `Code.gs` (MODEL_ID, etc.) and model list in setup dialog
- **New scopes:** Update `addon/appsscript.json` + review privacy/Marketplace implications
- **New metrics:** Add to `observability/scripts/apply.sh` + update dashboard JSON
- **Docs updates:** Keep `docs/en/USER_GUIDE.md` and `docs/en/INSTALLATION.md` in sync with UI/behavior changes. **Always update all 3 locales** (`docs/en/`, `docs/uk/`, `docs/ru/`) in the same commit — don't update EN alone
