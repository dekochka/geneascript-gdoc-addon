# Feature specification: Interface localization (i18n)

**Status:** Approved (implementation in progress)  
**Target version:** v1.1.0  
**Related:** [SPEC.md](SPEC.md) (prompt/output language is separate from UI); [SPEC-3-APIKEY-SETUP.md](SPEC-3-APIKEY-SETUP.md); [SPEC-5-SIDEBAR-BATCH.md](SPEC-5-SIDEBAR-BATCH.md); [SPEC-10-PROMPT-TEMPLATE-GALLERY.md](SPEC-10-PROMPT-TEMPLATE-GALLERY.md)

---

## 1. Overview and user story

**What we are building and why**

End users are often Ukrainian-speaking genealogists. The add-on UI (menus, dialogs, sidebar, alerts) is localized into **English**, **Ukrainian**, and **Russian**, with English as fallback when the account language is unsupported.

**User story**

- As a user, I want the add-on menus and dialogs in my preferred language so I can work comfortably.
- As a user, I want to override Google account language with an explicit UI language in Settings.

---

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|-------|
| Locale resolution + string tables | `addon/I18n.gs` | `getEffectiveLocale()`, `t()`, User Property `UI_LOCALE` |
| Menus, alerts, modals, sidebar | `addon/Code.gs` | Uses `t()`; client strings injected as JSON |
| Template gallery UI + display metadata | `addon/TemplateGallery.gs` | Dialog chrome + localized template **labels/descriptions** for cards |
| User guide / install notes | `docs/en/USER_GUIDE.md`, `docs/en/INSTALLATION.md` (+ `docs/uk/`, `docs/ru/` for site) | Short “Interface language” section |
| Privacy | `docs/en/PRIVACY_POLICY.md` (+ uk/ru) | Optional UI language preference stored in User Properties |

**Out of scope**

- **Gemini prompt bodies** ([Prompt.gs](../addon/Prompt.gs), [ContextExtractionPrompt.gs](../addon/ContextExtractionPrompt.gs), template instruction text used for the model): remain as today (model-facing).
- **Observability** log payloads: English / machine-oriented.
- **Marketplace listing** full localization: manual in GCP; not automated in-repo.
- **`https://www.googleapis.com/auth/script.locale`**: not required for v1; homepage card uses `Session.getActiveUserLocale()` via `getEffectiveLocale()` (may differ slightly from host card locale—acceptable for v1).

**Product decision (locked)**

- **Template gallery cards**: show **localized** display names and descriptions; prompt preview tabs remain English content from templates (model text).

---

## 3. UX

**Locale resolution**

1. If User Property `UI_LOCALE` is `en`, `uk`, or `ru` → use it.
2. Else (**Auto**): `Session.getActiveUserLocale()` normalized to `en` / `uk` / `ru`; unknown → `en`.

**Settings**

- **Setup AI** dialog includes **Interface language**: Auto (follow Google account) / English / Українська / Русский.
- Saving persists `UI_LOCALE` (`auto` clears fixed locale). Next **document open** refreshes the menu (`onOpen`).

**Cyrillic**

- Wider strings may affect modals/sidebar; CSS uses flexible widths where possible.

---

## 4. Apps Script backend

**Core**

- `t(key, replacements)` with simple `{name}` interpolation.
- `getSidebarClientStrings()`, `getPickerClientStrings()`, `getSetupDialogClientStrings()`, etc., for HtmlService `<script>` injection (JSON, `\u003c` for safety).

**Functions**

| Exposed to client? | Function | Notes |
|--------------------|----------|-------|
| Yes | `saveApiKeyAndModel(key, modelId, requestConfig, uiLocale)` | `uiLocale` optional: `auto` \| `en` \| `uk` \| `ru` |
| Yes | `getTemplateListForClient()` | Returns localized display fields |

**OAuth / manifest**

- New scopes: **No** (v1).

---

## 5. Edge cases

- Empty or invalid `UI_LOCALE` → Auto.
- Server messages that include dynamic fragments (indices, API errors) use `t()` with placeholders or append sanitized technical detail in parentheses where needed.
- Picker config error messages from script properties: localized for user-facing `message` where returned to client.

---

## 6. Acceptance criteria

- [ ] Menu and sidebar render in EN / UK / RU when account language matches or when override is set.
- [ ] Auto + unsupported account locale (e.g. `de`) → English UI.
- [ ] Setup AI saves language; reopening doc updates menu labels.
- [ ] Major flows localized: import, transcribe (menu + sidebar batch), context extract, template gallery, setup, help/issue dialogs.
- [ ] No secrets in source; manifest unchanged for scopes.
- [ ] Docs and privacy updated as in §2.

---

## 7. Testing (manual)

| Case | Expect |
|------|--------|
| Account EN, Auto | English UI |
| Account UK, Auto | Ukrainian UI |
| Account RU, Auto | Russian UI |
| Account EN, override UK | Ukrainian UI |
| Account DE, Auto | English UI |
| Import, batch transcribe, confirm modal, context extract, template gallery, setup | No raw English leaks in primary chrome |
| Help / Report links | Still open correct URLs |

**Pre-check:** `clasp push`, test in Google Doc.

**Editor add-on note:** Google may run `onOpen` in `AuthMode.NONE` until the add-on is *enabled* in the document; in that mode **User Properties (including `UI_LOCALE`) are unavailable**, so menu labels follow `Session.getActiveUserLocale()` only. After any menu action or opening the sidebar, the script runs in full auth and **`refreshAddonMenuForCurrentLocale()`** rebuilds the menu so `UI_LOCALE` matches the sidebar. See [Editor add-on authorization](https://developers.google.com/workspace/add-ons/concepts/addon-authorization).

---

## 8. CardService (homepage)

- v1: **`buildHomepageCard()`** uses `t()` with `getEffectiveLocale()` (no `script.locale` scope).
