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
Transcribe metric book images (birth, marriage, death registers) using Google™ AI (Gemini™). Import scans from Google Drive™, get structured output with names, dates, and quality metrics.
```

(187 characters; limit 200)

## Detailed Description

Emojis are used for scannability; the Google Workspace Marketplace accepts Unicode. If a field strips or rejects them, remove the emoji prefixes (✨ 📁 🤖 📋 🎯 🔑 📖 ✅) and keep the rest.

```
Metric Book Transcriber is a free, open-source Google Docs™ add-on for genealogists and archivists working with 19th and early 20th-century vital records (metric books). It uses the Google™ AI (Gemini™) API to read handwritten text from scanned images and insert a structured transcription directly into your document.

✨ FEATURES

📁 Import from Google Drive™
Open a Google Docs™ document, run "Import Book from Drive Folder," and paste a Drive folder URL. The add-on inserts a Context template and up to 30 images (JPEG, PNG, WebP), natural-sorted by filename, each with a heading and source link.

🤖 AI-Powered Transcription
Select any metric book image in your document and run "Transcribe Image." The add-on sends the image and your document's Context section to Gemini™ and inserts the transcription below the image — no copy-pasting required.

📋 Structured Output
Each transcription includes:
- Page header (year, page number, archival references)
- Per-record fields: address, names, parents, godparents/witnesses, notes
- Language summaries in Russian, Ukrainian, Latin, and English
- Quality Metrics (handwriting quality, trust score) highlighted in blue
- Assessment (output quality, correction notes) highlighted in red

🎯 Context-Aware
Add a Context section at the top of your document with archive name, reference numbers, date range, village names, and common surnames. The add-on uses this to improve transcription accuracy and name normalization.

🔑 API Key & Model Setup
On first use, the add-on prompts you to enter a Google™ AI (Gemini™) API key (link to Google AI Studio™) and choose a model: Gemini Flash Latest (default, free tier ~20 requests/day), Gemini 3.1 Flash Lite (500 requests/day), or Gemini 3.1 Pro Preview (best quality, billing). Your key and model choice are stored privately (per user). Update them anytime via Extensions > Metric Book Transcriber > Setup API key & model. See aistudio.google.com/rate-limit for free tier and billing.

📖 HOW TO USE

1. Open a Google Docs™ document.
2. Run Extensions > Metric Book Transcriber > Import Book from Drive Folder (or add images manually).
3. Edit the Context section to match your source archive and locality.
4. Select an image and run Extensions > Metric Book Transcriber > Transcribe Image.
5. Review the transcription inserted below the image. Use Setup API key & model to change your API key or Gemini model when needed.

✅ REQUIREMENTS

- A Google™ AI (Gemini™) API key (free tier available at aistudio.google.com/app/apikey).
- Images of metric book pages in your Google Docs™ document or a Google Drive™ folder.

This add-on is open source: github.com/dekochka/geneascript-gdoc-addon

Google, Google Docs, Google Drive, Google AI Studio, and Gemini are trademarks of Google LLC.
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

## Public contact email

Use **geneascript.support@gmail.com** for all public communications (support, feedback, press).

**Where to put it in the Store listing:**
- **Support URL:** Use either your GitHub Issues link (see table below) or a **mailto** link so users can email you: `mailto:geneascript.support@gmail.com`. If the field accepts only HTTP(S), keep the Issues link and add the email in your **Detailed description** or **Post-install tip** (e.g. “Support: geneascript.support@gmail.com”).
- **Developer / Contact:** If the Marketplace SDK has a “Developer contact email” or “Support email” field (often under Store listing or App configuration), enter `geneascript.support@gmail.com` there.

## Support Links

| Field | URL |
|-------|-----|
| Terms of Service | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/TERMS_OF_SERVICE.md` |
| Privacy Policy | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/PRIVACY_POLICY.md` |
| Support | `https://github.com/dekochka/geneascript-gdoc-addon/issues` or `mailto:geneascript.support@gmail.com` |
| Help (Learn more) | `https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/USER_GUIDE.md` |
| Report an issue | `https://github.com/dekochka/geneascript-gdoc-addon/issues` |

## Developer Information

