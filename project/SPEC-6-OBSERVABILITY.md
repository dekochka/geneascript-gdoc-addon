# Feature specification: GeneaScript Observability, Metrics, and Dashboards

**Status:** Draft  
**Target version:** Unreleased  
**Related:** `project/SPEC.md`, `project/SPEC-5-SIDEBAR-BATCH.md`, `project/SPEC-4-PUBLISH-MARKETPLACE.md`

---

## 1. Overview and user story

**What we are building and why**

GeneaScript currently emits useful execution logs, but telemetry is mostly unstructured text and does not yet provide complete operational visibility across usage, token consumption, performance, errors, and user behavior. This specification defines a unified observability model for core operations and a practical Google Cloud setup so maintainers can monitor adoption, control API costs, detect reliability issues early, and understand real user workflows.

**User stories**

- As a maintainer, I want dashboards showing daily/hourly usage and model/token consumption so I can track growth and costs.
- As a maintainer, I want latency and error charts so I can quickly identify regressions and failed flows.
- As a maintainer, I want import and batch behavior metrics so I can understand how users actually use the add-on.
- As a maintainer, I want consistent event fields in logs so log-based metrics and alerts remain stable over time.

## 2. Scope


| Change                          | File(s)                           | Notes                                                            |
| ------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| New observability spec          | `project/SPEC-6-OBSERVABILITY.md` | Defines schema, metrics, dashboards, rollout                     |
| Logging reconciliation baseline | `addon/Code.gs`                   | Source of current logs and operational events                    |
| Future implementation reference | `addon/Code.gs`                   | Spec defines logging changes; code changes are not in this phase |
| Dashboard setup instructions    | Google Cloud Logging/Monitoring   | Manual setup steps included                                      |


**Out of scope**

- Implementing code changes in this spec phase.
- Replacing Google Cloud with third-party observability tools.
- User-identifying analytics collection beyond operational needs.

## 3. Current-state telemetry reconciliation

### 3.1 Operations currently logged

From `addon/Code.gs`, operations already emit useful markers:

- `importFromDriveFolder`: start, folder resolution, file counts, per-image insert attempts, done summary.
- `transcribeImageByIndex`: start with `bodyIndex`, done with `finishReason`, `insertedCount`.
- `runTranscribeWorker`: start/done and call failures.
- `callGemini`: model, prompt length, image size, response code, token usage, finish reason.
- `insertTranscriptionAfter`: start, target index, inserted count.
- `saveApiKeyAndModel` / `saveModel` / `clearApiKey`: setup actions.
- `getImageList`: discovered image count.

### 3.2 Metrics already measurable from current text logs

- Images transcribed count (via `transcribeImageByIndex: done`).
- Prompt/candidate/total token counts (via `callGemini: finishReason=...` line).
- Model usage count (via `callGemini: start, model=...`).
- Image byte size for transcription/import (via `image size=...`, `blobSizeBytes=...`).
- Import totals (`added`, `skipped`, `count`) from import completion logs.
- HTTP/API failure rate (`callGemini: error ...`, non-200 response logs).

### 3.3 Gaps in current telemetry

- No explicit `runId` spanning all events in one user action/batch.
- No explicit operation durations (`latencyMs`) for transcribe/import/image-insert.
- Batch-level summary event does not exist server-side (success/fail/stop totals).
- Setup flows are logged but without standardized status/error classification.
- Unstructured message format requires brittle regex extraction.

## 4. Target observability design (Phase 4 implementation target)

### 4.1 Canonical event schema

Adopt structured JSON logs for all major events. Keep current human-readable logs during transition.

Required common fields:

- `event`: machine event name (for example `transcribe_image_done`)
- `operation`: `import_drive`, `transcribe_single`, `transcribe_batch`, `setup`
- `status`: `start`, `success`, `error`, `stop`, `partial`
- `runId`: stable ID for one user-triggered run
- `ts`: timestamp (ISO string, optional if platform populates)
- `docIdHash`: hashed doc identifier (no raw document IDs)
- `model`: Gemini model where relevant
- `errorCode`: normalized code/category on failures
- `errorMessage`: trimmed safe error text on failures

Optional operation-specific fields:

- Transcription: `imageBytes`, `promptLength`, `promptTokens`, `outputTokens`, `totalTokens`, `thoughtTokens`, `finishReason`, `latencyMs`, `insertedCount`.
- Batch: `selectedCount`, `succeededCount`, `failedCount`, `stopped`, `batchLatencyMs`, `avgImageLatencyMs`.
- Import: `folderIdHash`, `totalFiles`, `imageFiles`, `addedCount`, `skippedCount`, `truncated`, `maxImportImages`, `importLatencyMs`, `imageImportLatencyMs`, `blobSizeBytes`.
- Setup: `action` (`save_key_model`, `save_model`, `clear_key`), `modelSelected`, `result`.

