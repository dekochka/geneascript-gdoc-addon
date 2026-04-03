# Feature specification: Cover Context Extraction

**Status:** Draft  
**Target version:** 0.8.0  
**Related:** `project/SPEC.md`, `project/SPEC-2-GDRIVE-to-GDOC.md`, `project/SPEC-5-SIDEBAR-BATCH.md`, `project/SPEC-7-API-CONFIG-IMPROVEMENTS.md`

---

## 1. Overview and user story

After importing metric-book images from Google Drive, users need a faster way to populate the document `Context` section. This feature adds an AI-assisted flow where users select a cover/title image, extract contextual metadata, review and edit extracted values, and apply updates to the `Context` block.

**User stories**

- As a user importing a new metric book, I want to extract context from the title page so I do not type all metadata manually.
- As a careful researcher, I want to review and edit AI output before writing it into the document.
- As a maintainer, I want existing manual context editing and transcription behavior to remain backward compatible.

---

## 2. UX design (approval artifact)

### Entry points

- Sidebar action: `Extract Context from Cover Image`.
- Extension menu item: `Extract Context from Cover Image`.

### Primary user flow

1. User imports images from Drive folder.
2. User opens extraction flow from sidebar or menu.
3. User selects one image (expected: cover/title page).
4. User clicks **Extract**.
5. AI result is shown in editable fields.
6. User chooses **Apply Context Updates** (or closes without saving).

### Interaction states

- No images in document -> show clear guidance to import images first.
- Missing API key -> show setup requirement.
- Extraction in progress -> disable extract/apply buttons, show status text.
- Extraction failed -> show actionable error message and keep form open.
- Extraction success -> show editable fields and allow apply.

### Review and editing UX

- Display extracted fields in grouped text inputs:
  - Archive name
  - Archive reference
  - Document description
  - Date range
  - Villages (multiline)
  - Common surnames (multiline)
- Users can adjust any values before save.

### Writeback behavior

- Update known `Context` labels only.
- Preserve unrelated user-authored lines in the context block.
- For villages/surnames, merge new values while preserving existing lines where possible.

---

## 3. Technical design (approval artifact)

### File structure

- Add dedicated extraction prompt file: `addon/ContextExtractionPrompt.gs`.
- Keep transcription prompt in `addon/Prompt.gs`.

### Server contracts

| Exposed to client? | Function | Args | Return |
|---|---|---|---|
| Yes | `extractContextFromImage` | `bodyIndex` | `{ ok, extracted, rawModelText, finishReason }` or `{ ok:false, message }` |
| Yes | `applyExtractedContext` | `extracted` | `{ ok, updatedFields }` or `{ ok:false, message }` |
| Yes | `openExtractContextDialog` | `preselectedBodyIndex?` | opens modal dialog |
| No | `parseContextExtractionResponse` | `responseText` | normalized extraction object |
| No | `normalizeExtractedContext` | `raw` | normalized extraction object |
| No | `upsertContextFields` | `doc`, `extracted` | merge/patch context section |

### AI prompt and parsing

- Prompt requests strict JSON output.
- Parser supports:
  - plain JSON response,
  - fenced ```json blocks,
  - embedded JSON object fallback.
- Normalization:
  - string trim for scalar fields,
  - list coercion for villages/surnames,
  - tolerant handling when some fields are missing.

### Context patch algorithm

1. Ensure `Context` block exists.
2. Locate context paragraph range.
3. Upsert labeled fields:
   - `**ARCHIVE_NAME**`
   - `**ARCHIVE_REFERENCE**`
   - `**DOCUMENT_DESCRIPTION**`
   - `**DATE_RANGE**`
4. Merge villages/surnames into their sections with dedupe.
5. Keep unrelated lines unchanged.

### Observability

Add extraction telemetry events:

- `context_extract_start`
- `context_extract_done`
- `context_extract_error`
- `context_apply_done`
- `context_apply_error`

### OAuth/manifest impact

- No new scopes expected.
- Existing scopes cover:
  - current document access,
  - Drive read access for imported images,
  - external request to Gemini API.

---

## 4. Acceptance criteria

- Users can launch extraction from both sidebar and extension menu.
- Users can extract context from a selected image and review/edit result before apply.
- Context updates are targeted and preserve unrelated content.
- Existing transcription flow continues to use updated context with no regressions.
- Dedicated extraction prompt template is stored in `addon/ContextExtractionPrompt.gs`.
