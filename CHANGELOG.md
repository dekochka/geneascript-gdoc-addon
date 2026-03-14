# 📋 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased] — v0.3-marketplace

### ✨ Added

- **🏪 Marketplace publishing preparation** — Manifest, documentation, and code changes to support publishing the add-on to the Google Workspace Marketplace.
- **`addOns` block in manifest** — Added `addOns.common` (name, logoUrl) and `addOns.docs` sections to `appsscript.json` for proper Editor add-on registration.
- **Help menu items** — Added "Help / User Guide" and "Report an issue" items to the add-on menu (open GitHub pages).
- **Privacy Policy** (`docs/PRIVACY_POLICY.md`) — Describes data access, storage, third-party API usage, and user controls. Required for Marketplace listing.
- **Terms of Service** (`docs/TERMS_OF_SERVICE.md`) — Standard terms for the open-source add-on. Required for Marketplace listing.
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

[0.1-poc]: https://github.com/dekochka/geneascript-gdoc-addon/releases/tag/v0.1-poc