### 4.2 Event taxonomy


| Event                          | Operation                                | Trigger                                 |
| ------------------------------ | ---------------------------------------- | --------------------------------------- |
| `import_drive_start`           | `import_drive`                           | Start import flow                       |
| `import_drive_image_processed` | `import_drive`                           | Each image import attempt result        |
| `import_drive_done`            | `import_drive`                           | Final import summary                    |
| `transcribe_image_start`       | `transcribe_single` / `transcribe_batch` | One image request starts                |
| `transcribe_image_api_done`    | `transcribe_single` / `transcribe_batch` | Gemini response parsed with token usage |
| `transcribe_image_done`        | `transcribe_single` / `transcribe_batch` | Text inserted                           |
| `transcribe_batch_done`        | `transcribe_batch`                       | Batch summary complete                  |
| `setup_action`                 | `setup`                                  | Setup operation attempt/outcome         |


## 5. Metric catalog

Use Cloud Logging log-based metrics with names prefixed by `geneascript/`.

### 5.1 Usage metrics

- `geneascript/transcribe_images_count` (counter)
  - Count `transcribe_image_done` where `status=success`.
- `geneascript/transcribe_runs_count` (counter)
  - Count unique runs (approximate via `transcribe_batch_done` + single done starts).
- `geneascript/import_runs_count` (counter)
  - Count `import_drive_done`.
- `geneascript/images_imported_count` (counter)
  - Sum `addedCount` from `import_drive_done`.
- `geneascript/model_usage_count` (counter by label `model`)
  - Count transcription events grouped by model.

### 5.2 Consumption metrics

- `geneascript/prompt_tokens` (distribution)
- `geneascript/output_tokens` (distribution)
- `geneascript/total_tokens` (distribution)
- `geneascript/tokens_per_run` (distribution; from batch/single summary events)

### 5.3 Performance metrics

- `geneascript/transcribe_latency_ms` (distribution)
  - Per image transcription end-to-end latency.
- `geneascript/import_image_latency_ms` (distribution)
  - Per image import latency.
- `geneascript/import_run_latency_ms` (distribution)
  - End-to-end import run duration.
- `geneascript/image_bytes` (distribution)
  - Image size to correlate with latency and errors.

### 5.4 Reliability metrics

- `geneascript/errors_count` (counter by `operation`, `errorCode`)
- `geneascript/api_http_non_200_count` (counter)
- `geneascript/finish_reason_count` (counter by `finishReason`)
- `geneascript/batch_stop_count` (counter)
- `geneascript/batch_fail_ratio` (derived in dashboard: failed/succeeded+failed)

### 5.5 Behavior metrics

- `geneascript/batch_selected_count` (distribution)
- `geneascript/batch_success_count` (distribution)
- `geneascript/batch_fail_count` (distribution)
- `geneascript/setup_actions_count` (counter by `action`, `result`)

## 6. Dashboard blueprint

Create one Monitoring dashboard: **GeneaScript Observability**.

### 6.1 Section A — Usage and adoption

- Line: images transcribed per hour/day.
- Line: imports per day.
- Stacked bar: model usage by day.
- Table: top models by total tokens and avg latency.

### 6.2 Section B — Consumption and cost proxy

- Line: total tokens/day.
- Histogram: tokens per image.
- Line: tokens per run (p50/p95).
- Scatter/table: image bytes vs total tokens (correlation view).

### 6.3 Section C — Performance

- Line: transcription latency p50/p95.
- Line: import image latency p50/p95.
- Histogram: image size distribution.
- Line: inserted text size proxy (if logged in future).

### 6.4 Section D — Reliability and behavior

- Stacked line: errors by operation.
- Bar: finish reason distribution (`STOP`, `MAX_TOKENS`, other).
- Line: API non-200 rate.
- Bar: batch stop/fail/success outcome counts.

## 7. Google Cloud setup instructions

### 7.1 Logs Explorer baseline filters

Use resource/function filters first to validate ingestion:

- `resource.type="app_script_function"`
- `labels."script.googleapis.com/function"="callGemini"`
- `labels."script.googleapis.com/function"="transcribeImageByIndex"`
- `labels."script.googleapis.com/function"="importFromDriveFolder"`

Start with `Last 24 hours` to avoid false zero results from narrow windows.

### 7.2 Create log-based metrics

For each metric:

1. Go to **Logging -> Log-based metrics -> Create metric**.
2. Choose **Counter** for event counts and **Distribution** for numeric extraction.
3. Define filter by event/function.
4. For distribution metrics, add extraction regex (or JSON field extraction after structured logging rollout).
5. Add labels (`model`, `operation`, `finishReason`, `errorCode`) where possible.
6. Save with `geneascript/...` naming convention.

Examples during transition (text logs):

- Tokens extraction source line:
  - `callGemini: finishReason=STOP, promptTokens=2243, candidatesTokens=2705, totalTokens=4948`
- Latency extraction source line:
  - add future log field `latencyMs=<number>` and extract from it.

### 7.3 Build dashboard

1. Open **Monitoring -> Dashboards -> Create**.
2. Add widgets section-by-section from this spec blueprint.
3. Configure alignment:
  - Rate/count metrics: 1h for hourly panels, 1d for daily panels.
  - Distribution metrics: show p50/p95 and mean where useful.
4. Add dashboard filters:
  - `operation`, `model`, `status`.
5. Save dashboard and pin as default team dashboard.

### 7.4 Recommended alerts

- High API error ratio: non-200 or `errors_count` above threshold for 10 minutes.
- Latency regression: p95 `transcribe_latency_ms` above threshold for 15 minutes.
- Truncation surge: `finishReason=MAX_TOKENS` above baseline.
- Import failures spike: `import_drive` error count above threshold.

## 8. Rollout strategy

### Phase A — Metric enablement from existing logs

- Build initial log-based metrics via current text patterns.
- Deliver baseline dashboard with known limitations (regex fragility).

### Phase B — Structured logging adoption

- Add JSON event logs with canonical schema while keeping existing text logs.
- Migrate metrics from regex extraction to JSON field extraction.

### Phase C — Stabilization and cleanup

- Finalize labels and metric names.
- Remove obsolete regex metrics after validation period.
- Tune alert thresholds using observed production behavior.

## 9. Edge cases and data governance

- Do not log API keys, prompt bodies, raw document content, or raw file/folder IDs.
- Hash IDs when correlation is needed (`docIdHash`, `folderIdHash`).
- Truncate error messages to avoid accidental sensitive leakage.
- Missing token fields from API response must emit `null`/absent values, not invalid numbers.
- Batch interrupted by user closure should emit a `status=stop` summary if available.

## 10. Acceptance criteria (Phase 5)

- New spec exists and defines canonical event schema and taxonomy.
- Reconciliation section maps current logging to measurable metrics and gaps.
- Metric catalog covers usage, consumption, performance, reliability, and behavior.
- Dashboard blueprint defines concrete widget groups and dimensions.
- GCP setup instructions are actionable for Logs Explorer, metric creation, and dashboard setup.
- Alert recommendations are included for key failure/performance risks.
- Privacy-safe logging constraints are explicitly documented.
- Rollout plan includes transition from current text logs to structured logs.

## 11. Manual / Google-side steps (if any)

- Configure log-based metrics in Google Cloud Logging UI.
- Configure dashboard widgets and alert policies in Google Cloud Monitoring UI.
- Validate metric values against sampled execution logs before relying on alerts.

## 12. Implementation mapping to `addon/Code.gs`

This section defines the exact instrumentation targets for the future implementation phase.

### 12.1 Function-to-event mapping

| Function (`addon/Code.gs`) | Event(s) to emit | Key fields |
|---|---|---|
| `transcribeImageByIndex(bodyIndex)` | `transcribe_image_start`, `transcribe_image_done`, `transcribe_image_error` | `runId`, `operation`, `bodyIndex`, `status`, `latencyMs`, `finishReason`, `insertedCount`, `errorCode` |
| `runTranscribeWorker()` | `transcribe_image_start`, `transcribe_image_done`, `transcribe_image_error` | same as above, with `entrypoint=menu_dialog` |
| `callGemini(apiKey,prompt,imageBlob,mimeType)` | `transcribe_image_api_start`, `transcribe_image_api_done`, `transcribe_image_api_error` | `model`, `promptLength`, `imageBytes`, `httpCode`, `promptTokens`, `outputTokens`, `totalTokens`, `thoughtTokens`, `finishReason`, `apiLatencyMs` |
| `insertTranscriptionAfter(...)` | `insert_transcription_done`, `insert_transcription_error` | `insertedCount`, `insertLatencyMs` |
| `importFromDriveFolder()` | `import_drive_start`, `import_drive_image_processed`, `import_drive_done`, `import_drive_error` | `runId`, `folderIdHash`, `totalFiles`, `imageFiles`, `addedCount`, `skippedCount`, `truncated`, `importLatencyMs`, `imageImportLatencyMs`, `blobSizeBytes` |
| `saveApiKeyAndModel(...)` | `setup_action` | `action=save_key_model`, `modelSelected`, `result` |
| `saveModel(modelId)` | `setup_action` | `action=save_model`, `modelSelected`, `result` |
| `clearApiKey()` | `setup_action` | `action=clear_key`, `result` |
| Sidebar batch flow (`getSidebarHtml` client JS) + server summary endpoint (future) | `transcribe_batch_done` | `selectedCount`, `succeededCount`, `failedCount`, `stopped`, `batchLatencyMs`, `tokensPerRun` |

