# User Guide — Metric Book Transcriber Add-On

This add-on transcribes images of metric books (birth, marriage, death registers) using Google AI (Gemini). You provide context in the document, select an image, and the add-on inserts the transcription **directly below the selected image** with clear formatting.

## Document structure

![Set document context — Context section and sample metric book image](Step1_setDocumentContext.jpg)

1. **Context section** (required for best results)  
   Add a section titled **Context** near the top of the document. Under it, put any information that helps identify the record, for example:
   - Archive reference (e.g. fond, opis, case)
   - Document description (type of register, parish, locality)
   - Date range of the records
   - Village names
   - Common surnames in the area  

   The add-on sends all text under the heading “Context” to the model. Use plain text or short lines; no special format is required.

2. **Images**  
   Below the Context section, insert your metric book images (scans) as usual in Google Docs (Insert → Image → Upload or paste). One image per “page” of the register is typical. You can have multiple images in one document.

## How to transcribe an image

1. **Click on the image** you want to transcribe so it is selected (handles appear around it).
2. Open **Extensions** → **Metric Book Transcriber** → **Transcribe Image**.

   ![Select image and run Transcribe Image](Step2_selectImage_HitTranscribe.jpg)

3. A dialog appears: **“Awaiting response from Gemini API… This may take up to 1 minute.”** Leave it open until the request finishes (the status bar may show “Working…”).
4. When the add-on finishes, the dialog closes and you see **“Done — Transcription inserted below the image.”** The transcription is inserted **directly under the selected image** (not at the end of the document).

   ![Transcription finished](Step3_TranscriptionFinished.jpg)

5. Review and edit the result in the document. **Quality Metrics** and **Assessment** lines are colored (blue and red) so they stand out from the historical data.

   ![Review transcription results](Step4_ReviewTranscriptionResults.jpg)

## What the output looks like

The transcription includes:

- **Page header** — Year, page number, archival references, village names if visible.
- **Per record** — For each birth, marriage, or death on the page (as **standard paragraphs**, not bullets):
  - **Address** (village, house number).
  - **Name(s)** — main person(s), then parents, godparents (births) or witnesses (marriages).
  - **Notes** — extra details from the record.
- **Quality Metrics** (shown in **blue**) — e.g. Handwriting quality (3/5), Trust score (4/5).
- **Assessment** (shown in **red**) — e.g. Quality of output (2/5), correction notes.
- **Language summaries** (as a **bulleted list**) — Russian, Ukrainian, Latin (original), English.

Blank lines separate records for readability. You can edit any of this text in the document.

## Tips

- **Context:** The more precise the context (archive, dates, villages, surnames), the better the transcription and name normalization.
- **Image quality:** Clear, upright scans work best. Cropping to the relevant table or page helps.
- **One image at a time:** Select exactly one image before running “Transcribe Image.” For another image, select it and run the add-on again.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **“Please select a single image”** | Click on one metric book image so it is selected, then run **Transcribe Image** again. |
| **“Please set your Google AI API key”** | In the script editor: **Project Settings** → **Script properties** → add `GEMINI_API_KEY` with your key. See [INSTALLATION.md](INSTALLATION.md). |
| **Request failed / API error** | Check that your API key is valid and that the Generative Language API is enabled. If you see a quota or billing message, check your Google AI or Cloud project settings. |
| **Timeout** | The add-on waits up to about 60 seconds. If the request times out, try again or use a smaller/simpler image. |
| **Empty or odd transcription** | Ensure the selected element is the image (not a drawing or text). Add or improve the Context section and try again. |
| **Transcription at bottom of doc** | Ensure you have the latest script; insertion uses the body-level block containing the selected image. Select the image and run again. |

For installation and API key setup, see [INSTALLATION.md](INSTALLATION.md).
