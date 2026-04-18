# Design: Custom Templates for Transcription

**Date:** 2026-04-18
**Target version:** v1.4
**Status:** Approved (design)
**Related specs:** SPEC-10 (Template Gallery), SPEC-11 (i18n), SPEC-8 (Context Extraction)
**Mocks:** `project/mocks/v1.4-custom-template-*.html`

---

## 1. Overview

Extend the Template Gallery to support user-created custom templates. Users can clone an OOB (out-of-box) template or create one from scratch, customize prompt sections (Role, Input Structure, Output Format, Instructions, Context Defaults), and apply custom templates to documents. Custom templates maintain a parent link to their source OOB template, enabling per-section "Reset to inherited" for safe experimentation.

Custom templates are stored in User Properties (personal library, portable across documents) and can be exported to Document Properties for collaborator access.

---

## 2. Data Model

### Custom template object

```javascript
{
  id: "custom_1713400000000",           // "custom_" + timestamp at creation
  label: "Polish Roman Catholic (Kielce)",
  description: "Polish-language registers from Roman Catholic parishes...",
  parentTemplateId: "galicia_gc",       // null for blank-created templates
  sections: {
    role: "...",
    inputStructure: "...",
    outputFormat: "...",
    instructions: "..."
  },
  contextDefaults: "**ARCHIVE_NAME**: ...\n**ARCHIVE_REFERENCE**: ...",
  createdAt: "2026-04-18T12:00:00Z",
  updatedAt: "2026-04-18T14:30:00Z"
}
```

Custom templates use only `label` + `description` for metadata (no region/religion/recordTypes — those are OOB-only).

### Storage layout

| Store | Key | Value | Purpose |
|-------|-----|-------|---------|
| User Properties | `CUSTOM_TEMPLATES` | JSON array of up to 5 template objects | Personal template library |
| Document Properties | `SELECTED_TEMPLATE_ID` | `"galicia_gc"` or `"custom_1713400000000"` | Active template (existing key) |
| Document Properties | `EXPORTED_CUSTOM_TEMPLATES` | JSON array of exported template objects | Shared with collaborators |

### Template resolution order

1. Read `SELECTED_TEMPLATE_ID` from Document Properties
2. If it starts with `"custom_"`: look in User Properties `CUSTOM_TEMPLATES` first, then fall back to Document Properties `EXPORTED_CUSTOM_TEMPLATES` (collaborator case)
3. If it's an OOB ID: use the hardcoded `TEMPLATES` registry
4. If not found anywhere: fall back to `galicia_gc`

### Prompt assembly for custom templates

Sections joined with `####` headers:

```
#### Role\n\n{sections.role}\n\n#### Context\n\n{{CONTEXT}}\n\n#### Input Template Description\n\n{sections.inputStructure}\n\n#### Output Format\n\n{sections.outputFormat}\n\n#### Instructions\n\n{sections.instructions}
```

The `#### Context\n\n{{CONTEXT}}` block is always injected, so `buildPrompt()` in `Code.gs` requires zero changes.

### Constraints

- Max 5 custom templates per user
- User Properties: 9KB per property, 500KB total
- Estimated ~5-6KB per custom template → ~30KB for 5 templates (well within limits)

---

## 3. File Structure & Function Contracts

### Files changed

| File | Change |
|------|--------|
| `addon/CustomTemplate.gs` (new) | CRUD, storage, editor dialog, export/import |
| `addon/TemplateGallery.gs` | Gallery dialog extended with "My Templates" section, resolution logic extended |
| `addon/I18n.gs` | ~40 new keys in EN/UK/RU |
| `addon/Code.gs` | Sidebar footer version bump |

### `CustomTemplate.gs` — function contracts

| Exposed to client? | Function | Args | Return |
|----|------|------|--------|
| No | `getCustomTemplates()` | — | `Array` (from User Properties) |
| No | `getCustomTemplateById(id)` | `string` | template object or `null` |
| No | `saveCustomTemplate(template)` | `Object` | `{ ok, message }` |
| No | `deleteCustomTemplate(id)` | `string` | `{ ok, message }` |
| No | `assemblePromptFromSections(sections)` | `Object` | `string` (full prompt with `{{CONTEXT}}`) |
| Yes | `getCustomTemplateListForClient()` | — | `[{id, label, description, parentTemplateId}]` |
| Yes | `createCustomTemplateFromParent(parentId)` | `string` | `{ ok, template }` (cloned template) |
| Yes | `createBlankCustomTemplate()` | — | `{ ok, template }` (scaffold) |
| Yes | `saveCustomTemplateFromClient(templateJson)` | `string` (JSON) | `{ ok, message }` |
| Yes | `deleteCustomTemplateFromClient(id)` | `string` | `{ ok, message }` |
| Yes | `duplicateCustomTemplate(id)` | `string` | `{ ok, template }` |
| Yes | `exportCustomTemplateToDocument(id)` | `string` | `{ ok, message }` |
| Yes | `getParentSectionsForReset(parentId)` | `string` | `{ role, inputStructure, outputFormat, instructions, contextDefaults }` |
| Yes | `showCustomTemplateEditorDialog(templateId)` | `string` or `null` | opens modal |

