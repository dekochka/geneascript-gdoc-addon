# 📖 Metric Book Transcriber Add-On

A Google Docs add-on that helps transcribe images of metric books (birth, marriage, and death registers) using the **Google AI (Gemini)** API. You can **import scan images from a Google Drive folder** into a document (with a Context block and source links), then **transcribe** selected images; the add-on inserts a structured transcription **directly below the selected image** with readable formatting (bold labels, language summaries as bullets, Quality Metrics and Assessment highlighted in color).

## 🎬 Demo

[▶️ Watch a 2-minute demo of Import and Transcribe](https://www.youtube.com/watch?v=Hi8Hu1osihg)

## 📸 Sample Output

![Sample transcription output — image with structured transcription below (Quality Metrics in blue, Assessment in red)](docs/TranscribeAddOn-TranscriptionResults.png)

## 📊 Overview

```mermaid
flowchart LR
  subgraph doc [Google Doc]
    OpenDoc[Open document]
    ContextImages[Context + images in doc]
    SelectImage[Select one image]
    Transcription[Transcription below image]
  end
  subgraph addon [Add-on]
    ImportMenu["Import Book from Drive Folder"]
    TranscribeMenu["Transcribe Image"]
  end
  subgraph external [External]
    DriveFolder[Drive folder URL]
    Gemini[Gemini API]
  end
  OpenDoc --> ImportMenu
  ImportMenu --> DriveFolder
  DriveFolder --> ContextImages
  ContextImages --> SelectImage
  SelectImage --> TranscribeMenu
  TranscribeMenu --> Gemini
  Gemini --> Transcription
```

*Typical flow: import from Drive (or add context and images manually), then transcribe selected images one by one.*

- **📍 Where it runs:** Google Docs (as an Editor add-on via Test deployments, or as a container-bound script).
- **📁 Import from Drive:** **Extensions → Metric Book Transcriber → Import Book from Drive Folder** prompts for a Drive folder URL or ID, then adds a **Context** section at the top (full sample template from `ContextTemplate.gs` with bold labels), imports up to **30 images** from the folder (JPEG, PNG, WebP only), natural-sorted by filename. For each image: a **Heading 2** with the image name (no extension), a **Source Image Link** line (link to the file in Drive), the image (scaled to content width), and a page break. Very large or invalid images are skipped and the final alert reports how many were added or skipped.
- **✍️ Transcribe:** Select an image in the document and run **Transcribe Image**. The add-on sends that image plus the document's Context to **Gemini 3.1 Pro Preview** and inserts the structured transcription under the image. Output includes page header metadata, per-record fields, language summaries (Russian, Ukrainian, Latin, English), and Quality Metrics / Assessment (styled in blue and red).
- **🔑 Requirements:** A Google AI (Gemini) API key (`GEMINI_API_KEY`). The add-on prompts you to enter the key the first time you run **Transcribe Image** (with a link to [Google AI Studio](https://aistudio.google.com/app/apikey)). Each user's key is stored privately (User Properties) and is not shared with others. Drive folder import requires access to the folder (you own it or it's shared with you).

## 📚 Documentation

- **[📘 User Guide](docs/USER_GUIDE.md)** — Import from Drive, document structure (Context + images), how to transcribe step-by-step, output format, tips, and troubleshooting.
- **[⚙️ Installation](docs/INSTALLATION.md)** — Prerequisites, API key, and installation options (Editor add-on test deployment, container-bound script, or deploy from repo with clasp).

## 📂 Repo layout

- **`addon/`** — Apps Script source: `Code.gs`, `ContextTemplate.gs`, `Prompt.gs`, `appsscript.json`.
- **`docs/`** — User guide, installation, design; screenshots (Step1–Step4) for the guide.
- **`project/`** — Specs (SPEC.md, SPEC-1-POC.md, SPEC-2-GDRIVE-to-GDOC.md, SPEC-3-APIKEY-SETUP.md).
