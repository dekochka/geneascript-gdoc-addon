# Weekly Error Analysis — 2026-04-18 → 2026-04-25

**Date compiled:** 2026-04-25
**Source:** GCP Cloud Logging export (`downloaded-logs-20260425-075802.json`, 11.5 MB, 7,969 entries, 7-day window)
**Current version in production:** v1.4.2 (deployed 2026-04-22 ~10:46 UTC)

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Unique users | 14 |
| Unique documents | 23 |
| Transcriptions started | 182 |
| Transcriptions completed successfully | 122 (67%) |
| Transcriptions failed | 60 (33%) |
| Images imported from Drive | 193 (98% import success) |
| OBS telemetry events | 1,108 |
| Non-OBS platform errors | 51 |

**Top takeaways:**
- 503 retry logic (v1.4.2) works: 11/26 retries (42%) succeeded on retry.
- Dashboard **error count is ~2× inflated** due to double-logging (one failure → both `transcribe_image_api_error` + `transcribe_image_error`).
- **Silent platform bug:** `openSidebarFromCard` returns a malformed `ActionResponse` → 23 platform errors/week that never surface in OBS telemetry.
- Several classification gaps mean real `API_OVERLOADED` / `API_HTTP_ERROR` events still arrive as `UNKNOWN` / `API_HTTP_ERROR` instead of the specific code, so sidebar banners don't fire for all the cases they should.
- 429 rate-limit errors (24 total, 4 users) have no retry and no actionable UX hint.

---

## 2. Transcription Error Breakdown (117 OBS error events → 60 unique failed runs)

| ErrorCode | OBS events | Unique users | Root cause |
|---|---|---|---|
| `API_OVERLOADED` | 28 | 5 | Free-tier Gemini 503s (retry-once fixed ~half) |
| `API_HTTP_ERROR` | 32 | 6 | Classification gap: 503/403/400 fell through taxonomy |
| `UNKNOWN` | 28 | 5 | Same as above but without `httpCode` propagated |
| `API_RATE_LIMIT` | 24 | 4 | HTTP 429, quota exceeded (no retry, no UX hint) |
| `DOC_SELECTION_INVALID` | 3 | 3 | User clicked transcribe without image selected |
| `API_PROJECT_DENIED` | 2 | 1 | GCP project blocked from Gemini API |

### Pre/post v1.4.2 classification drift

| ErrorCode | Pre-v1.4.2 | Post-v1.4.2 |
|---|---|---|
| `API_OVERLOADED` | 2 | 26 ✓ (classifier now catches it) |
| `API_HTTP_ERROR` | 24 | 8 (still leaking 503 + new 400 "invalid key") |
| `UNKNOWN` | 24 | 4 (still leaking 503 where `httpCode` is dropped on rethrow) |
| `API_RATE_LIMIT` | 10 | 14 |
| `API_PROJECT_DENIED` | 0 | 2 ✓ (v1.4.2 classifier added this code) |

---

## 3. Non-OBS Platform Errors (51)

| Category | Count | First → Last | Severity |
|---|---|---|---|
| `openSidebarFromCard` bad return type | 23 | 2026-04-17 → 2026-04-22 | High — silent, pollutes dashboards |
| "Exceeded maximum execution time" | 4 | 2026-04-18 → 2026-04-21 | Medium — silent user-facing failure |
| OAuth/auth permission exceptions | 3 | Various | Medium — stale consent |
| Other platform errors (empty msg) | 21 | Various | Unknown |

### 3.1 `openSidebarFromCard` broken return value (23 errors)

**Error message:**
> "The value returned from Apps Script has a type that cannot be used by the add-ons platform. Also make sure to call build on any builder before returning it. Value: Object with values: `{ renderActions: { action: {} } }`"

**Root cause** — `addon/Code.gs:2160-2163`:
```javascript
function openSidebarFromCard() {
  showTranscribeSidebar();
  return CardService.newActionResponseBuilder().build();  // empty action
}
```

`CardService.newActionResponseBuilder().build()` produces an empty action object which the Add-ons platform rejects. The correct contract is to return no value (for pure side-effect actions like opening a sidebar), or build a proper `Notification` / `Navigation` action.

**Impact:** Users still get the sidebar (the side-effect `showTranscribeSidebar()` runs before `return`), but each card-button click logs a platform ERROR. Invisible to users, visible on dashboards.

### 3.2 Exceeded maximum execution time (4 errors)

Four runs exceeded the 60s Apps Script limit, all pre-v1.4.2. Concerning because v1.4.2 adds a 5s retry sleep on 503 — under sustained overload this pushes total latency toward the budget ceiling (measured retry+second-call combined in one sample was 23.9s; a 30s+ second call after the sleep would time out).

### 3.3 OAuth permission exceptions (3 errors)

Three genuine auth exceptions in `showTranscribeSidebar`, `Ui.showModalDialog`, `DocumentApp.getActiveDocument` — classic stale OAuth consent. Notably, v1.4.2's new detector event `picker_config_scope_error` has **0 occurrences** in logs, because the auth failures all hit non-picker entry points (`showTranscribeSidebar`, etc.) — our detector was placed at the wrong layer.

