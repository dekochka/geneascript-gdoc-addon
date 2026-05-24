# Design: Prompt & Template Restructure (Schema v2)

**Date:** 2026-05-24
**Status:** Draft (pending user review)
**Target spec:** `project/SPEC-17-TEMPLATE-SCHEMA-V2.md` (to be created after approval)
**Scope:** Schema + JSON output + Context redesign + Docs renderer
**Deferred:** Visual composer UI, Sheets renderer, few-shot library storage

---

## 1. Problem Statement

The current template system is monolithic and metric-book-centric:
- Each template is a full prompt string with a `{{CONTEXT}}` placeholder — adding new document types requires writing entire prompts from scratch
- Context fields are hardcoded (archive name, fond/opis, villages) and auto-inserted into docs — irrelevant for personal letters, official documents, etc.
- Output is unstructured markdown text — no structured data for Sheets export or programmatic use
- Translation is always inline (same API call) — no way to skip it for token efficiency
- No few-shot examples support
- Prompt text and template config are mixed together

## 2. Design Goals

1. **Output flexibility** — structured JSON from Gemini (native `responseSchema`), rendered by target-specific renderers (Docs now, Sheets later)
2. **Token efficiency** — composable layers; omit translation, examples, or domain instructions when not needed
3. **Template authoring ease** — adding new document types = defining a config object with inheritance, not writing a full prompt
4. **Context relevance** — each template defines its own context fields; no global hardcoded fields

## 3. Architecture: Layered Pipeline

### 3.1 Template Hierarchy (3 Tiers)

```
Tier 1: Base (Generic Transcription)
├── Tier 2: Document Type Extensions
│   ├── metric_book          — archive context, tabular columns, per-record output
│   ├── personal_correspondence — sender/recipient, freeform input
│   ├── official_document    — issuing authority, case reference
│   └── census_revision      — household structure, age pairs
└── Tier 3: Regional/Period Variants (user-facing)
    ├── galicia_gc_birth     — extends metric_book
    ├── galicia_gc_marriage   — extends metric_book
    ├── galicia_gc_death      — extends metric_book
    ├── russian_orth_birth    — extends metric_book
    ├── russian_orth_confession — extends census_revision
    ├── russian_orth_revision  — extends census_revision
    └── generic_plain         — extends base directly
```

### 3.2 Template Schema v2

Each template is a JSON object with 7 layers:

```jsonc
{
  "id": "galicia_gc_birth",
  "schemaVersion": 2,
  "parent": "metric_book",    // inheritance chain

  // ── Metadata (UI display) ──
  "meta": {
    "label": "Galician GC — Births",
    "description": "19th c. Latin-script birth registers, Austrian Galicia",
    "icon": "child_care",
    "category": "metric_book",
    "region": "galicia_austrian",
    "religion": "greek_catholic",
    "recordType": "birth",
    "timePeriod": "1780-1918"
  },

  // ── Layer 1: Role ──
  "role": {
    "persona": "archival_paleographer",
    "expertise": ["latin_cursive", "polish_latin_names", "ukrainian_cyrillic_names"]
  },

  // ── Layer 2: Context (template-owned fields) ──
  "context": {
    "fields": [
      { "key": "description", "label": {"en":"...", "uk":"...", "ru":"..."}, "type": "text", "required": true },
      { "key": "period", "type": "string" },
      { "key": "sourceLanguages", "type": "tags", "options": ["latin","polish","ukrainian","russian","church_slavonic","german","yiddish","hungarian","romanian"] },
      { "key": "notes", "type": "text" },
      // Extension fields (from metric_book parent):
      { "key": "archiveName", "type": "string" },
      { "key": "archiveReference", "type": "string" },
      { "key": "villages", "type": "tags", "freeInput": true },
      { "key": "commonSurnames", "type": "tags", "freeInput": true }
    ],
    "defaults": {
      "sourceLanguages": ["latin", "polish", "ukrainian"]
    }
  },

  // ── Layer 3: Input Document Structure ──
  "inputSchema": {
    "type": "tabular",   // "freeform" | "tabular" | "structured_form"
    "columns": [
      { "key": "recordNumber", "label": "Numerus Prolis", "latinLabel": "N.P." },
      { "key": "birthDate", "label": "Dies, Mensis nati" },
      { "key": "childName", "label": "Nomen" },
      { "key": "fatherName", "label": "Parentes / Pater" },
      { "key": "motherName", "label": "Parentes / Mater" },
      { "key": "godparents", "label": "Patrini" },
      { "key": "officiant", "label": "Baptizans" },
      { "key": "houseNumber", "label": "Numerus Domus" }
    ],
    "hints": [
      "Abbreviations: fil. = filius/filia, ux. = uxor, agr. = agricola",
      "Names may appear in Latin, Polish, or Ukrainian forms"
    ]
  },

  // ── Layer 4: Output Schema (Gemini responseSchema) ──
  "outputSchema": {
    "type": "object",
    "properties": {
      "pageHeader": {
        "type": "object",
        "properties": {
          "year": { "type": "string" },
          "pageNumber": { "type": "string" },
          "parish": { "type": "string" }
        }
      },
      "records": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "recordNumber": { "type": "integer" },
            "date": { "type": "string" },
            "birthDate": { "type": "string" },
            "baptismDate": { "type": "string" },
            "sex": { "type": "string", "enum": ["M", "F"] },
            "legitimacy": { "type": "string" },
            "houseNumber": { "type": "string" },
            "location": { "type": "string" },
            "officiant": { "type": "string" },
            "names": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "fullName": { "type": "string" },
                  "role": { "type": "string" },
                  "details": { "type": "string" }
                }
              }
            },
            "original": { "type": "string" },
            "notes": { "type": "string" },
            "translation": {
              "type": "object",
              "properties": {
                "uk": { "type": "string" },
                "en": { "type": "string" },
                "ru": { "type": "string" }
              }
            }
          },
          "required": ["recordNumber", "original"]
        }
      }
    },
    "required": ["records"]
  },

  // ── Layer 5: Translation Config ──
  "translation": {
    "enabled": true,
    "mode": "inline",        // "inline" (same API call) | "separate" (2nd call)
    "languages": ["uk", "en", "ru"],
    "fields": ["records[].original"]
  },

  // ── Layer 6: Few-Shot Examples (by reference ID) ──
  "examples": ["galicia_gc_birth_001", "galicia_gc_birth_002"],

  // ── Layer 7: Instructions (symbolic tokens) ──
  "instructions": {
    "general": ["preserve_original_spelling", "mark_illegible_with_brackets", "preserve_abbreviations"],
    "domain": ["decode_latin_abbreviations", "normalize_polish_diacritics"]
  }
}
```

