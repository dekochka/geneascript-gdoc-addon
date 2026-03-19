---
layout: default
---
# 📖 User Guide — Metric Book Transcriber Add-On

This add-on helps you transcribe images of metric books (birth, marriage, death registers) using **Google AI (Gemini)**. You can **import scan images from a Google Drive folder** into a document (with a Context block and source links), then **transcribe** selected images; the add-on inserts the transcription **directly below the selected image** with clear formatting.

## 📊 User flow

**Create document & import images**

```mermaid
flowchart LR
  A[📄 Create new Doc] --> B[📁 Import images from Drive]
  B --> C[✅ Review Context + images in doc]
```

**Transcribe flow**

```mermaid
flowchart LR
  D[🔑 Setup Key / Model] --> E[🖼️ Select image]
  E --> F[✍️ Transcribe]
  F --> G[✅ Review results]
```

Repeat **Select image** → **Transcribe** → **Review** for each page you want to transcribe.

## 🔄 Workflow summary

1. **Build the document** — Use **Import Book from Drive Folder** (recommended) or add Context and images manually.
2. **Transcribe** — Select one image at a time and run **Transcribe Image**.
3. **Setup (optional)** — To change your API key or Gemini model anytime, use **Extensions** → **Metric Book Transcriber** → **Setup API key & model**.

**Menu overview**

![Metric Book Transcriber menu items — Transcribe Image, Import Book from Drive Folder, Setup API key & model, Help, Report issue](Step0_Doc_Extension_MenuItems.png)

---

## 📁 Import Book from Drive Folder (recommended)

Use this to create a document with a Context section and all scan images from a folder in one go.

1. Open a **new or existing** Google Doc.
2. Go to **Extensions** → **Metric Book Transcriber** → **Import Book from Drive Folder**.
3. When prompted, paste the **Google Drive folder URL or folder ID** that contains your metric book scans. You can copy the URL from the address bar when the folder is open in Drive (e.g. `https://drive.google.com/drive/folders/...`).

   ![Enter Drive folder URL in the Import dialog](Step1_GDriveImport_SetFolderURL.png)

4. Click **OK**. The add-on will:
   - Add a **Context** section at the top (full sample template with bold labels: archive name, reference, villages, common surnames, etc. — you can edit it).
   - Import **up to 30 images** from the folder (**JPEG, PNG, WebP** only), **natural-sorted** by filename (e.g. page_2 before page_10).
   - For each image: a **Heading 2** with the image name (no extension), a **Source Image Link** line (clickable link to the file in Drive), then the image (scaled to content width), then a page break.

   ![Import in progress — images being added to the document](Step1_GDriveImport_Importing_Images.png)

5. When the import finishes, you'll see how many images were added (and how many skipped, if any). You can now run **Transcribe Image** on any of them (see below).

   ![Import complete — Context and imported images in the document](Step1_GDriveImport_Import_Result.png)

**📌 Notes:** The folder must be one you own or that's shared with you. Very large or invalid images may be skipped; the add-on reports how many were skipped. Edit the Context block with your actual archive and locality details before transcribing for best results.

---

## 📄 Document structure (if you build the doc manually)

![Set document context — Context section and sample metric book image](Step1_setDocumentContext.jpg)

1. **📋 Context section** (required for best results)  
   Add a section titled **Context** near the top of the document. Under it, put any information that helps identify the record, for example:
   - Archive reference (e.g. fond, opis, case)
   - Document description (type of register, parish, locality)
   - Date range of the records
   - Village names
   - Common surnames in the area  

   The add-on sends all text under the heading "Context" to the model. Use plain text or short lines; no special format is required.

2. **🖼️ Images**  
   Below the Context section, insert your metric book images (scans) as usual in Google Docs (Insert → Image → Upload or paste). One image per "page" of the register is typical. You can have multiple images in one document.

## ✍️ How to transcribe an image

1. **🖼️ Click on the image** you want to transcribe so it is selected (handles appear around it).
2. Open **Extensions** → **Metric Book Transcriber** → **Transcribe Image**.

   ![Select image and run Transcribe Image](Step2_selectImage_HitTranscribe.png)

