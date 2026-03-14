# Google Workspace Marketplace — Store Listing Copy

Use the text below when filling out the Store Listing page in the Google Workspace Marketplace SDK console.

---

## Application Name

```
Metric Book Transcriber
```

(24 characters; limit 50)

## Short Description

```
Transcribe metric book images (birth, marriage, death registers) using Google AI. Import scans from Drive, get structured output with names, dates, and quality metrics.
```

(168 characters; limit 200)

## Detailed Description

```
Metric Book Transcriber is a free, open-source Google Docs add-on for genealogists and archivists working with 19th and early 20th-century vital records (metric books). It uses the Google AI (Gemini) API to read handwritten text from scanned images and insert a structured transcription directly into your document.

FEATURES

Import from Google Drive
Open a Google Doc, run "Import Book from Drive Folder," and paste a Drive folder URL. The add-on inserts a Context template and up to 30 images (JPEG, PNG, WebP), natural-sorted by filename, each with a heading and source link.

AI-Powered Transcription
Select any metric book image in your document and run "Transcribe Image." The add-on sends the image and your document's Context section to Gemini and inserts the transcription below the image — no copy-pasting required.

Structured Output
Each transcription includes:
- Page header (year, page number, archival references)
- Per-record fields: address, names, parents, godparents/witnesses, notes
- Language summaries in Russian, Ukrainian, Latin, and English
- Quality Metrics (handwriting quality, trust score) highlighted in blue
- Assessment (output quality, correction notes) highlighted in red

Context-Aware
Add a Context section at the top of your document with archive name, reference numbers, date range, village names, and common surnames. The add-on uses this to improve transcription accuracy and name normalization.

API Key & Model Setup
On first use, the add-on prompts you to enter a Google AI (Gemini) API key (link to Google AI Studio) and choose a model: Gemini Flash Latest (default, free tier ~20 requests/day), Gemini 3.1 Flash Lite (500 requests/day), or Gemini 3.1 Pro Preview (best quality, billing). Your key and model choice are stored privately (per user). Update them anytime via Extensions > Metric Book Transcriber > Setup API key & model. See aistudio.google.com/rate-limit for free tier and billing.

HOW TO USE

1. Open a Google Doc.
2. Run Extensions > Metric Book Transcriber > Import Book from Drive Folder (or add images manually).
3. Edit the Context section to match your source archive and locality.
4. Select an image and run Extensions > Metric Book Transcriber > Transcribe Image.
5. Review the transcription inserted below the image. Use Setup API key & model to change your API key or Gemini model when needed.

REQUIREMENTS

- A Google AI (Gemini) API key (free tier available at aistudio.google.com/app/apikey).
- Images of metric book pages in your Google Doc or a Google Drive folder.

This add-on is open source: github.com/dekochka/geneascript-gdoc-addon
```

## Category

```
Productivity
```

(Alternative: "Education")

## Pricing

```
Free of charge
```

## Support Links

| Field | URL |
|-------|-----|
| Terms of Service | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/TERMS_OF_SERVICE.md` |
| Privacy Policy | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/PRIVACY_POLICY.md` |
| Support | `https://github.com/dekochka/geneascript-gdoc-addon/issues` |
| Help (Learn more) | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/USER_GUIDE.md` |
| Report an issue | `https://github.com/dekochka/geneascript-gdoc-addon/issues` |

## Graphic Assets Checklist

| Asset | Size | Status | File |
|-------|------|--------|------|
| Icon (small) | 32 x 32 px | Done | `addon/img/GeneaScript_logo_32.png` |
| Icon (large) | 128 x 128 px | Done | `addon/img/GeneaScript_logo_128.png` |
| Card banner | 220 x 140 px | Done | `addon/img/GeneaScript_marketplace_banner.png` |
| Screenshot 1 — Menu and transcription results | 1280 x 800 px | Done | `docs/TranscribeAddOn-Screenshot-1280x800.png` |
| Screenshot 2 — Transcription in progress | 1280 x 800 px | Optional | Capture if desired |
| Screenshot 3 — Import from Drive flow | 1280 x 800 px | Optional | Capture if desired |

All icons must be square, color, with transparent backgrounds.
Screenshots must show the add-on running inside Google Docs.
