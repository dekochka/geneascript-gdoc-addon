# Feature specification: Decouple transcription from `DocumentApp.appendImage` — hybrid inline + link-only import

**Status:** Backlog (Draft)
**Target version:** v1.5.x (post-v1.5.0 SPEC-14 Russian Orthodox)
**Created:** 2026-05-10
**Triggered by:** [GitHub issue #22](https://github.com/dekochka/geneascript-gdoc-addon/issues/22), confirmed via OBS data 2026-05-07 → 2026-05-09 (342 of 1500 imports for one user, 100% failure rate above ~2 MB; user proved valid Google Docs content via drag-drop while `appendImage` rejected with "Invalid image data")
**Related:** [GitHub issue #20](https://github.com/dekochka/geneascript-gdoc-addon/issues/20) (doc-overflow at ~670 pages — link-only mode quietly addresses this), `project/SPEC-9-OAUTH-SCOPE-MIGRATION.md` (manifest discipline), `project/SPEC-4-PUBLISH-MARKETPLACE.md` (re-verification implications)

---

## 1. Problem reframe

The current import flow embeds the image as an **InlineImage in the doc**, then transcription reads bytes back out of that inline element. This couples three independent concerns into one fragile chain:

```
Drive file → DocumentApp.appendImage()  → InlineImage  → getBlob() → base64 → Gemini
                ▲ strict format validator     ▲ visual preview     ▲ transcription input
                ▲ rejects ~2 MB+ JPEGs        (user wants this)    (this is what we
                ▲ rejects format edge cases                          actually need)
```

`DocumentApp.appendImage(blob)` enforces a stricter image-format validator than the Google Docs editor itself. Files that drag-drop into Docs successfully — and transcribe via Gemini API successfully (the user proved both) — are rejected by `appendImage()` with `"Invalid image data."` Empirically (one user, 1500 imports, OBS data):

| Size bucket | Total | Failure rate |
|---|---|---|
| 0–1 MB | 591 | 12% |
| 1–2 MB | 789 | 19% |
| **2+ MB** | **120** | **100%** |

The earlier draft of this spec proposed re-fetching files through `lh3.googleusercontent.com` to launder the format past `appendImage`'s validator. **That solves the wrong problem.** The right insight: we don't need `appendImage` to succeed for transcription to work. The Drive file is the source of truth, and its URL is already saved into the doc as `Source Image Link: <url>` next to every imported image (`addon/Code.gs:215` `appendImageNameAndSourceLink`). We can transcribe from the link directly.

## 2. Goal

Decouple **transcription** from **inline preview**. Try `appendImage` first (fast, gives the visual preview the user uses for proofreading). On failure, fall back to writing **only the H2 heading + Source Image Link + page break** — no embedded image. The user sees a link-only row in the sidebar; clicking Transcribe fetches bytes server-side via Drive and transcribes normally. The "Invalid image data" failure mode disappears for the user.

Add a **secondary "link-only mode" checkbox** in the import dialog so power users can opt out of embedded images entirely — making imports faster, documents dramatically smaller, and quietly addressing issue #20 (doc-overflow at ~670 pages) as a side effect for users who choose that mode.

**Also: split the per-batch import cap into two values keyed off the chosen path.** Inline mode is bottlenecked by `appendImage` latency (~1.5–2 s/image at p50/p95 in production); link-only inserts are ~10–15× faster and only bottlenecked by `appendParagraph` plus a Drive metadata fetch. The unified `MAX_IMPORT_IMAGES = 50` cap (raised from 30 in v1.4.6) is appropriate for the inline path; for link-only, the safe ceiling under the Apps Script 360 s runtime is closer to 500 images per batch.

## 3. Approach: hybrid inline + link-only

### Default behaviour (auto-fallback)

For each Drive file in the import:

1. Write H2 heading (`appendImageNameAndSourceLink` already does this).
2. Write `Source Image Link: <url>` paragraph (existing).
3. **Try** `body.appendImage(blob)`.
4. **If `appendImage` succeeds:** insert page break, count as added (current behaviour, unchanged).
5. **If `appendImage` throws:** skip step 4's `appendImage`, still insert page break, count as added with `kind: 'link_only'`. Surface as a non-fatal indicator in the import-result panel (`✓ added: 8 (1 link-only)`), not as a skip.

Distinguish from real errors: if the blob can't even be read (Drive permission lost mid-import), still skip and show in the skipped-files panel as today.

### Opt-in link-only mode (checkbox in picker dialog)

A persistent checkbox in the picker dialog (Document Property `IMPORT_LINK_ONLY_MODE`) — when checked, **skip `appendImage` entirely** for all files in the batch. Use cases:
- User has 100+ files and wants a fast import without embedded images.
- User intends to assemble a database/CSV downstream (issue #21) and never needs the visual.
- User's archive consistently produces files that fail `appendImage` (saves the catch-fall-through round trip).

Default: **unchecked** (current behaviour preserved).

### Transcription path adapts transparently

`transcribeImageByIndex` (Code.gs:2443) currently does:
```
hit = findInlineImageAtBodyIndex(doc, bodyIndex)
blob = hit.inlineImage.getBlob()
```

After change:
```
hit = findEntryAtBodyIndex(doc, bodyIndex)   // returns {kind, container, inlineImage?, sourceUrl?}
blob = (hit.kind === 'inline')
  ? hit.inlineImage.getBlob()
  : DriveApp.getFileById(extractFileIdFromUrl(hit.sourceUrl)).getBlob()
```

The `DriveApp.getFileById(id).getBlob()` path returns raw Drive bytes without going through `appendImage`'s validator — exactly the path that already works for transcription today. **No `UrlFetchApp` call needed; no manifest change.**

`insertTranscriptionAfter` already operates on a body index, not the inline image element, so it works for both kinds without modification.

## 4. UX surfaces

### Sidebar image list
- Inline-mode entry: thumbnail-style icon next to the H2 label (current behaviour).
- Link-only entry: hyperlink-style icon (e.g., `🔗`) instead of thumbnail. Same row layout, same Transcribe button, same selection checkbox.
- Tooltip on the link-only icon: "No embedded preview — transcribed from Source Image Link."

### Picker dialog
- New checkbox below the Drive file selector: **"Import as link-only (no embedded images)"**.
- Default unchecked. Persists across sessions per-document via `IMPORT_LINK_ONLY_MODE` Document Property.
- Helper text: *"Faster import. Smaller document. Useful for large batches. You can still transcribe and review by clicking the source link."*

### Import-result panel
- Renamed counters: `✓ added: N inline, M link-only` (when both kinds present).
- Skipped-files panel unchanged — only used for files that genuinely couldn't be read.

### Per-batch cap split

Replace the single `MAX_IMPORT_IMAGES` constant with two:

- `MAX_IMPORT_IMAGES_INLINE = 50` — applies when the user is in the default (inline-preferred) mode. Matches the v1.4.6 raise. Conservative: bounded by the worst-case per-image latency observed in production (~5.9 s tail; n=50 worst case ≈ 295 s under the 360 s Apps Script ceiling).
- `MAX_IMPORT_IMAGES_LINK_ONLY = 500` — applies when the user has the opt-in link-only checkbox active OR when every file in the batch is small enough that auto-fallback never triggers. Empirically, link-only inserts are ~150 ms each at p95 (vs. ~2 s for inline); 500 × 150 ms = 75 s, well below the runtime ceiling.
- **Picker dialog enforcement**: after the user toggles the link-only checkbox, the multiselect cap shown in the picker should switch live (Drive Picker SDK supports a `setMaxItems()` option in builder).
- **Selection truncation copy** localized for both caps: *"Up to 50 images per batch in standard mode" / "Up to 500 images per batch in link-only mode."*

Mixed-path batches (some files succeed inline, some auto-fallback to link-only) are bounded by the inline cap, since the user opted into inline mode at picker time. This keeps the policy predictable.

## 5. OAuth / Marketplace impact

### Scope changes: **None.**
- Existing scopes (`drive.file`, `documents.currentonly`, `script.external_request`, `script.container.ui`) cover everything needed.
- `DriveApp.getFileById(id).getBlob()` is authorized by `drive.file` for files the user has selected via the picker (which is how the file ended up in the doc as a Source Image Link in the first place).
- No `UrlFetchApp` calls to new hosts → `urlFetchWhitelist` unchanged.

### Manifest changes: **None.**

### Marketplace re-approval: **Not required.**
- No scope additions, no manifest changes, no privacy-policy updates.
- Behavioural change is internal — we use already-granted permissions to read the same Drive file via a different API.
- Worth confirming with Google's developer support before deploy, but the verification team's standing rule is "incremental code changes within already-granted scopes do not trigger re-verification."

### Privacy / compliance
- No new data flows. Transcription always sent the same Drive image bytes to Gemini; this spec changes only how we *retrieve* those bytes locally before sending.
- No update to `docs/en/PRIVACY_POLICY.md` (or UK/RU mirrors).

## 6. Telemetry

New OBS event fields (no new event types):

- **`import_drive_image_processed`** gains `outcome: 'inline_added' | 'link_only_added' | 'skipped'` and (when applicable) `appendImageError`. The user-explicit `linkOnlyMode: bool` flag indicates whether the link-only path was triggered by `appendImage` failure or by user toggle.
- **`import_drive_done`** gains `addedInline`, `addedLinkOnly`, `skipped` counters.
- **`transcribe_image_*`** events gain `imageSource: 'inline' | 'drive_url'` so we can measure the transcription-path split and ensure latency parity.

No new telemetry plumbing — everything reuses existing helpers.

## 7. Acceptance criteria

- ☐ A previously-failing file from issue #22 (e.g. `116300570_00009.jpeg`, 2.48 MB, "Invalid image data") imports as link-only — no skip — and transcribes successfully when selected.
- ☐ A baseline-RGB JPEG from a working batch (e.g., the Turilche set) imports inline as before — no perf regression for the happy path.
- ☐ A user toggling the "link-only" checkbox can select up to 500 files in the picker (vs. 50 in inline mode) and the import completes within the 360 s Apps Script ceiling.
- ☐ A user toggling the "link-only" checkbox imports a 100-file batch in noticeably less time than the inline path would take and produces a visibly smaller `.docx` on download.
- ☐ A genuinely corrupted file (e.g., a `.jpg` containing non-image bytes) still ends up in the skipped-files panel with the actual exception (because the Drive blob read itself fails, not just `appendImage`).
- ☐ Both `kind: 'inline'` and `kind: 'link_only'` entries in the same document transcribe correctly when selected together in a batch.
- ☐ E2E suite extended: a fixture file that triggers `appendImage` rejection (e.g., a CMYK JPEG checked into `e2e/fixtures/`) is imported and transcribed successfully through the auto-fallback path.
- ☐ OBS data after one week shows `outcome: 'link_only_added'` events tracking the previous `errorCode:UNKNOWN errorMessage:"Invalid image data"` count, with `transcribe_image_*` `imageSource: 'drive_url'` events appearing for the same files.

## 8. Risks

- **`getFileById(id).getBlob()` quotas.** Drive API has per-user, per-script quotas. With the existing inline path we hit `getBlob()` once per import (then read from inline element on transcribe). Hybrid mode hits `getBlob()` once on import + once on transcribe. Per-user impact is small; investigate quota headroom before rolling out.
- **Source URL parsing.** `file.getUrl()` returns Drive share URLs in multiple formats (`/file/d/{id}/`, `/open?id={id}`, etc.). Need a robust `extractFileIdFromUrl` that handles all of them. Probably a 10-line helper with a small unit-test fixture.
- **User confusion when an image is link-only.** Without a thumbnail, users may not realise transcription will work. Mitigate via UX copy in the sidebar tooltip + a brief explainer in the user guide.
- **Document still grows for link-only mode** — the H2 + link paragraph still consume some doc capacity. This is a **partial** fix for issue #20, not a complete one. A 1000-record doc in link-only mode is still a 1000-paragraph doc. Worth measuring; if it's still hitting the wall at ~2000 records, a follow-up split-document feature may be needed.
- **Existing docs.** Already-imported docs aren't affected — only future imports. Users who already worked around the issue by manually drag-dropping won't see any change to their existing docs.

## 9. Out of scope (deferred)

- **Auto-resize on import for files that exceed `appendImage`'s ~2 MB hard cap.** Once link-only fallback ships, this is no longer urgent — those files just become link-only entries and transcribe normally. If users still want embedded previews for large files, a separate spec can address client-side downsample-on-import.
- **Issue #20 doc-overflow.** Mitigated as a side effect; not fully solved. A "split document at N records" automation could ship later if needed.
- **Issue #21 structured Sheets export.** Independent feature — can pair with link-only mode (link-only → CSV → Sheet pipeline becomes very natural) but not required for either spec.

## 10. Implementation sketch (estimate, not contract)

| Change | File | Estimate |
|---|---|---|
| Refactor inline-image discovery → entry discovery (inline + link-only) | `addon/Code.gs` (`getImageList`, `findInlineImageAtBodyIndex`, plus new `findEntryAtBodyIndex` & `extractFileIdFromUrl`) | ~50 lines |
| Auto-fallback in import loop (catch `appendImage` → write link-only, don't skip) | `addon/Code.gs` (`importFromDriveFileIds` ~339–397) | ~20 lines |
| Split per-batch cap into `MAX_IMPORT_IMAGES_INLINE` (50) and `MAX_IMPORT_IMAGES_LINK_ONLY` (500); switch picker SDK `setMaxItems()` live based on link-only checkbox state | `addon/Code.gs` (constants, picker dialog) + `addon/I18n.gs` | ~15 lines + 2 i18n keys |
| Drive-URL transcription path in `transcribeImageByIndex` | `addon/Code.gs` (~2443) | ~15 lines |
| Link-only checkbox in picker dialog + Document Property persistence | `addon/Code.gs` (`getDrivePickerHtml`) + `addon/I18n.gs` | ~25 lines + 6 i18n keys |
| Sidebar icon for link-only entries | `addon/Code.gs` (sidebar HTML list rendering) + `addon/I18n.gs` | ~15 lines + 2 i18n keys |
| Telemetry field additions | `addon/Code.gs` (logObsEvent payloads) | ~10 lines |
| E2E fixture + test (CMYK JPEG → import → transcribe) | `e2e/fixtures/`, `e2e/geneascript-addon.spec.ts` | ~40 lines |
| Eval / docs / changelog | `eval/`, `docs/en/USER_GUIDE.md` (+ UK/RU mirrors), `CHANGELOG.md` | ~30 lines docs |
| **Total** | | **~165 lines + 8 i18n keys + tests** |

No new abstractions, no new dependencies. Pure refactor + decoupling.
