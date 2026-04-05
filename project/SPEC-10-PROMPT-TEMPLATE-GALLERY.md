# Feature specification: Template Gallery

**Status:** Implemented  
**Target version:** v1.0.0  
**Related:** `project/SPEC.md` (prompt structure, column schemas, output format), `project/SPEC-8-COVER-CONTEXT-EXTRACTION.md` (context block management)

---

## 1. Overview and user story

**What we are building and why**

The add-on currently ships a single hardcoded prompt (`Prompt.gs`) and a single context template (`ContextTemplate.gs`), both designed exclusively for Galician Greek Catholic metric books written in Latin/Polish/Ukrainian. Users working with Russian Imperial Orthodox records — written in pre-reform Cyrillic with Church Slavonic conventions — receive a generic prompt that does not understand their column structures, orthographic conventions, or terminology.

The Template Gallery introduces a per-document template selection system. Each template provides a complete, specialized Gemini prompt and context block defaults tailored to a specific region, religion, and era. Users select a template via a modal dialog, preview its full prompt, and apply it. The selected template persists with the document and is used for all subsequent transcriptions.

**User stories**

- As a genealogist working with Russian Imperial metric books, I want a prompt template that understands pre-reform Cyrillic column headers and Church Slavonic terminology, so that transcription accuracy improves.
- As a user starting a new transcription project, I want to choose a record profile that matches my source material, so that the AI receives region-specific hints and column schemas.
- As a power user, I want to preview the full prompt text before applying a template, so that I understand exactly what instructions the AI will receive.

---

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|-------|
| Template registry, prompt functions, context defaults, dialog | `addon/TemplateGallery.gs` (new) | Central file for this feature |
| Delegate to template registry | `addon/Prompt.gs` | Backward-compatible wrapper |
| Delegate to template registry | `addon/ContextTemplate.gs` | Backward-compatible wrapper |
| Menu item + sidebar button | `addon/Code.gs` | Minimal wiring |
| User guide | `docs/USER_GUIDE.md` | Template Gallery section |

**Out of scope**

- Community presets / sharing templates between users
- Handwriting style references or visual aids
- Language toggle for output translation
- Per-image template override (template applies to the entire document)
- User-editable or custom prompt templates

---

## 3. UI and frontend (Phase 3 when non-trivial)

**Entry points**

- Extensions → GeneaScript Metric Book Transcriber → Select Template
- Sidebar: "Template" button/indicator near the top action buttons

**Components / behavior**

- **Template Gallery Dialog** — modal dialog (520×700), inline HTML in `TemplateGallery.gs`
  - Current template indicator at top (e.g. "Currently using: Galician Greek Catholic")
  - Two template cards with radio-style selection, each showing: label, region, religion, record types, short description
  - "Preview Prompt" toggle button — expands/collapses a scrollable read-only panel showing the full prompt text for the selected template; updates when user switches radio selection
  - Checkbox: "Update Context block with template defaults" (checked by default for new/empty docs, unchecked if context already has user data)
  - "Apply" and "Cancel" buttons
  - On Apply: saves template ID, optionally updates context block, shows success message, auto-closes

- **Sidebar indicator** — shows the currently selected template label near the top of the sidebar; clicking opens the gallery dialog

**Preview Prompt Panel**

- Scrollable `<div>` with monospace font, max-height ~250px
- Shows the raw prompt text with `{{CONTEXT}}` placeholder visible
- Read-only — users cannot edit the prompt

**Error states**

- Template ID not found in registry: fall back to default (`galicia_gc`), log warning
- Document Properties write failure: show error message in dialog, do not close

**Mock data**

```json
{
  "ok": true,
  "message": "Template 'Russian Imperial Orthodox' applied. Context block updated."
}
```

---

## 4. Apps Script backend (Phase 4)

**Core logic**