---

## 4. Double-Logging in OBS Error Pipeline

55 out of 60 failed runs emit **both** `transcribe_image_api_error` (inside `callGemini` catch) AND `transcribe_image_error` (outer `transcribeImageByIndex` catch). They share the same `runId`. The GCP log-based metric `geneascript_errors_count` counts both events → **dashboard error counts are ~2× reality**.

Example:
```
runId=tx_1776854322418_f397ea
  transcribe_image_api_retry  (after first 503)
  transcribe_image_api_error  (API_OVERLOADED, after second 503)
  transcribe_image_error      (API_OVERLOADED, same payload)
```

---

## 5. Retry Effectiveness (v1.4.2 validation)

| Metric | Count |
|---|---|
| 503s that triggered retry | 26 |
| Succeeded after retry | 11 (42%) |
| Failed after retry → shown sidebar banner | 13 (50%) |
| Remaining 2 | Runs still in flight / incomplete logs |

**Verdict:** The retry is pulling its weight. Roughly half of otherwise-user-visible 503 failures now silently succeed on retry.

---

## 6. Per-User Failure Rates

| User (hashed) | Successes | Failures | Fail % | Notes |
|---|---|---|---|---|
| `sha256:6d42413538d52` | 0 | 10 | **100%** | `API_PROJECT_DENIED` — completely blocked |
| `sha256:4a51096bfe8dc` | 0 | 1 | 100% | One-off, likely setup error |
| `sha256:68f0b365582cb` | 3 | 6 | 67% | Mixed overload + rate limit |
| `sha256:a1ba72abbd69a` | 12 | 16 | 57% | Heavy user hitting rate limits + 503s |
| `sha256:404de7f60cc65` | 1 | 1 | 50% | |
| `sha256:4927dcf25d69b` | 22 | 12 | 35% | Heavy user, mostly rate limits |
| `sha256:ebd3218796ff9` | 13 | 6 | 32% | |
| `sha256:50d29bffeb66c` | 29 | 5 | 15% | Mostly healthy |
| `sha256:97deab8777106` | 15 | 2 | 12% | Mostly healthy |
| `sha256:f31113cb3e543` | 14 | 1 | 7% | Mostly healthy |
| `sha256:73c9169432c8` | 13 | 0 | 0% | Perfect — baseline shows the tool works |

---

## 7. Import Pipeline Health

- 193 images imported, 3 failures → **98% success**.
- Failures: 2× "Invalid image data" (source file corrupted), 1× Drive quota exceeded.
- No systemic issues on the import path.

---

## 8. Proposed Fixes for v1.4.3

| # | Fix | Root cause | Expected impact |
|---|---|---|---|
| **A** | Fix `openSidebarFromCard` return value — return `undefined` (or a proper `Notification`) so the Add-ons platform accepts it. | Empty `ActionResponse` object rejected by platform. | Eliminates 23 silent platform errors/week. |
| **B** | Add `API_KEY_INVALID` to taxonomy + sidebar banner pointing user to the Setup dialog. | 400 "API key not valid" was falling through to `API_HTTP_ERROR` with generic red ✗. | 4 errors, clearer UX. |
| **C** | Add `API_RATE_LIMIT` (429) sidebar banner + ⚠ icon, same style as `API_OVERLOADED`. Copy suggests waiting or switching tier. | 429 shows generic red ✗ with raw quota URL — no actionable hint. | 24 errors, 4 users. |
| **D** | Fix double-logging. Preferred: **remove** `transcribe_image_api_error` event (keep `transcribe_image_api_retry`) since outer `transcribe_image_error` already carries full context. Alternative: update metric filter. | Duplicate emission per failure. | Dashboard error count halves to reflect reality. |
| **E** | Surface context-extract errors in the extract-context dialog (not just sidebar) with the same overload hint. | `context_extract_error` currently shows raw error text in dialog. | 1 error, low priority. |
| **F** | Post-release watchdog: monitor "Exceeded maximum execution time" count for a week. If v1.4.2's 5s retry sleep increases timeouts, shorten to 3s. | Retry budget risk. | Prevents new failure mode. |

**Dropped from original list:**
- ~~Retry 429 with longer backoff~~ — confirmed: would push runs over the 60s execution budget. 429 recovery is minutes/hours, not seconds.

---

## 9. Open Questions (to confirm before implementation)

1. **Fix A return value:** Do you want `openSidebarFromCard` to also flash a confirmation toast (`CardService.newNotification()`), or silently open the sidebar (`return undefined`)?
2. **Fix D scope:** Remove `transcribe_image_api_error` event emission entirely (loses intra-call detail), or keep it and just update the metric filter to count only `transcribe_image_error`?
3. **Stale OAuth detection (issue 3.3):** Should we add a general-purpose auth-failure detector in the top-level `onOpen` / `showTranscribeSidebar` catch, given that our picker-specific detector never fires?
