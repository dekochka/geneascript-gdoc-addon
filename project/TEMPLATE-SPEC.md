# Feature specification: [Feature name]

**Status:** Draft | Approved | Implemented  
**Target version:** [e.g. v0.4.0 or Unreleased]  
**Related:** [Link or cite sections in `SPEC.md` if shared prompt/output rules apply]

---

## 1. Overview and user story

**What we are building and why**

[Short paragraph.]

**User story**

- As a [role], I want [action] so that [outcome].

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|--------|
| [e.g. Menu + handler] | `addon/Code.gs` | |
| [e.g. Manifest / scopes] | `addon/appsscript.json` | |
| [e.g. User guide] | `docs/USER_GUIDE.md` | |

**Out of scope**

- [What this spec explicitly does not do]

## 3. UI and frontend (Phase 3 when non-trivial)

**Entry point**

[e.g. Extensions → Metric Book Transcriber → …]

**Components / behavior**

- [Menus, modals, dialogs, sidebar — match repo pattern: inline `HtmlService` vs separate HTML]

**Error states**

- [Invalid input, permission denied, API failure — what the user sees]

**Mock data (optional — for complex UI before backend)**

```json
{
  "ok": true,
  "message": "Example shape returned by a server function"
}
```

## 4. Apps Script backend (Phase 4)

**Core logic**

[Algorithms, DocumentApp/Drive/UrlFetchApp usage, timeouts, limits.]

**Functions and contracts**

| Exposed to client? | Function name | Args | Return / errors |
|--------------------|---------------|------|------------------|
| Yes | `exampleFn` | `string` | `{ ok: boolean, message?: string }` |

**OAuth / manifest**

- New or changed scopes: **Yes / No** — [list exact scope URLs if yes]

## 5. Edge cases

- [e.g. Empty document, no image selected, folder not shared, rate limit]

## 6. Acceptance criteria (Phase 5)

Use as a verification checklist before asking the user to deploy/test.

- [ ] Behavior matches sections 1–4 above.
- [ ] Menu paths and labels match this spec.
- [ ] `google.script.run` wiring uses success/failure handlers where applicable.
- [ ] Errors are caught and surfaced without silent failure.
- [ ] `appsscript.json` updated if scopes or add-on config changed.
- [ ] No secrets or API keys committed in source.
- [ ] `docs/` updated if user-visible or install/privacy/listing text changes.
- [ ] If Marketplace/OAuth impact: privacy/terms/store copy and manual GCP steps noted (see `SPEC-4-PUBLISH-MARKETPLACE.md`).

## 7. Manual / Google-side steps (if any)

[OAuth verification, Marketplace SDK, deployments, assets — cannot be automated in-repo.]