### 3.3 Inheritance Rules

| Layer | Merge strategy |
|-------|---------------|
| `meta` | Child fully overrides parent |
| `role.expertise` | Child array APPENDS to parent (union) |
| `context.fields` | Child fields APPENDED after parent fields (stored: only own additions; resolved: full chain) |
| `context.defaults` | Deep merge (child overrides matching keys) |
| `inputSchema` | Child overrides `type`; `columns` REPLACE parent |
| `outputSchema` | Deep merge; child adds properties into parent's schema (stored: only additions; resolved: full schema sent to Gemini) |
| `translation` | Deep merge (child can override enabled, mode, languages) |
| `examples` | Child array REPLACES parent |
| `instructions.general` | Inherited from parent, child can append |
| `instructions.domain` | Child array APPENDS to parent |

### 3.4 Instruction Library

Symbolic instruction tokens resolve to prompt paragraphs via a central lookup:

```javascript
var INSTRUCTION_LIBRARY = {
  "preserve_original_spelling": "Preserve all original spelling exactly as written, including archaic forms and regional variants.",
  "mark_illegible_with_brackets": "Mark illegible text as [illegible], damaged areas as [torn], uncertain readings as [possibly X].",
  "preserve_abbreviations": "Preserve all abbreviations exactly as written (e.g. fil., ux., agr.). Do not expand them.",
  "decode_latin_abbreviations": "Common Latin abbreviations: fil. = filius/filia, ux. = uxor, agr. = agricola, lab. = laborator.",
  "decode_cyrillic_numerals": "Convert Cyrillic alphabetic numerals to Arabic digits in structured fields (АІ=11, КА=21, ҂АѰНД=1754).",
  "normalize_polish_diacritics": "Preserve Polish diacritics (ą, ę, ł, ó, ś, ź, ż) where clearly written.",
  "extract_one_record_per_row": "Each row in the tabular source represents one record. Extract them individually.",
  "include_page_header_metadata": "Extract page-level metadata (year, page number, parish) into the pageHeader object."
};
```

## 4. Context Redesign

### 4.1 Storage

- Context values stored in **Document Properties** as JSON (`DOC_CONTEXT` key)
- Context is NOT inserted into the document body (unlike current system)
- Context is injected into the prompt at runtime by the prompt compiler

### 4.2 Template-Owned Fields

Each template defines which context fields are relevant via its `context.fields` array. When a user selects a template:
- The Setup Wizard (Context step) shows only fields defined by that template
- Base fields (description, period, sourceLanguages, notes) always present
- Extension fields (archiveName, villages, etc.) appear only for templates that inherit them

