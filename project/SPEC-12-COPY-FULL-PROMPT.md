# Feature specification: Copy Full Prompt

**Status:** Approved  
**Target version:** v1.2.0  
**Related:** `SPEC-10-PROMPT-TEMPLATE-GALLERY.md`, `SPEC.md` (prompt structure)  
**Mockup:** `project/mocks/v1.2-copy-prompt-option-A-final.html`

---

## 1. Overview and user story

**What we are building and why**

Users want to reuse the exact transcription prompt outside the add-on — in Google AI Studio, ChatGPT, other LLM playgrounds, or as training data for fine-tuning. Today the prompt is assembled internally and never exposed. This feature adds two copy-to-clipboard entry points in the Template Gallery dialog so users can grab the full prompt (with their document context already injected) in one click.

**User story**

- As a genealogist, I want to copy the full transcription prompt (with my document's context) so that I can paste it into AI Studio or another chat to experiment with settings, compare models, or build fine-tuning datasets.

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|--------|
| Server function `getFullPromptForClient()` | `addon/TemplateGallery.gs` | Assembles prompt with `{{CONTEXT}}` replaced |
| I18n keys (EN/UK/RU) | `addon/I18n.gs` | Tab label, button text, copied/failed feedback, tooltip |
| Gallery client i18n bundle | `addon/I18n.gs` → `getGalleryClientI18n()` | Expose new keys to dialog JS |
| Dialog HTML: Full Prompt tab + corner icon | `addon/TemplateGallery.gs` → `getTemplateGalleryHtml()` | CSS, HTML, JS additions |

**Out of scope**

- Copying the image or API request JSON payload
- Copying model/temperature/token settings
- Any changes to the prompt content itself
- New OAuth scopes

## 3. UI and frontend

**Entry points (two, same action)**

1. **Corner icon button** — top-right of the dialog, next to "Currently using: …". Small outlined button with clipboard-check icon and label "Copy prompt". Always visible.
2. **"Full Prompt" tab** — 6th tab in the review panel tab bar. When active, shows a blue info bar with "Copy to clipboard" button above a scrollable read-only view of the fully assembled prompt.

**Behavior**

- Both buttons call `getFullPromptForClient(templateId)` server-side, then copy the returned text to clipboard.
- On success: button flashes green checkmark + "Copied!" for 2 seconds, then resets.
- On failure (clipboard API blocked): show status message "Copy failed — select text manually".
- The Full Prompt tab content is loaded on tab switch (not eagerly) and cached per template switch.
- Clipboard strategy: `document.execCommand('copy')` via hidden textarea (reliable in Apps Script sandboxed iframe). Fall back to `navigator.clipboard.writeText()` if available.

**Error states**

- Template not selected → corner icon disabled
- Server call fails → tab shows "Error: could not load preview"
- Clipboard blocked → status message with manual fallback hint

## 4. Apps Script backend

**Core logic**

New function assembles the prompt identically to `buildPrompt()` in `Code.gs` but is callable from the client dialog.

**Functions and contracts**

| Exposed to client? | Function name | Args | Return |
|--------------------|---------------|------|--------|
| Yes | `getFullPromptForClient` | `templateId: string` | `string` (full prompt text) |

The function:
1. Calls `getPromptForTemplate(templateId)` to get the raw template
2. Reads document context via `getContextFromDocument(doc)`
3. Replaces `{{CONTEXT}}` with context (or `(No context provided.)` if empty)
4. Returns the assembled string

**OAuth / manifest**

- New or changed scopes: **No**

## 5. Edge cases

- **No document context** — prompt returned with `(No context provided.)` placeholder, same as actual API call
- **Unknown template ID** — returns empty string (guarded by existing `getPromptForTemplate`)
- **Preview panel closed** — corner icon still works (doesn't require panel to be open)
- **Large prompt** — max ~5KB, well within clipboard limits
- **Sandboxed iframe** — `navigator.clipboard` may be blocked; `execCommand('copy')` is the primary path

## 6. Acceptance criteria

- [ ] "Full Prompt" tab appears as 6th tab in review panel
- [ ] Tab content shows the complete assembled prompt with actual document context injected
- [ ] "Copy to clipboard" button in the tab copies exact prompt text
- [ ] Corner "Copy prompt" icon button visible in top-right of dialog
- [ ] Corner button copies same prompt text as tab button
- [ ] Both buttons show "Copied!" green feedback on success
- [ ] Clipboard failure shows fallback message
- [ ] All UI strings localized in EN, UK, RU
- [ ] No new OAuth scopes required
- [ ] No secrets or API keys in copied text (prompt is template + context only)

## 7. Manual / Google-side steps

None — no scope or manifest changes.
