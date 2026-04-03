# GDoc Metric Book Transcriber Add-On — Design Document

## 1. Overview

The add-on allows a user to transcribe a selected metric book image in a Google Doc using the Google AI (Gemini) API. The script reads a **Context** section from the document, builds a prompt (role + context + schema + output format), sends the selected image and prompt to Gemini, and inserts the transcription text immediately after the image.

References: [SPEC.md](../project/SPEC.md), [Google Workspace Add-ons](https://developers.google.com/workspace/add-ons/overview), [Apps Script Document service](https://developers.google.com/apps-script/reference/document).

---

## 2. Architecture

### 2.1 Entry points

- **`onOpen(e)`**  
  Runs when the document is opened. Adds a custom menu to the Docs UI:
  - **Extensions** (or **Add-ons**) → **Metric Book Transcriber** → **Transcribe Image**.

- **Main action: Transcribe Image**  
  Bound to a function (e.g. `transcribeSelectedImage()`) that:
  1. Validates environment (API key, selection).
  2. Extracts the Context section from the document.
  3. Gets the selected inline image and its blob.
  4. Builds the prompt and calls the Gemini API (image + text).
  5. Inserts the API response text in the document after the image.

All logic runs in the user’s Apps Script project; there is no separate backend server.

### 2.2 Execution context

- Script is **bound to the document** (container-bound). The add-on runs in the context of the open Doc; `DocumentApp.getActiveDocument()` is used to access the document and selection.
- Menu runs in **authorization mode**: the first time the user runs “Transcribe Image,” they must authorize the script (Document access, Script Properties, external HTTP to `generativelanguage.googleapis.com`).

### 2.3 Drive import architecture

The add-on uses the **Google Picker API** for importing metric book scan images from Google Drive into a document:

**Google Picker flow**
- User selects **Extensions → Metric Book Transcriber → Import Book from Drive Files** (or sidebar button)
- Loading dialog opens (1100×700px) with “Loading Google Picker...” message and brief instructions
- Picker configuration retrieved from script properties (`GOOGLE_PICKER_API_KEY`, `GOOGLE_PICKER_APP_ID`)
- OAuth token generated via `ScriptApp.getOAuthToken()`
- **Document's parent folder detected** via `DriveApp.getFileById(docId).getParents()`
- Google Picker API loads, Picker opens automatically in same dialog
- **Picker starts in document's parent folder** (if available) - aligns with workflow where doc is created in same folder as images
- **Two Picker tabs available:**
  - **Images tab**: Flat view using `google.picker.ViewId.DOCS_IMAGES` (images only), mode `LIST`
  - **Folders tab**: Folder browser with `setIncludeFolders(true)` and MIME type filter for images
- Both views: `MULTISELECT_ENABLED`, size 1051×650px (Google Picker API maximum)
- Brief instructions shown for 3 seconds, then hidden
- User navigates folders (in Folders tab), selects 1-30 image files (JPEG/PNG/WebP)
- **Client-side validation**: `onPicked()` callback filters non-image files by MIME type before import
- Selected file IDs passed to `importFromDriveFileIds(ids)`
- For each ID: `DriveApp.getFileById(id)` retrieves file (requires `drive.file` scope + user selection)
- Images inserted with Context block, H2 headings, source links, scaling, page breaks
- Status shown in dialog: “Importing X images... (skipped Y non-image files)” if applicable
- On completion: “Import complete!” shown briefly, dialog closes

**OAuth scope model (v0.9.0+):**
- **`drive.file` scope** (non-sensitive): “View and manage Google Drive files that you have opened or created with this app”
- **Access granted to:**
  - Files explicitly selected via Picker
  - Files created by app (not applicable to this add-on)
- **Access NOT granted to:**
  - All user files (no blanket access)
  - Files not selected via Picker
- **Previous scope** (`drive.readonly`): Removed in v0.9.0 per Google OAuth verification requirements (too broad, violates minimum scope requirement)

**Configuration (script properties, set by publisher/deployer):**
- `GOOGLE_PICKER_API_KEY`: API key from GCP Console with Picker API enabled
- `GOOGLE_PICKER_APP_ID`: GCP project number
- If not set: Picker shows error message, import fails

**Import flow:**
1. Collect file IDs from Picker selection
2. Loop through IDs, call `DriveApp.getFileById(id)` for each
3. Validate MIME type (`image/jpeg`, `image/png`, `image/webp`)
4. Natural sort by filename (digit segments compared numerically)
5. Truncate to `MAX_IMPORT_IMAGES` (30)
6. Ensure Context block exists (`ensureContextBlock()` checks for “Context” heading)
7. For each image:
   - Insert H2 heading (filename without extension)
   - Insert “Source Image Link: [filename]” as hyperlink to Drive URL
   - Insert image blob via `body.appendImage(blob)`
   - Scale to content width minus margins if larger
   - Insert page break
8. Log observability events (per-file status, summary counts)
9. Alert user with success/skip counts

**Error handling:**
- Picker not configured → Error message in dialog: “Picker is not configured. Contact your administrator.”
- Picker API load failure → Error message in dialog: “Failed to load Google Picker API. Check your network connection.”
- User selects only non-image files → Error message in dialog: “Only image files (JPEG, PNG, WebP) can be imported.”
- File access denied → Skipped by server-side import, counted in status
- File deleted/moved → Skipped by server-side import, counted in status
- Non-image file selected → Filtered by client-side validation, counted in status: “Importing X images... (skipped Y non-image files)”
- Import exceeds 30 limit → Server-side truncation, alert shows “Added 30, skipped X (limit reached)”

**References:**
- Full specification: [SPEC-9-OAUTH-SCOPE-MIGRATION.md](../project/SPEC-9-OAUTH-SCOPE-MIGRATION.md)
- Original Drive import spec: [SPEC-2-GDRIVE-to-GDOC.md](../project/SPEC-2-GDRIVE-to-GDOC.md)

---

## 3. Context extraction

### 3.1 Convention

- The document must contain a **Context** section that appears **before** the metric book images.
- **Convention**: a paragraph that contains exactly the heading text **Context** (case-sensitive), followed by one or more paragraphs of body text until the next heading or a clear end (e.g. next section titled “Images” or similar). All text in that block is treated as the context string for the prompt.
- No strict key-value format is required; the spec mentions ARCHIVE_REFERENCE, DOCUMENT_DESCRIPTION, DATE_RANGE, VILLAGES, COMMON_SURNAMES. The implementation will take the raw text of the Context section and inject it into the prompt’s “Context” block.

### 3.2 Algorithm

1. Get `DocumentApp.getActiveDocument().getBody()`.
2. Iterate over body children (paragraphs, tables, etc.).
3. Find the first paragraph whose text (trimmed) equals `"Context"`.
4. Collect text from the following siblings until:
   - another heading-level paragraph (e.g. same style as “Context” or a known heading), or
   - a fixed maximum number of paragraphs (e.g. 50) to avoid runaway.
5. Concatenate collected paragraphs with newlines → **context string**.
6. If “Context” is never found, use an empty string and still call the API (model can work without context but result may be less accurate).

### 3.3 Edge cases

- Empty Context section: allow; pass empty string.
- Multiple “Context” headings: use the first occurrence only.
- Context in a table: out of scope for v1; only search body direct children (paragraphs). Table support can be added later if needed.

---

## 4. Image handling

### 4.1 Selection model

- The user must **select** a single **inline image** in the document (click on the image so it is selected).
- The script uses `DocumentApp.getActiveDocument().getSelection()`.
- If there is no selection or the selection is invalid, show a message: “Please select a single image (metric book scan) and run Transcribe Image again.”

### 4.2 Getting the selected image

1. `var selection = doc.getSelection();`
2. If `!selection`, show error and return.
3. `var rangeElements = selection.getRangeElements();`
4. If `rangeElements.length !== 1`, show “Please select exactly one image.”
5. `var element = rangeElements[0].getElement();`
6. If `element.getType() !== DocumentApp.ElementType.INLINE_IMAGE`, show “Please select an image (click on the metric book image).”
7. Cast to `InlineImage`: the element is the inline image.

### 4.3 Blob and base64 for API

- **InlineImage** supports `getBlob()` (and optionally `getAs(contentType)`).
- Use `imageElement.getBlob()` to get the image blob.
- MIME type: `blob.getContentType()` (e.g. `image/png`, `image/jpeg`). If missing or unsupported, default to `image/png` for the API.
- For Gemini: encode image as base64. In Apps Script: `Utilities.base64Encode(blob.getBytes())`.
- **Size**: Gemini has limits on image size. If the blob is very large (e.g. > 4 MB), consider resizing or compressing in a future version; for v1, send as-is and rely on API error handling if over limit.

### 4.4 Locating the image for insertion

- The same selected element (InlineImage) lives inside a **parent** (e.g. Body or a list item).
- We need to insert the transcription **immediately after** this image.
- **Approach**: get the parent of the inline image (`element.getParent()`). The parent is a **Paragraph** (inline images sit inside paragraphs). Then get the **parent of that paragraph** (usually Body) and the **index** of the paragraph in the body. Insert a **new paragraph** at index `paragraphIndex + 1` with the transcription text. If the parent is not Body (e.g. header/footer), fall back to inserting after the image’s paragraph by appending to the body or using the paragraph’s next sibling if the API allows; for v1 we assume the image is in the body.
- **Simpler approach**: get the paragraph that contains the image, then get its index in the body. Insert a new paragraph at `childIndex + 1` in the body. So: `body.insertParagraph(childIndex + 1, transcriptionText)` and ensure the new paragraph is not a direct child of the same paragraph as the image—we insert at body level. So we need the **body child index** of the paragraph that contains the image. Algorithm: `var body = doc.getBody(); var numChildren = body.getNumChildren();` loop and find which child is the paragraph containing our image (compare by reference or by walking from image up to paragraph, then paragraph’s index in body). Then `body.insertParagraph(index + 1, text)`.

---

## 5. Gemini integration

### 5.1 Endpoint and model

- **URL**: `https://generativelanguage.googleapis.com/v1beta/models/MODEL_ID:generateContent?key=API_KEY`
- **Model ID**: `gemini-2.0-flash` or the value from the spec (`gemini-3-flash-preview`). At implementation time use the current Gemini image-capable model name (spec may say `gemini-3-flash-preview`; if that ID does not exist, use e.g. `gemini-2.0-flash` or the latest flash model that supports inline image input).
- **API key**: Stored in User Properties (see Configuration). Key is not hardcoded.

### 5.2 Request payload

- **Method**: POST.
- **Headers**: `Content-Type: application/json`.
- **Body**: JSON with structure:
  - `contents`: array of one object.
  - `contents[0].parts`: array of **two** parts:
    1. **Text part**: `{ "text": "<full prompt>" }` (role + context + schema + output format + instructions from SPEC).
    2. **Inline data part**: `{ "inline_data": { "mime_type": "<image MIME>", "data": "<base64-encoded image>" } }`.
- **Timeout**: 60 seconds (1 minute) as per spec. In Apps Script: `UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: 60 })` (timeout in seconds in some environments; confirm Apps Script UrlFetchApp timeout parameter).

### 5.3 Response handling

- Parse `response.getContentText()` as JSON.
- Success: extract generated text from `response.candidates[0].content.parts[0].text` (or equivalent path per Gemini API response schema). If `candidates` is empty or blocked, check `promptFeedback` and show a user-visible message.
- HTTP errors (4xx/5xx): show a short message (e.g. “API error: …” or “Check your API key and try again.”).
- Timeout / network errors: catch and show “Request timed out or network error. Try again.”

### 5.4 User-visible errors

- No selection / no image selected: toast or `SpreadsheetApp.getUi().alert()` — in Docs we use a simple dialog or toast if available (e.g. `DocumentApp.getUi().alert()`).
- Missing API key: “Please set your Google AI API key in Script Properties (Project Settings).”
- API/key errors: show one-line message in dialog/toast.

---

## 6. Prompt assembly

### 6.1 Structure

The prompt is built from the following parts (full text in [SPEC.md](../project/SPEC.md)):

1. **Role** (fixed): Expert archivist and paleographer for 19th/20th-century Galician vital records; task is to extract and transcribe handwritten text from the attached metric book image.
2. **Context** (dynamic): “Section extracted from Context Section of Google Doc…” replaced by the actual **context string** from the document.
3. **Input template description**: List of expected table columns for births, deaths, and marriages. Use the **full schema definitions** from SPEC (births, deaths, marriage tables) so the model knows column names and formats.
4. **Output format**: Page header format, record output format (Russian, Ukrainian, Latin, English), quality metrics and assessment template. Include the **examples** from SPEC (birth, marriage, death) so the model sees the desired structure.
5. **Instructions**: Step 1 (page header extraction), Step 2 (record extraction), and the “Original Latin Transcription Note” (accuracy, brackets for uncertain text, village name in header/column).

### 6.2 Storage

- Prompt text (role, schema summaries, output format, instructions) is stored **in code** as a single template string (or a few concatenated strings). The only variable is the **Context** block, which is injected where the spec says “{{Section extracted from Context Section…}}”.
- Full wording is in SPEC; the implementation will embed a copy in the script and keep it in sync with SPEC for maintenance.

---

## 7. Insertion

### 7.1 Where to insert

- Insert **one new paragraph** immediately after the **paragraph that contains the selected image** (at the Body level). So the transcription appears directly under the image.

### 7.2 Format

- The API returns a single text block (markdown or plain). Insert it as **plain text** in one paragraph. If the response is long, a single paragraph in Docs is acceptable; alternatively split on double newlines and insert multiple paragraphs for readability. For v1: insert as one paragraph; if the result is hard to read, a follow-up can split by `\n\n`.
- The spec asks for “Quality Metrics” and “Assessment” sections in the output; those will be part of the model’s text and thus appear in the inserted block. No extra formatting (e.g. bold) is required for v1.

### 7.3 Cursor position

- After insertion, optionally place the cursor at the end of the inserted text so the user can edit or add the “Assessment” part. Not required for v1; can be added later.

---

## 8. Configuration

### 8.1 API key

- **Storage**: User Properties (private per Google account). Key name `GEMINI_API_KEY`. Using User Properties ensures each user's key is isolated — other users of the same published add-on cannot see or consume another user's API quota.
- **In-flow setup**: The first time the user runs **Transcribe Image** without a key, `transcribeSelectedImage()` shows a modal dialog (`showApiKeyDialog()`) with brief instructions and a link to [Google AI Studio](https://aistudio.google.com/app/apikey). The user enters the key and clicks **Save & Continue**; `saveApiKey()` persists the key to User Properties and the transcribe flow continues automatically.
- **Manual setup**: User can also set the key via `PropertiesService.getUserProperties().setProperty('GEMINI_API_KEY', 'key')` in the script editor console.
- **Usage**: At runtime, `PropertiesService.getUserProperties().getProperty("GEMINI_API_KEY")`. If missing or empty, `transcribeSelectedImage()` shows the API key dialog instead of proceeding. The worker (`runTranscribeWorker`) also checks as a safeguard.

### 8.2 Model ID

- Can be hardcoded (e.g. `gemini-2.0-flash` or `gemini-3-flash-preview` as per spec). If the model name changes, update the constant in code. Optional: allow override via Script Property for power users.

### 8.3 No secrets in code

- The script must not contain the API key or any other secrets. All sensitive configuration is in User Properties (per-user, private).

---

## 9. File layout (repo)

After implementation, the repo layout is:

- **docs/**  
  - **DESIGN.md** (this file)  
  - **INSTALLATION.md** — how to install and configure the add-on and API key  
  - **USER_GUIDE.md** — how to structure the doc and use “Transcribe Image”
- **project/**  
  - **SPEC.md** — product and prompt spec
- **addon/** (Apps Script project)  
  - **Code.gs** — `onOpen`, `transcribeSelectedImage`, and helpers (context, image, prompt, Gemini, insert)  
  - **Prompt.gs** — prompt template with `{{CONTEXT}}` placeholder  
  - **appsscript.json** — manifest (Docs add-on, `documents.currentonly` scope)

---

## 10. Summary

| Area            | Decision                                                                 |
|-----------------|--------------------------------------------------------------------------|
| Context         | First paragraph with text “Context”; collect following paragraphs.      |
| Image           | Single selected InlineImage; blob → base64 for API.                      |
| Insertion       | One (or more) new paragraph(s) after the image’s paragraph in Body.     |
| Gemini          | v1beta generateContent, image + text in `contents[0].parts`, 60s timeout.|
| Prompt          | Role + context + full schema + output format + examples + instructions.  |
| Configuration   | API key in User Properties (per-user, private).                                       |

This design is intended to be implemented in Phase 2 (Apps Script) and refined only if review or testing reveals gaps.