- Template registry stored as a JavaScript object in `TemplateGallery.gs`, keyed by template ID
- Each template entry contains: `id`, `label`, `region`, `religion`, `recordTypes`, `description`, and functions returning the full prompt string and context defaults string
- Selected template ID stored in Document Properties (`SELECTED_TEMPLATE_ID`) via `PropertiesService.getDocumentProperties()`
- `getPromptTemplate()` in `Prompt.gs` and `getContextTemplateText()` in `ContextTemplate.gs` become backward-compatible wrappers that read the selected template ID and delegate to the registry
- Existing transcription pipeline (`buildPrompt` → `getPromptTemplate` → `callGemini`) requires no changes

**Functions and contracts**

| Exposed to client? | Function name | Args | Return / errors |
|--------------------|---------------|------|-----------------|
| No | `getTemplateRegistry()` | — | `Object` (full template registry) |
| No | `getTemplateById(id)` | `string` | template object or `null` |
| No | `getSelectedTemplateId()` | — | `string` (template ID, default `'galicia_gc'`) |
| No | `setSelectedTemplateId(id)` | `string` | `void` |
| No | `getPromptForTemplate(templateId)` | `string` | `string` (full prompt text) |
| No | `getContextDefaultsForTemplate(templateId)` | `string` | `string` (context block text) |
| Yes | `getTemplateListForClient()` | — | `[{id, label, region, religion, recordTypes, description, isSelected}]` |
| Yes | `getPromptPreviewForClient(templateId)` | `string` | `string` (full prompt text for preview) |
| Yes | `applyTemplate(templateId, updateContext)` | `string`, `boolean` | `{ ok: boolean, message: string }` |
| Yes | `showTemplateGalleryDialog()` | — | opens modal dialog |

**Initial templates**

| ID | Label | Region | Religion | Record Types |
|----|-------|--------|----------|-------------|
| `galicia_gc` | Galician Greek Catholic (19th c.) | Galicia (Austrian Empire) | Greek Catholic | Birth, Marriage, Death |
| `russian_orthodox` | Russian Imperial Orthodox (Metricheskaya Kniga) | Russian Empire | Orthodox | Birth, Marriage, Death |

**OAuth / manifest**

- New or changed scopes: **No** — Document Properties access is covered by `documents.currentonly`
- No changes to `addon/appsscript.json`

---

## 5. Edge cases

- **No template selected** (existing documents): Default to `galicia_gc` — zero behavior change for existing users
- **Template changed mid-document**: Only affects future transcriptions; already-inserted transcriptions remain unchanged
- **Context block already has user data**: "Update Context" checkbox lets user opt out of overwriting manually-entered context
- **Invalid template ID in Document Properties**: Fall back to `galicia_gc` with a warning log
- **Document with no Document Properties access**: Gracefully fall back to `galicia_gc` (should not happen with `documents.currentonly` scope)

---

## 6. Acceptance criteria (Phase 5)

- [ ] Two templates available: Galician Greek Catholic and Russian Imperial Orthodox
- [ ] Menu item "Select Template" opens Template Gallery dialog
- [ ] Sidebar shows currently selected template label with button to open gallery
- [ ] Dialog shows template cards with radio selection, description, region/religion/record types
- [ ] "Preview Prompt" toggle shows full prompt text for selected template in scrollable read-only panel
- [ ] Preview updates dynamically when switching between template radio buttons
- [ ] "Apply" saves template ID to Document Properties and optionally updates Context block
- [ ] Template persists per-document (closing and reopening the doc retains the selection)
- [ ] Transcription pipeline uses the selected template's prompt (verified by comparing transcription output)
- [ ] Existing documents without a selected template default to `galicia_gc` with no behavior change
- [ ] `Prompt.gs` and `ContextTemplate.gs` remain backward-compatible wrappers
- [ ] `google.script.run` wiring uses success/failure handlers
- [ ] Errors are caught and surfaced without silent failure
- [ ] No new OAuth scopes required; `appsscript.json` unchanged
- [ ] No secrets or API keys committed in source
- [ ] `docs/USER_GUIDE.md` updated with Template Gallery section

---

## 7. Manual / Google-side steps (if any)

None — no new scopes, no manifest changes, no Marketplace impact.