### 12.2 Run correlation contract

- Generate `runId` at operation start:
  - single-image actions: one `runId` per image transcription.
  - import: one `runId` per import invocation.
  - batch: one `runId` per batch; each image event includes both `runId` and `imageOrdinal`.
- For batch, emit one summary event (`transcribe_batch_done`) after completion/stop.
- Include `operation` and `entrypoint` in all events:
  - `operation`: `transcribe_single`, `transcribe_batch`, `import_drive`, `setup`
  - `entrypoint`: `menu`, `sidebar`, `dialog`, or `system`

### 12.3 Error normalization contract

Use a bounded error taxonomy in `errorCode`:

- `AUTH_REQUIRED`
- `API_HTTP_ERROR`
- `API_RATE_LIMIT`
- `API_EMPTY_CANDIDATES`
- `API_MAX_TOKENS`
- `DOC_SELECTION_INVALID`
- `DOC_IMAGE_NOT_FOUND`
- `DRIVE_ACCESS_DENIED`
- `DRIVE_API_DISABLED`
- `UNKNOWN`

Store full details in `errorMessage` only after trimming/sanitizing.

## 13. Structured log payload examples

### 13.1 Transcribe image success

```json
{
  "event": "transcribe_image_done",
  "operation": "transcribe_single",
  "entrypoint": "sidebar",
  "status": "success",
  "runId": "run_20260329_072938_ab12",
  "model": "gemini-flash-latest",
  "imageBytes": 837624,
  "promptTokens": 2243,
  "outputTokens": 2705,
  "totalTokens": 4948,
  "thoughtTokens": null,
  "finishReason": "STOP",
  "latencyMs": 22000,
  "insertedCount": 126
}
```

### 13.2 Import summary success

```json
{
  "event": "import_drive_done",
  "operation": "import_drive",
  "status": "success",
  "runId": "run_20260329_071900_ef45",
  "folderIdHash": "sha256:3f1c...",
  "totalFiles": 52,
  "imageFiles": 31,
  "addedCount": 30,
  "skippedCount": 0,
  "truncated": true,
  "maxImportImages": 30,
  "importLatencyMs": 54800
}
```

### 13.3 Error event

```json
{
  "event": "transcribe_image_api_error",
  "operation": "transcribe_single",
  "status": "error",
  "runId": "run_20260329_073200_ff91",
  "model": "gemini-flash-latest",
  "httpCode": 429,
  "errorCode": "API_RATE_LIMIT",
  "errorMessage": "Quota exceeded",
  "apiLatencyMs": 1040
}
```

## 14. Metric extraction recipes (transition and target)

### 14.1 Transition (current text logs)

| Metric | Filter hint | Value extraction |
|---|---|---|
| `geneascript/transcribe_images_count` | contains `transcribeImageByIndex: done` | counter (no extraction) |
| `geneascript/prompt_tokens` | contains `callGemini: finishReason=` | regex `promptTokens=(\\d+)` |
| `geneascript/output_tokens` | contains `callGemini: finishReason=` | regex `candidatesTokens=(\\d+)` |
| `geneascript/total_tokens` | contains `callGemini: finishReason=` | regex `totalTokens=(\\d+)` |
| `geneascript/model_usage_count` | contains `callGemini: start, model=` | label regex `model=([^,]+)` |
| `geneascript/image_bytes` | contains `callGemini: start` | regex `image size=(\\d+)` |
| `geneascript/images_imported_count` | contains `importFromDriveFolder: done` | regex `added=(\\d+)` |

### 14.2 Target (structured JSON logs)

After structured logging rollout, switch extraction to JSON payload fields:

- `jsonPayload.totalTokens`, `jsonPayload.promptTokens`, `jsonPayload.outputTokens`
- `jsonPayload.model`, `jsonPayload.finishReason`, `jsonPayload.operation`
- `jsonPayload.latencyMs`, `jsonPayload.importLatencyMs`, `jsonPayload.imageImportLatencyMs`
- `jsonPayload.addedCount`, `jsonPayload.selectedCount`, `jsonPayload.failedCount`

This removes regex fragility and simplifies dashboard maintenance.

