# Add-on images

## Logo (optional)

Use a GeneaScript logo here and in the manifest if you enable the add-on’s sidebar/`addOns` block.

- **File:** `GeneaScript_logo_med.png` (1000×1000 px) is suitable; Google scales it. For a crisper Extensions menu icon, you can use 48×48 or 128×128 px.
- **Current setup:** This project’s `appsscript.json` has **no** `addOns` block so the add-on runs as an **Editor add-on** via Test deployments. The menu appears in the doc, but there is no sidebar and no `logoUrl` in use.
- **If you add a logo later:** `logoUrl` in `appsscript.json` must be a **public HTTPS URL** (e.g. GitHub raw URL or Cloud Storage). See [INSTALLATION.md](../../docs/en/INSTALLATION.md) and the example below.

Example manifest snippet:

```json
"addOns": {
  "common": {
    "name": "Metric Book Transcriber",
    "logoUrl": "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/addon/img/GeneaScript_logo_med.png"
  },
  "docs": {}
}
```

## User guide screenshots

Screenshots for the user guide live in the **docs** folder:

- `docs/Step1_setDocumentContext.jpg` — Set document context
- `docs/Step2_selectImage_HitTranscribe.jpg` — Select image and run Transcribe Image
- `docs/Step3_TranscriptionFinished.jpg` — Dialog / transcription finished
- `docs/Step4_ReviewTranscriptionResults.jpg` — Review transcription results

They are referenced from [USER_GUIDE.md](../../docs/en/USER_GUIDE.md).