3. **🔑 First time only — API key & model setup:** If no API key is configured yet, a **"Set API Key"** dialog appears. It includes a link to [Google AI Studio](https://aistudio.google.com/app/apikey) where you can get a free key (sign in, click **Create API key**, copy it). In the dialog you can also choose the **model**: default is **Gemini Flash Latest** (free tier ~20 requests/day); other options include **Gemini 3.1 Flash Lite** (500 requests/day) and **Gemini 3.1 Pro Preview** (best quality, billing). Paste the key, pick a model, and click **Save & Continue**. The key and model are saved and the transcription proceeds. To change them later, use **Setup API key & model** from the add-on menu. See [rate limits](https://aistudio.google.com/rate-limit) for free tier and billing.

4. A dialog appears: **"Awaiting response from Gemini API… This may take up to 1 minute."** Leave it open until the request finishes (the status bar may show "Working…").

   ![Transcribing — awaiting response from Gemini API](Step3_Transcribing.png)

5. When the add-on finishes, the dialog closes and you see **"Done — Transcription inserted below the image."** The transcription is inserted **directly under the selected image** (not at the end of the document).

   ![Transcription finished — inserted below the image](Step3_TranscriptionFinished.png)

6. **✅ Review and edit** the result in the document. **Quality Metrics** and **Assessment** lines are colored (blue and red) so they stand out from the historical data.

   ![Review transcription results — Quality Metrics and Assessment highlighted](TranscribeAddOn-TranscriptionResults.png)

### Setup API key & model

To change your API key or Gemini model anytime (for example after hitting free-tier limits or to try a different model), use **Extensions** → **Metric Book Transcriber** → **Setup API key & model**. In the dialog you can pick a model, enter a new API key (or leave it blank to keep the current one), and click **Save**. Use **Clear stored API key** to remove your key so you’ll be prompted again on the next Transcribe.

![Setup API key & model dialog — Model dropdown, API key field, Save, Clear stored API key](Step0_Doc_Extension_SetAPIKey.png)

## 📝 What the output looks like

The transcription includes:

- **📌 Page header** — Year, page number, archival references, village names if visible.
- **📋 Per record** — For each birth, marriage, or death on the page (as **standard paragraphs**, not bullets):
  - **Address** (village, house number).
  - **Name(s)** — main person(s), then parents, godparents (births) or witnesses (marriages).
  - **Notes** — extra details from the record.
- **🔵 Quality Metrics** (shown in **blue**) — e.g. Handwriting quality (3/5), Trust score (4/5).
- **🔴 Assessment** (shown in **red**) — e.g. Quality of output (2/5), correction notes.
- **🌐 Language summaries** (as a **bulleted list**) — Russian, Ukrainian, Latin (original), English.

Blank lines separate records for readability. You can edit any of this text in the document.

## 💡 Tips

- **📋 Context:** The more precise the context (archive, dates, villages, surnames), the better the transcription and name normalization.
- **🖼️ Image quality:** Clear, upright scans work best. Cropping to the relevant table or page helps.
- **1️⃣ One image at a time:** Select exactly one image before running "Transcribe Image." For another image, select it and run the add-on again.

## 🔧 Troubleshooting

| Issue | What to do |
|-------|------------|
| **"Please select a single image"** | Click on one metric book image so it is selected, then run **Transcribe Image** again. |
| **Invalid Drive Folder link** | Paste the full folder URL from the Drive address bar (e.g. `https://drive.google.com/drive/folders/...`) or the folder ID. Use a **folder** link, not a file. |
| **Cannot access folder** | The folder must be owned by you or shared with you. If you added Drive access recently, re-authorize (revoke the app in Google Account → Third-party apps, then run Import again). |
| **No images found in this folder** | Only JPEG, PNG, and WebP are imported. Add at least one image in one of these formats. |
| **Some images skipped** | Very large or invalid images may be skipped; the add-on reports how many. Resize or re-export large scans if needed. |
| **"Set API Key" dialog / API key prompt** | The add-on prompts for a key and model on first use of **Transcribe Image**. Get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey), paste it, choose a model, and click **Save & Continue**. To change key or model later, use **Extensions** → **Metric Book Transcriber** → **Setup API key & model**. See [INSTALLATION.md](INSTALLATION.md). |
| **"Authorisation is required to perform that action"** | Usually means you are a collaborator on the doc and haven’t authorized the add-on for your account. Open **Extensions** → **Metric Book Transcriber** and complete the authorization when prompted. |
| **Quota exceeded / 429 / rate limit** | Free tier has limited requests per day. The add-on shows the error in the dialog. Check [rate limits](https://aistudio.google.com/rate-limit); switch model or enable billing via **Setup API key & model** if needed. |
| **Request failed / API error** | Check that your API key is valid and that the Generative Language API is enabled. If you see a quota or billing message, check [rate limits](https://aistudio.google.com/rate-limit) and your Google AI or Cloud project settings. |
| **Timeout** | The add-on waits up to about 60 seconds. If the request times out, try again or use a smaller/simpler image. |
| **Empty or odd transcription** | Ensure the selected element is the image (not a drawing or text). Add or improve the Context section and try again. |
| **Transcription at bottom of doc** | Ensure you have the latest script; insertion uses the body-level block containing the selected image. Select the image and run again. |

For installation and API key setup, see [INSTALLATION.md](INSTALLATION.md).