> **Important:** The Marketplace SDK **Developer website** field must point to a real website — **not** a GitHub profile URL (e.g. `https://github.com/dekochka`). GitHub *repo* or *docs* links used elsewhere (Terms, Privacy, Support) are fine; only the **Developer website** itself is restricted.

| Field | Value |
|-------|-------|
| Developer name | GeneaScript |
| Developer website | `https://geneascript.com` |
| Developer email | `geneascript.support@gmail.com` |

The developer website is hosted via GitHub Pages (custom domain pointing to this repo's `docs/` folder). A `docs/CNAME` file in the repository configures the custom domain. DNS records (CNAME for `www`, A/ALIAS for apex) must be set at the domain registrar; see [GitHub Pages custom domain docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).

---

## App details — Edit language

The Store listing requires **App details** → **Edit language** with at least one language.

**What to set:**
1. **English (required)** — Add or select **English**. Fill the three required fields with the text from the sections above:
   - **Application name:** `Metric Book Transcriber`
   - **Short description:** (copy from “Short Description” above)
   - **Detailed description:** (copy from “Detailed Description” above)
   - Click **Done**.
2. **Ukrainian (optional)** — If the form allows “Add language” or another locale, add **Ukrainian** for users in Ukraine. Use the text below.

**Ukrainian — Application name \***
```
Транскриптор метричних книг
```

**Ukrainian — Short description \*** (under 200 characters)
```
Транскрибуйте скани метричних книг (народження, шлюби, смерті) за допомогою Google™ AI (Gemini™). Імпорт з Google Drive™, структурований текст українською, російською, латиною та англійською. Для генеалогів та архівістів Галичини та Західної України.
```

**Ukrainian — Detailed description \***
```
Безкоштовне доповнення Google Docs™ для генеалогів та архівістів, які працюють з метричними книгами 18–20 ст. (латинський запис, Галичина / Західна Україна). Використовує Google™ AI (Gemini™) для розпізнавання рукописного тексту зі сканів і вставляє структуровану транскрипцію в документ.

МОЖЛИВОСТІ: імпорт змінних з Google Drive™; AI-транскрипція обраного зображення; структурований вивід (заголовок сторінки, адреса, імена, батьки, хрещені/свідки, підсумки мовами: російська, українська, латина, англійська); метрики якості та оцінка. Контекст документа покращує точність. Потрібен API-ключ Gemini™ (безкоштовний ярус доступний). Відкритий вихідний код: github.com/dekochka/geneascript-gdoc-addon. Підтримка: geneascript.support@gmail.com

Google, Google Docs, Google Drive, Google AI Studio та Gemini є торговими марками Google LLC.
```

*(Target audience: Ukrainian genealogical researchers, Western Ukraine / Galicia, Latin-script metric books 18th–20th century; output includes Russian, Ukrainian, Latin, and English summaries per addon/Prompt.gs.)*

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

---

## Pre-Submission Checklist (manual console steps)

Before (re-)submitting the app for review, verify these items in the Google Cloud Console and Marketplace SDK:

1. **OAuth consent screen → In production**
   - Google Cloud Console → APIs & Services → OAuth consent screen → Publishing status must be **In production**, not "Testing".
   - "Testing" restricts installs to explicitly listed test users and causes **Error 403: access denied** for anyone else.
   - Moving to production may require completing **OAuth verification** for sensitive scopes (`drive.readonly`, `script.external_request`). See [publishing status docs](https://support.google.com/cloud/answer/10311615#publishing-status).

2. **Marketplace SDK → Store listing**
   - Paste the **Short description** and **Detailed description** from the sections above (EN + UK) -- they contain the required ™ marks and trademark footnote.
   - Set **Developer website** to `https://geneascript.com` (not a GitHub profile URL).

3. **DNS + GitHub Pages custom domain**
   - At the domain registrar for `geneascript.com`: add a **CNAME** record (`www` → `dekochka.github.io`) and **A** records (apex → GitHub Pages IPs) or an **ALIAS** to `dekochka.github.io`.
   - In the repo's GitHub Settings → Pages → Custom domain: enter `geneascript.com` and enable **Enforce HTTPS**.
   - The `docs/CNAME` file in this repo is already configured.

4. **Republish** the app version in the Marketplace SDK after all the above are done.
