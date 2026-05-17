# Feature specification: Usage Stats sidebar section

**Status:** Implemented  
**Target version:** v1.6.1  
**Related:** SPEC-5 (Sidebar Batch), SPEC-6 (Observability), SPEC-7 (API Config)  
**GitHub Issue:** [#48](https://github.com/dekochka/geneascript-gdoc-addon/issues/48)

---

## 1. Overview and user story

Users who transcribe images with GeneaScript have no visibility into how many tokens each batch consumes or what it costs. The sidebar already shows progress and timing but nothing about Gemini API token usage. This feature adds a collapsible "Usage Stats" section to the sidebar so users can monitor spending and understand how template choice and image size affect cost.

**User story**

- As a transcriber, I want to see token usage and estimated cost in the sidebar so that I can monitor my API spending and make informed decisions about model and template selection.

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|--------|
| Return token data to client | `addon/Code.gs` — `transcribeImageByIndex()` | Add 7 token fields to success return |
| Return modelId on boot | `addon/Code.gs` — `getSidebarBootstrap()` | New `modelId` field |
| Extract prompt token breakdown | `addon/Code.gs` — `callGemini()` | Parse `promptTokensDetails.textTokenCount` and `imageTokenCount` |
| Stats section HTML | `addon/Code.gs` — `getSidebarHtml()` | Collapsible section between Progress and Help links |
| Client JS accumulators | `addon/Code.gs` — sidebar `<script>` | Session, last run, and per-run buffer objects |
| Collapsible Images section | `addon/Code.gs` — `getSidebarHtml()` | Same toggle pattern, expanded by default |
| I18n strings (EN/UK/RU) | `addon/I18n.gs` | 16 new `sidebar.stats_*` keys per locale |
| Client I18n mapping | `addon/I18n.gs` — `getSidebarClientI18n()` | 14 new entries |
| Version bump | `addon/Code.gs` | `ADDON_VERSION` → `v1.6.1` |

**Out of scope**

- Persistent stats across sidebar reloads (would require Document/User Properties)
- Per-image breakdown table (only aggregates shown)
- Thinking token cost estimation (Gemini doesn't charge for thinking tokens separately)

## 3. UI and frontend

**Entry point**

The stats section is always visible in the sidebar (collapsed by default). No menu item needed.

**Layout (top to bottom within expanded stats body)**

```
📊 Usage Stats                              ▶ (toggle)
┌─────────────────────────────────────────────┐
│ gemini-flash-latest                         │  ← model name (10px, muted)
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ SESSION TOTAL                               │  ← sub-header (10px bold)
│ Images transcribed                     5    │
│ Input tokens                       12,847   │
│   ↳ prompt (text)                   4,231   │  ← only if API provides breakdown
│   ↳ image                           8,616   │  ← only if API provides breakdown
│ Output tokens                       4,231   │
│ Thinking tokens                     1,506   │  ← only if > 0
│─────────────────────────────────────────────│
│ Total tokens                       18,584   │  ← bold
│ Est. cost                        $0.019241  │  ← bold, green (#2e7d32)
│ Avg / image            ~3,717 / $0.003848   │  ← 10px, muted; only if images > 0
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ LAST RUN                                    │  ← only after first batch completes
│ (same rows as session total)                │
│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
│ Rates ↗    My Spend ↗               Reset   │  ← 10px footer links
└─────────────────────────────────────────────┘
```

**Collapsible sections**

Both "Images" and "Usage Stats" sections use the same toggle pattern:
- Click header row → toggle body visibility
- ▶ (collapsed) / ▼ (expanded) indicator with CSS rotation transition
- Images: expanded by default. Stats: collapsed by default.

**External links**

| Label | URL | Purpose |
|-------|-----|---------|
| Rates | `https://ai.google.dev/pricing` | Gemini model pricing table |
| My Spend | `https://aistudio.google.com/spend` | User's AI Studio spend dashboard |

**Error states**

- API error (bad key, overload): stats don't break; tokens stay at 0 for failed images
- Model with no pricing info: cost shows `$0.000000`
- API doesn't return `promptTokensDetails`: text/image sub-rows stay hidden

**UI mock**

`project/designs/v1.6.1-usage-stats-sidebar-mock.html`

## 4. Apps Script backend

**Data source: Gemini API response**

Each call to `callGemini()` extracts from `response.usageMetadata`:

| Field | API path | Description |
|-------|----------|-------------|
| `promptTokens` | `usageMetadata.promptTokenCount` | Total input tokens (prompt text + image) |
| `promptTextTokens` | `usageMetadata.promptTokensDetails.textTokenCount` | Text-only portion of input (template/prompt) |
| `promptImageTokens` | `usageMetadata.promptTokensDetails.imageTokenCount` | Image-only portion of input (scan data) |
| `outputTokens` | `usageMetadata.candidatesTokenCount` | Generated transcription tokens |
| `thoughtTokens` | `usageMetadata.thoughtsTokenCount` | Internal reasoning (thinking-enabled models only) |
| `totalTokens` | `usageMetadata.totalTokenCount` | Sum: prompt + output + thinking |
| `estimatedCostUsd` | Calculated client-side | See cost formula below |

`promptTokensDetails` is available on modern Gemini models. If absent, `promptTextTokens` and `promptImageTokens` are `null`/`0` and the sub-rows stay hidden.

**Cost estimation formula**

Calculated by `estimateGeminiCostUsd()` in `Observability.gs`:

```
cost = (promptTokens / 1,000,000) × inputRate + (outputTokens / 1,000,000) × outputRate
```

Hardcoded pricing table (`pricingVersion: 'gemini-dev-api-2026-04-21'`):

| Model | Input ($/1M tokens) | Output ($/1M tokens) |
|-------|--------------------:|---------------------:|
| `gemini-flash-latest` | $0.50 | $3.00 |
| `gemini-3.1-pro-preview` | $2.00 | $12.00 |
| `gemini-3.1-flash-lite-preview` | $0.25 | $1.50 |

- Thinking tokens are **not** billed and excluded from cost calculation
- Unknown models return `null` cost (displayed as `$0.000000`)
- Pricing assumes paid-tier Standard rates; free-tier users see the same estimate

**Functions and contracts**

| Exposed to client? | Function | Change |
|--------------------|----------|--------|
| Yes | `transcribeImageByIndex()` | Return adds: `promptTokens`, `promptTextTokens`, `promptImageTokens`, `outputTokens`, `totalTokens`, `thoughtTokens`, `estimatedCostUsd` |
| Yes | `getSidebarBootstrap()` | Return adds: `modelId` (from `getStoredModel()`) |
| No | `callGemini()` | Now extracts `promptTokensDetails` from API response |

**OAuth / manifest**

- New or changed scopes: **No**

## 5. Client-side accumulation logic

Three JavaScript objects track token usage in the sidebar session:

| Object | Purpose | Resets when |
|--------|---------|-------------|
| `session` | Cumulative total across all batches | User clicks "Reset" |
| `runBuf` | Current in-progress batch accumulator | `startBatch()` is called |
| `lastRun` | Snapshot of the most recent completed batch | `finish()` copies `runBuf` → `lastRun` |

**Fields in each object:**
`{ input, inputText, inputImage, output, thinking, total, cost, images }`

**Accumulation flow:**

1. `startBatch()` → resets `runBuf` to zeros
2. Per-image success in `next()` → adds API response values to both `session` and `runBuf`, increments `images`, calls `updateStatsUi()`
3. `finish()` → copies `runBuf` into `lastRun`, calls `updateStatsUi()`
4. `resetStats()` → zeros all three objects, hides last-run section

**Avg / image calculation:**

```
avgTokens = Math.round(total / images)
avgCost   = (cost / images).toFixed(6)
```

Only displayed when `images > 0`.

## 6. Edge cases

- Failed images: no tokens accumulated (only successful transcriptions count)
- `DOC_FULL` abort: partial batch stats are preserved in both `runBuf`/`session`
- Model change mid-session: `session.model` reflects boot-time model; stats from mixed models are summed together (acceptable since this is an in-session estimate)
- Sidebar reload: all stats reset to zero (no persistence)

## 7. Acceptance criteria

- [x] Stats section visible in sidebar on load (collapsed)
- [x] Expand/collapse toggle works for both Images and Stats sections
- [x] Model name displayed from `getSidebarBootstrap().modelId`
- [x] Session totals accumulate across multiple batch runs
- [x] Last run section appears after first batch completes
- [x] Counters reset when user clicks "Reset"
- [x] Input token breakdown (text/image) shown when API provides `promptTokensDetails`
- [x] Input token breakdown hidden when API doesn't provide details
- [x] Thinking tokens row hidden when value is 0
- [x] Avg/image shown when images > 0
- [x] Cost displayed in green with 6 decimal places
- [x] Rates and My Spend links open correct external URLs
- [x] I18n: all labels translated in EN, UK, RU
- [x] No new OAuth scopes required
- [x] `ADDON_VERSION` updated to `v1.6.1`

## 8. Manual / Google-side steps

None — no scope changes, no Marketplace updates required for this feature.