### 4.3 Auto-Extract from Cover

The existing cover context extraction feature is preserved but adapted:
- AI reads the first/cover image and returns values matching the template's context field keys
- Values are stored in Document Properties, not inserted as doc text
- Available as "Auto-fill from cover page" button in the Setup Wizard

## 5. UX Flow: Wizard + Compact Sidebar (Option B)

### 5.1 Sidebar (Always Visible)

Compact sidebar with:
- **Template + Context card** — shows current template name, region/period, and context summary (archive, villages count, surnames count). "Edit" link reopens wizard.
- **Translation toggle** — on/off with language list shown when on
- **Transcribe Selected Image** button (primary)
- **Transcribe All Images** button (secondary)
- Settings gear icon in header (links to API key/model config)

### 5.2 Setup Wizard (Modal Dialog)

Two-step wizard, opened via "Set Up Document" (first time) or "Edit" (subsequent):

**Step 1: Choose Template**
- Categories: Generic, Metric Books, Census & Household, Correspondence, Official Documents
- Template cards with radio selection, showing label + description + region/period
- Current selection highlighted

**Step 2: Document Context**
- Shows template name + field count at top
- "Auto-fill from cover page" button (AI extraction)
- Context fields rendered dynamically from template's `context.fields`:
  - `type: "string"` → text input
  - `type: "text"` → textarea
  - `type: "tags"` → chip input with add/remove (+ predefined options if `options` defined, free input if `freeInput: true`)
- Pre-filled with template defaults + any previously saved values
- "Done" saves to Document Properties and closes wizard

### 5.3 User Journeys

**Journey 1: New doc, Generic template**
1. Open add-on → sidebar shows "Set Up Document" prompt
2. Skip setup (or click → wizard Step 1: pick Generic → Step 2: fill description + period → Done)
3. Import images → select image → Transcribe
4. Output: plain text transcription with optional translation bullets

**Journey 2: Galician metric book**
1. Open add-on → click "Set Up Document"
2. Wizard Step 1: browse categories → pick "Galician GC — Births"
3. Wizard Step 2: 8 fields shown (4 base + 4 archive), Galician defaults pre-filled, click "Auto-fill from cover" to extract archive/villages
4. Done → sidebar shows template card with context summary
5. Import images → select → Transcribe
6. Output: structured records with names, dates, locations, translations

## 6. JSON Output Pipeline

### 6.1 Prompt Compiler

Reads the resolved template (after inheritance) and produces:
1. **Prompt text** — assembled from: role persona + expertise → context values → input schema description + column definitions + hints → output format instructions → resolved instruction paragraphs → few-shot example text
2. **Response schema** — the template's `outputSchema` field, passed as Gemini API `responseSchema`
3. **Generation config** — temperature, maxOutputTokens, thinking mode from user settings

### 6.2 API Request

```javascript
{
  contents: [{ parts: [
    { inline_data: { mime_type, data: base64 } },
    { text: compiledPrompt }
  ]}],
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 32768,
    responseMimeType: "application/json",
    responseSchema: template.outputSchema
  }
}
```

### 6.3 Docs Renderer

Maps JSON response → Google Docs paragraphs:

| JSON field | Document element |
|-----------|-----------------|
| `pageDescription` | Italic paragraph (gray) |
| `pageHeader.*` | Summary line: "Year: X · Page: Y · Parish: Z" |
| `records[].recordNumber` | **Bold "Record #N"** paragraph |
| `records[].names[]` by role | **Bold label:** value (child→Name, father→Father, etc.) |
| `records[].date/birthDate/...` | **Born:** / **Married:** / **Died:** lines |
| `records[].location + houseNumber` | **House:** number, location |
| `records[].officiant` | **Officiant:** name |
| `records[].original` | Italic paragraph (verbatim source line, per record) |
| `records[].notes` | ⚠ Italic note (if non-empty) |
| `records[].translation.*` | Bullet list: **uk:** ... / **en:** ... / **ru:** ... |
| Record separator | Empty paragraph |

For base/generic templates (no `records[]`):
| `transcription.original` | Main text paragraphs |
| `transcription.notes` | ⚠ Italic note |
| `translation.*` | Bullet list |

Role-to-label mapping is template-defined (Galician uses "Godparents", Russian might use "Восприемники").

### 6.4 Translation Modes

- **`inline`** — translation fields included in the same API call's output schema. Single request.
- **`separate`** — first call returns transcription only (no translation fields in schema). Second call receives the JSON transcription + translation prompt, returns translations. Useful for: large documents where translation doubles output tokens, or when using different model/temperature for translation.

Template's `translation.mode` determines which path. User can override via the Translation toggle (off = skip entirely).

