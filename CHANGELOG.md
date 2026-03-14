# 📋 Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### ✨ Added

- **🔑 In-flow API key setup** — When the API key is not yet configured, the first run of **Transcribe Image** shows a "Set API Key" dialog with brief instructions and a link to [Google AI Studio](https://aistudio.google.com/app/apikey). The user enters the key, clicks **Save & Continue**, and the transcription proceeds automatically — no need to navigate to Project Settings.

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
