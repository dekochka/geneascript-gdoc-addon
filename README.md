# Metric Book Transcriber Add-On

A Google Docs add-on that transcribes images of metric books (birth, marriage, and death registers) using the **Google AI (Gemini)** API. You add a **Context** section to your document, select an image, and the add-on inserts a structured transcription **directly below the selected image** with readable formatting (bold labels, language summaries as bullets, Quality Metrics and Assessment highlighted in color).

## Overview

- **Where it runs:** Google Docs (as an Editor add-on via Test deployments, or as a container-bound script).
- **What it does:** Sends the selected metric book image plus document context to Gemini, then inserts the transcription under that image. Output includes page header metadata, per-record fields (address, name, parents, godparents/witnesses, notes), language summaries (Russian, Ukrainian, Latin, English), and Quality Metrics / Assessment (styled in blue and red).
- **Requirements:** A Google AI (Gemini) API key stored in the script’s **Script properties** (`GEMINI_API_KEY`).

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** — Document structure (Context + images), how to transcribe step-by-step, output format, tips, and troubleshooting.
- **[Installation](docs/INSTALLATION.md)** — Prerequisites, API key, and installation options (Editor add-on test deployment, container-bound script, or deploy from repo with clasp).

## Repo layout

- `**addon/`** — Apps Script source: `Code.gs`, `Prompt.gs`, `appsscript.json`.
- `**docs/**` — User guide, installation, design; screenshots (Step1–Step4) for the guide.