## 7. Migration (v1 → v2)

### 7.1 Strategy: Clean Migration

On first load after upgrade, the engine auto-converts:

**OOB templates:**
- `galicia_gc` → `galicia_gc_birth` (v2, inherits `metric_book`)
- `russian_orthodox` → `russian_orth_birth` (v2, inherits `metric_book`)
- `generic_plain` → `generic_plain` (v2, inherits `base_transcription`)

**Custom templates:**
- Read existing `sections` object (role, inputStructure, outputFormat, instructions)
- Map to v2 layers:
  - `sections.role` → `role.persona` (text parsed for keywords → expertise tokens)
  - `sections.inputStructure` → `inputSchema.hints` (kept as-is in hints array)
  - `sections.outputFormat` → best-effort mapping to `outputSchema` (fallback: generic schema)
  - `sections.instructions` → `instructions.domain` (kept as free text, not tokenized)
- Custom templates that can't be cleanly mapped get a `"legacyPromptOverride"` field that bypasses the compiler

**Document Properties:**
- `SELECTED_TEMPLATE_ID` values mapped to new IDs (e.g. `galicia_gc` → `galicia_gc_birth`)
- Context text from document body parsed into structured `DOC_CONTEXT` JSON property
- Original "Context" heading section left in doc but no longer read by the engine

### 7.2 Rollback Safety

- v1 template data preserved in User Properties under `CUSTOM_TEMPLATES_V1_BACKUP` key
- If user downgrades add-on version, v1 backup is available

## 8. Few-Shot Examples

### 8.1 Format

Each example is a text description (not an image) stored in a central library:

```jsonc
{
  "id": "galicia_gc_birth_001",
  "templateId": "galicia_gc_birth",
  "description": "A single birth record from 1886 showing typical structure",
  "input": "Row: 1 | 6/6 januari | Btt. 6 januari | Basilius | 1 | Masculus | leg. | Elias Kozij agr. | Anna filia Nicolaus Burkun et Tatianna Symkow | Gregorius Mieczkowski agr. et Pelagia ux. Ignatius Iwanicki | J. Wicherhowski | 2",
  "expectedOutput": {
    "recordNumber": 1,
    "birthDate": "1886-01-02",
    "baptismDate": "1886-01-06",
    "sex": "M",
    "names": [
      { "fullName": "Basilius Kozij", "role": "child" },
      { "fullName": "Elias Kozij", "role": "father", "details": "agricola" }
    ],
    "original": "1 | 6/6 januari | Btt. 6 januari | Basilius | 1 | ...",
    "houseNumber": "2",
    "location": "Temeriwci"
  }
}
```

### 8.2 Storage

Examples stored in code (OOB library) alongside templates. Custom examples are a future feature (not in this spec's scope).

### 8.3 Prompt Inclusion

The prompt compiler serializes referenced examples into the prompt as:
```
#### Example
Input: [example.input]
Expected output (JSON): [JSON.stringify(example.expectedOutput)]
```

## 9. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `addon/TemplateSchemaV2.gs` | **Create** | Template registry v2, inheritance resolver, schema definitions |
| `addon/PromptCompiler.gs` | **Create** | Assembles prompt + responseSchema from resolved template |
| `addon/InstructionLibrary.gs` | **Create** | Symbolic instruction → prompt text lookup |
| `addon/ExampleLibrary.gs` | **Create** | Few-shot example definitions and serializer |
| `addon/DocsRenderer.gs` | **Create** | JSON response → Google Docs paragraph insertion |
| `addon/Code.gs` | **Modify** | Replace `callGemini` to use responseSchema, replace `insertFormattedText` to use DocsRenderer, update sidebar HTML |
| `addon/TemplateGallery.gs` | **Modify** | Setup Wizard dialog HTML, template gallery UI from v2 registry |
| `addon/CustomTemplate.gs` | **Modify** | Migration logic (v1→v2), updated CRUD for v2 schema |
| `addon/ContextTemplate.gs` | **Remove** | Replaced by template-owned context |
| `addon/Prompt.gs` | **Remove** | Replaced by PromptCompiler |

## 10. Verification Plan

1. **Unit-level:** Prompt compiler produces correct prompt + schema for each OOB template
2. **Integration:** Gemini returns valid JSON matching schema for test images
3. **Rendering:** DocsRenderer correctly formats all JSON field types (names, dates, translations)
4. **Migration:** Custom templates from v1 load correctly in v2
5. **E2E:** Full flow — select template → fill context → transcribe → verify output in doc
6. **Eval framework:** Run existing golden datasets against new pipeline, compare quality scores
7. **Regression:** Generic template produces equivalent or better output than v1 `generic_plain`