### Changes to `TemplateGallery.gs`

| Function | Change |
|----------|--------|
| `getPromptForTemplate(id)` | Extended: if `id` starts with `custom_`, delegate to `assemblePromptFromSections()` |
| `getContextDefaultsForTemplate(id)` | Extended: if `id` starts with `custom_`, read from custom template object |
| `setSelectedTemplateId(id)` | Remove OOB-only validation, allow `custom_` IDs |
| `getTemplateListForClient()` | Unchanged — only returns OOB list |
| `getTemplateGalleryHtml()` | Extended: adds "My Templates" section below OOB cards, with action buttons |
| `getTemplateSectionsForClient(id)` | Extended: works with custom templates too |

---

## 4. UI Design

### Gallery dialog (updated)

Layout top to bottom (620×700 modal):

1. **Header bar:** "Currently using: [name]" + "Copy prompt" button (unchanged)
2. **Official Templates section:**
   - Label: "OFFICIAL TEMPLATES" (uppercase, grey, 11px)
   - 3 OOB template cards (unchanged from current)
3. **Divider:** horizontal line
4. **My Templates section:**
   - Header: "MY TEMPLATES" label + counter "N of 5"
   - Custom template cards, each showing:
     - Radio button + Label with blue "CUSTOM" badge
     - "Based on: [parent name]" subtitle (if cloned, omitted for blank-created)
     - Description text
     - Action row: Edit | Duplicate | Export to Doc | Delete (link-style buttons)
   - Exported templates from other users show "SHARED" badge, read-only (no Edit/Delete, but can Duplicate)
   - Empty state: icon + "No custom templates yet" message
   - Two dashed create buttons: "+ Create from Template" | "+ Create Blank"
5. **Below (unchanged):** Review Template toggle, scaffold checkbox, Cancel/Apply

Mock: `project/mocks/v1.4-custom-template-gallery.html`, `v1.4-custom-template-gallery-empty.html`

### Create from Template picker

Small modal dialog (420px wide):

- Title: "Create from Template"
- Subtitle: "Choose a template to use as a starting point."
- Radio list of 3 OOB templates (label + meta line)
- "Cancel" / "Create & Edit" buttons
- On "Create & Edit": clones selected OOB → opens editor pre-filled

Mock: `project/mocks/v1.4-custom-template-create-picker.html`

### Editor dialog

Dedicated modal dialog (640×700):

1. **Header:** "Edit Custom Template" / "New Custom Template" + subtitle
2. **Parent info bar** (if cloned): "Based on: [name] — use Reset buttons to restore individual sections"
3. **Metadata fields:**
   - Template Name (required, max 80 chars)
   - Description (required, max 300 chars, with char counter)
4. **Section tabs:** Role | Input Structure | Output Format | Instructions | Context Defaults
5. **Tab panel:**
   - Header with section label + modified indicator (orange dot) + "Reset to inherited" button
   - Monospace textarea (min-height 200px, resizable)
6. **Bottom actions:** "Delete Template" (left, danger) | "Cancel" / "Save" (right)

For blank-created templates: no parent info bar, no "Reset to inherited" buttons.

Mock: `project/mocks/v1.4-custom-template-editor.html`

---

## 5. User Flows

### Flow 1: Create from Template
1. User clicks "+ Create from Template" in gallery
2. Picker dialog opens with 3 OOB templates
3. User selects parent, clicks "Create & Edit"
4. Editor opens pre-filled from parent
5. User edits Name, Description, and sections
6. "Save" → stored in User Properties, editor closes, gallery refreshes

