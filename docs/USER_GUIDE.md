# User Guide — Metric Book Transcriber Add-On

This add-on transcribes images of metric books (birth, marriage, death registers) using Google AI (Gemini). You provide context in the document, select an image, and the add-on inserts the transcription below the image.

## Document structure

1. **Context section** (required for best results)  
   Add a section titled **Context** near the top of the document. Under it, put any information that helps identify the record, for example:
   - Archive reference (e.g. fond, opis, case)
   - Document description (type of register, parish, locality)
   - Date range of the records
   - Village names
   - Common surnames in the area  

   The add-on takes all text under the heading “Context” (until the next heading or the next section) and sends it to the model. You can use plain text or short lines; no special format is required.

2. **Images**  
   Below the Context section, insert your metric book images (scans) as usual in Google Docs (Insert → Image → Upload or paste). One image per “page” of the register is typical. You can have multiple images in one document.

## How to transcribe an image

1. **Click on the image** you want to transcribe so it is selected (handles appear around it).
2. Open **Add-ons** (or **Extensions**) → **Metric Book Transcriber** → **Transcribe Image**.
3. Click **OK** when the add-on says it is sending the image (the request can take up to about a minute).
4. When it finishes, the transcription text is **inserted in a new paragraph directly under the selected image**. You can edit it, add your own assessment, or leave the “Quality Metrics” and “Assessment” blocks for later.

## What the output looks like

The transcription includes:

- **Page header** — Year, page number, archival references, village names if visible.
- **Per record** — For each birth, marriage, or death on the page:
  - **Address** (village, house number) on the first line.
  - **Names** — main person(s), then parents, then godparents (births) or witnesses (marriages) on separate lines.
  - **Notes** — extra details from the record.
- **Languages** — The model tries to give:
  - Russian
  - Ukrainian  
  - Original Latin (as in the register)
  - English
- **Quality Metrics** — The model’s own scores, for example:
  - Handwriting quality (e.g. 3/5)
  - Trust score (e.g. 4/5) for how well the text matches the image.
- **Assessment** — A place for you to add:
  - Your quality score after checking.
  - Correction notes.

You can edit any of this text in the document.

## Tips

- **Context:** The more precise the context (archive, dates, villages, surnames), the better the transcription and name normalization.
- **Image quality:** Clear, upright scans work best. Cropping to the relevant table or page helps.
- **One image at a time:** Select exactly one image before running “Transcribe Image.” For another image, select it and run the add-on again.

## Troubleshooting

| Issue | What to do |
|-------|------------|
| **“Please select a single image”** | Click on one metric book image so it is selected, then run **Transcribe Image** again. |
| **“Please set your Google AI API key”** | The document’s Apps Script project needs the API key. In the script editor: **Project Settings** → **Script properties** → add `GEMINI_API_KEY` with your key. See [INSTALLATION.md](INSTALLATION.md). |
| **Request failed / API error** | Check that your API key is valid and that the Generative Language API is enabled. If you see a quota or billing message, check your Google AI or Cloud project settings. |
| **Timeout** | The add-on waits up to 60 seconds. If the request times out, try again or use a smaller/simpler image. |
| **Empty or odd transcription** | Ensure the selected element is the image (not a drawing or text). Add or improve the Context section and try again. |

For installation and API key setup, see [INSTALLATION.md](INSTALLATION.md).
