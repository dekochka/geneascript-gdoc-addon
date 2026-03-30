# Feature specification: API Configuration Improvements

**Status:** Draft  
**Target version:** Unreleased  
**Related:** `project/SPEC.md`, `project/SPEC-3-APIKEY-SETUP.md`, `project/SPEC-5-SIDEBAR-BATCH.md`

---

## 1. Overview and user story

**What we are building and why**

The add-on currently hardcodes key Gemini request settings (for example `temperature`, `maxOutputTokens`, and `thinkingConfig`) inside server code. Users cannot tune quality, determinism, latency, and token usage for different metric-book image quality levels without code edits. This feature adds safe, user-facing request configuration in the existing setup dialog, stores preferences per user, validates inputs to prevent misconfiguration, and applies the settings on every transcription request.

**User stories**

- As a genealogist, I want to tune Gemini request behavior (temperature, output size, thinking controls) so transcription quality matches my source material.
- As a repeated user, I want my request settings saved per account so I do not re-enter them every session.
- As a maintainer, I want strong validation and model-aware constraints so invalid configs do not produce avoidable API failures.

---

## 2. Scope


| Change                                        | File(s)                                                   | Notes                                                        |
| --------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| Add request config model + validation helpers | `addon/Code.gs`                                           | Defaults, parsing, sanitization, server validation           |
| Extend Setup API key & model dialog           | `addon/Code.gs`                                           | Add request-parameter inputs and client-side validation      |
| Align setup modal styling with sidebar        | `addon/Code.gs`                                           | Use same primary button color/style language for consistency |
| Persist extra settings to user properties     | `addon/Code.gs`                                           | Alongside existing API key/model storage                     |
| Apply settings in Gemini call payload         | `addon/Code.gs`                                           | Replace hardcoded `generationConfig` values                  |
| Update docs for setup + troubleshooting       | `docs/USER_GUIDE.md`, `docs/INSTALLATION.md`, `README.md` | Describe new controls and safe defaults                      |
| Update release notes                          | `CHANGELOG.md`                                            | Add Unreleased entry                                         |


**Out of scope**

- Adding advanced parameters outside v1 scope (`topP`, `topK`, `seed`, `stopSequences`, structured schema output).
- Introducing a separate settings page or standalone sidebar for request tuning.
- Changing prompt template semantics in `Prompt.gs`.

---

## 3. UI and frontend (Phase 3)

**Entry point**

`Extensions -> Metric Book Transcriber -> Setup API key & model` and the first-run setup dialog shown during `Transcribe Image`.

**Components / behavior**

- Extend the existing setup modal with a new section: **Request parameters**.
- Exposed v1 controls:
  - `temperature` (default `0.1`)
  - `maxOutputTokens`
  - `thinkingMode` (model-aware)
  - `thinkingBudget` (only when applicable to selected model/mode)
- Preserve current setup flow behavior:
  - First run (`forUpdate=false`): API key required; save and continue.
  - Update mode (`forUpdate=true`): API key optional; save and close.
- Model-aware thinking control behavior (selected approach: **auto by model**):
  - UI options and constraints adapt based on selected model ID.
  - Unsupported combinations are blocked before save.
- Visual style consistency:
  - Primary setup action button (`Save` / `Save & Continue`) uses the same blue primary style pattern as sidebar primary actions.
  - Keep contrast and disabled states readable in Google Docs dialog context.

**Error states**

- Client-side validation failures show inline message in dialog status area.
- Examples:
  - Invalid number format.
  - Temperature outside allowed range.
  - Thinking budget required/forbidden depending on selected model mode.
  - Token value outside accepted bounds.
- Server response validation errors are shown without closing dialog.

---

## 4. Apps Script backend (Phase 4)

**Core logic**

- Add request-config property keys and defaults.
- Add helper functions to:
  - return defaults,
  - read and sanitize stored settings,
  - validate incoming config against selected model capabilities.
- Extend save function contract to persist config atomically with key/model updates.
- Update `callGemini` to build `generationConfig` from effective stored config instead of hardcoded values.
- Include only supported fields in payload for current model.

**Functions and contracts**


| Exposed to client? | Function name                   | Args                              | Return / errors                            |
| ------------------ | ------------------------------- | --------------------------------- | ------------------------------------------ |
| Yes                | `saveApiKeyAndModel` (extended) | `key`, `modelId`, `requestConfig` | `{ ok: true }` or `{ ok: false, message }` |
| No                 | `getDefaultRequestConfig`       | none                              | normalized defaults object                 |
| No                 | `getStoredRequestConfig`        | `modelId`                         | sanitized effective config                 |
| No                 | `validateRequestConfig`         | `requestConfig`, `modelId`        | `{ ok, value?, message? }`                 |
| No                 | `buildGenerationConfig`         | effective config + model          | request-ready `generationConfig`           |


**OAuth / manifest**

- New or changed scopes: **No**.
- No manifest permission changes expected.

---

## 5. Parameter research baseline (Gemini API)

For image transcription fine-tuning in this project, prioritize:

- `temperature` for determinism vs variability (default low).
- `maxOutputTokens` to control output length and truncation risk.
- `thinkingConfig` controls for quality/latency/cost tuning.

Research notes to apply:

- Gemini models differ in thinking support semantics; config must be model-aware.
- Avoid sending unsupported thinking fields to incompatible models.
- Keep v1 conservative and stable for users; defer broader sampling controls.

---

## 6. Validation rules

- `temperature`:
  - Required numeric input.
  - Keep in documented safe range used by API.
  - Default fallback `0.1` if absent.
- `maxOutputTokens`:
  - Integer only.
  - Must be positive and within supported model limits.
- `thinkingMode`:
  - Required enum value from allowed set for selected model.
  - Default is model-safe automatic mode.
- `thinkingBudget`:
  - Integer only when enabled for the selected model/mode.
  - Reject when provided for unsupported mode/model.
  - Respect model-specific min/max or special values when applicable.
- Save behavior:
  - No partial persistence on validation failure.
  - Return clear user-facing error strings.

---

## 7. Edge cases

- Existing users with no stored request config must continue working via defaults.
- Switching models can make previously valid thinking settings invalid.
- Blank API key in update mode should keep existing key unchanged.
- User enters locale-specific number format (comma decimal); must show clear error guidance.
- API rejects config despite validation (upstream rule change): surface backend error cleanly.

---

## 8. Acceptance criteria (Phase 5)

- Setup dialog includes request parameters and preserves existing key/model UX.
- Setup modal visual style is aligned with sidebar primary-action styling (blue primary button instead of grey default).
- User can save defaults or overrides; settings are stored in User Properties.
- Invalid config is blocked in UI and on server with actionable messages.
- `callGemini` uses effective stored settings; no hardcoded generation values remain for tuned fields.
- Model-aware thinking behavior prevents unsupported combinations.
- Single-image and sidebar transcription flows remain functional.
- Documentation updated (`README.md`, `docs/INSTALLATION.md`, `docs/USER_GUIDE.md`, `CHANGELOG.md`).
- No secrets are committed in source.

---

## 9. Manual / Google-side steps (if any)

- None expected for this feature in Google Cloud or Marketplace configuration.
- After implementation, validate in a real Google Doc using at least two model options and both setup modes (first-run and update).