### Flow 2: Create Blank
1. User clicks "+ Create Blank" in gallery
2. Editor opens with empty metadata, sections pre-filled with starter scaffold:
   - **Role:** empty (user must write their own)
   - **Input Structure:** empty
   - **Output Format:** pre-filled with the shared output structure (bold labels, language summaries `**ru:**`, `**uk:**`, `**latin:**`/`**original:**`, `**en:**`, Quality Metrics, Assessment) since this format is consistent across all OOB templates
   - **Instructions:** minimal 3-step skeleton ("Step 1: Extract page header metadata", "Step 2: For each record provide structured summary", "Transcription accuracy: Transcribe exactly as written")
   - **Context Defaults:** pre-filled with the 6 standard field labels (`ARCHIVE_NAME`, `ARCHIVE_REFERENCE`, `DOCUMENT_DESCRIPTION`, `DATE_RANGE`, `VILLAGES`, `COMMON_SURNAMES`) with empty values
3. User fills in all fields
4. "Save" → stored in User Properties, gallery refreshes

### Flow 3: Edit Custom Template
1. User clicks "Edit" on custom card
2. Editor opens with current values
3. User modifies fields/sections, optionally resets sections to parent
4. "Save" updates existing template in User Properties

### Flow 4: Export to Document
1. User clicks "Export to Doc" on custom card
2. Confirmation: "Share this template with document collaborators?"
3. Template JSON written to Document Properties (`EXPORTED_CUSTOM_TEMPLATES`)
4. Success message shown

### Flow 5: Collaborator uses exported template
1. Collaborator opens gallery, sees exported template in "My Templates" with "Shared" badge
2. Can select and apply, but cannot edit or delete (read-only)
3. Can "Duplicate" into their own User Properties to customize

### Flow 6: Delete
1. User clicks "Delete" → confirmation
2. If currently selected on this document, selection reverts to `galicia_gc`
3. Template removed from User Properties, gallery refreshes

---

## 6. Error Handling & Edge Cases

### Storage limits
- Before save: check count < 5. At limit → "Maximum 5 custom templates. Delete one to create a new one."
- Before save: estimate JSON size. If > 9KB → "Template content is too large. Shorten some sections."

### Resolution edge cases
- Selected ID points to deleted custom template → fall back to `galicia_gc`, log warning
- Selected ID is `custom_*` not in User Properties → check `EXPORTED_CUSTOM_TEMPLATES` → if found, use it → if not, fall back to `galicia_gc`
- Exported template survives even if original author deletes from their User Properties (document copy is independent)

### Collaborator scenarios
- Shared templates are read-only (no Edit/Delete, can Duplicate)
- Multiple exports append to the array (unique IDs)

### Editor validation
- Name: required, max 80 characters
- Description: required, max 300 characters
- At least one section must be non-empty
- Empty section: yellow hint "This section will be omitted from the prompt" but allow save

### Parent template updates
- "Reset to inherited" pulls latest OOB content (benefits from future app updates)
- Custom template content is a snapshot — does not auto-update when parent changes (user customizations are stable)

---

## 7. I18n Keys

~40 new keys in EN/UK/RU, grouped by UI area:

**Gallery:** `gallery.section_official`, `gallery.section_my`, `gallery.my_counter`, `gallery.badge_custom`, `gallery.badge_shared`, `gallery.parent_link`, `gallery.create_from`, `gallery.create_blank`, `gallery.empty_title`, `gallery.empty_hint`, `gallery.action_edit`, `gallery.action_duplicate`, `gallery.action_export`, `gallery.action_delete`, `gallery.confirm_delete`, `gallery.confirm_export`, `gallery.exported_ok`, `gallery.limit_reached`

**Create picker:** `picker.create_title`, `picker.create_hint`, `picker.create_go`

**Editor:** `editor.title_new`, `editor.title_edit`, `editor.subtitle`, `editor.parent_info`, `editor.field_name`, `editor.field_desc`, `editor.tab_role`, `editor.tab_input`, `editor.tab_output`, `editor.tab_instructions`, `editor.tab_context`, `editor.reset_btn`, `editor.reset_confirm`, `editor.modified`, `editor.save`, `editor.cancel`, `editor.delete`, `editor.saving`, `editor.saved`, `editor.save_failed`, `editor.name_required`, `editor.desc_required`, `editor.too_large`, `editor.section_empty_hint`

---

## 8. OAuth / Manifest

No new scopes required. Custom templates use Document Properties (`documents.currentonly`) and User Properties (no scope needed). No changes to `addon/appsscript.json`.

---

## 9. Out of Scope

- Community template marketplace / public sharing
- Template versioning / change history
- Per-image template override (template applies to entire document)
- Auto-sync custom templates across devices (User Properties are per-script, not per-Google-account)
- Import/export to file (JSON download/upload)
