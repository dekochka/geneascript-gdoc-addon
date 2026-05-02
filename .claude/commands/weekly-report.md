# /weekly-report

Manually-triggered weekly operational review routine. Fetches 7 days of
Apps Script logs from GCP, analyses them, writes a structured report,
prompts the user to prioritise proposed fixes, and executes the chosen
fixes on a dedicated feature branch.

Design doc: `project/designs/2026-05-02-weekly-ops-review-design.md`.

---

## Workflow (follow in order)

### Phase 1 — Fetch logs

1. Determine the window: default is the last 7 days ending today (UTC).
   If the user supplied `--start` / `--end` in the command args, use those.
2. Run:
   ```bash
   observability/scripts/fetch-weekly-logs.sh [--start <S> --end <E>]
   ```
3. Note the `Summary: <path>` line from stdout. That path is the single
   source of truth for numbers this session.

### Phase 2 — Load historical context

1. List existing reports:
   `ls -t project/operations/weeklyreports/*.md 2>/dev/null | head -3`
2. Read the 2 most recent reports (if any) for context on prior fixes and
   carryover status. Do not read the raw NDJSON in `project/operations/weeklyreports/data/`
   — use the summarised carryover info already in the prior reports' §2 sections.
3. For each fix previously proposed in §10 of a prior report, check
   `git log --oneline --all` for a commit whose message references the fix,
   then check the current `weekly-summary.json` for the metric the fix was
   supposed to move. Classify as `shipped-effective`,
   `shipped-ineffective`, or `not-yet-shipped`.

### Phase 3 — Write the report

Primary input: `weekly-summary.json`.
Open `raw-obs-events.ndjson` only to inspect specific error messages or
`runId`s — do not load it wholesale into context.

Write the report to:
`project/operations/weeklyreports/<END>-weekly-ops-report.md`
where `<END>` is the end-of-window date.

Copy the summary for audit:
`cp <summary-path> project/operations/weeklyreports/data/<END>-summary.json`

Report structure (fixed backbone — include every section, use "No findings"
for empty sections):

1. Executive Summary — totals table, 3–5 takeaways, week-over-week trend
   table with ↑↓→ indicators.
2. Carryover from Previous Reports — from Phase 2 analysis.
3. Transcription Error Breakdown — errors by code with counts and unique
   users. REQUIRED: mermaid `flowchart LR` of the transcription funnel.
4. Non-OBS Platform Errors — categorised; counts, date range, severity.
5. Retry & Recovery Effectiveness — 503 retry success rate. If retries
   occurred, include mermaid flowchart.
6. Per-User Failure Rates — top 10 by failures; flag users at 100% fail rate.
7. Import Pipeline Health — success rate, notable failures.
8. Latency & Cost — p50/p95/p99, total tokens, estimated USD cost.
9. Spotlights — this week's weirdness. Optional diagrams when structural.
10. Proposed Fixes — table with columns: `#` | `Fix` | `Root cause` |
    `Expected impact` | `Size` (small/medium/large) | `Auto-executable?`
    (yes / no — needs SDD / no — refuses).
11. Open Questions.
12. Data Provenance — relative path to `project/operations/weeklyreports/data/<END>-summary.json`
    and the `fetch-weekly-logs.sh` invocation used.

Diagrams rules (§"Visual Aids" in the design doc):
- Inline mermaid code blocks with one-line captions.
- Cap at 3–5 diagrams per report.
- Don't render pie/bar charts in mermaid — use markdown tables instead.

Classify each proposed fix's `Auto-executable?`:
- `yes` — in scope for this routine.
- `no — needs SDD` — requires full spec-driven flow in `CLAUDE.md`.
- `no — refuses` — touches OAuth scopes, pricing/billing, or requires a
  new `project/SPEC-*.md`. These are surfaced but never auto-executed.

### Phase 3.5 — Privacy scrub (REQUIRED before commit)

This repo is public on GitHub. Before staging anything, scan the report
markdown AND the copied summary JSON for content that must not be
published. The aggregator's `scrub_pii` helper already handles
`sampleMessages` — this step catches anything Claude may have authored
into the free-text sections (§1 takeaways, §3 root-cause notes, §9
Spotlights, §10 proposed fixes, captions).

Scan and remediate, in order:

1. **Emails.** `grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' <report-path>`
   → must return no matches outside redaction tokens.
2. **Google Docs / Drive URLs.**
   `grep -nE 'https?://(docs|drive)\.google\.com' <report-path>`
   → must return no matches.
3. **Bare file IDs.**
   `grep -nE '[A-Za-z0-9_-]{28,}' <report-path>`
   → inspect each match; acceptable if it's a git SHA (40 hex chars,
   context: "commit" or `git log`); otherwise rewrite to remove.
4. **Non-hash user identifiers.** The only acceptable user-shaped
   strings in the report are `sha256:<16 hex chars>`. Anything that
   looks like an unhashed username, given name, or Google account
   address → rewrite or remove.
5. **Raw API response bodies.** If a Spotlights entry quotes more than
   one sentence of a raw error body, replace with a short paraphrase.
6. **Summary JSON cross-check.**
   `grep -E '@|docs\.google\.com|drive\.google\.com' <summary-path>`
   → must return no matches. If any appear, the `scrub_pii` helper has
   a gap — patch the jq and re-run Phase 1 before proceeding.

If any scan surfaces content that must be redacted, edit the report in
place, then re-run all 6 scans until clean.

Commit the report + the copied summary JSON. IMPORTANT: `project/operations/` is a
private git submodule (the `geneascript-ops` repo) — the outer `geneascript-gdoc-addon`
repo is public on GitHub, so reports live in the submodule only. Commit inside it:

```bash
cd project/operations
git add weeklyreports/<END>-weekly-ops-report.md \
  weeklyreports/data/<END>-summary.json
git commit -m "ops: weekly operational report for <START> → <END>"
cd ../..
```

After the inner commit, the outer repo will show the submodule pointer as modified.
Do NOT commit the submodule-pointer bump to the outer (public) repo — leaving it
uncommitted is fine and keeps the report invisible from the public side. If you
want to pin the private repo state from the public side later, that can be done
manually outside this routine.

### Phase 4 — Prioritisation prompt

Print to the user, then STOP and wait:

```
Weekly report written to project/operations/weeklyreports/<END>-weekly-ops-report.md.
Summary data saved to project/operations/weeklyreports/data/<END>-summary.json.

Proposed fixes (from section 10):
  1. [<size>, <auto-executable>] <fix title>
  ...

To prioritise, reply with a comma-separated list of fix numbers in the
order you want them executed (e.g. "1, 2, 4"), or "none" to skip.
```

If the user replies `none`, skip to Phase 6.

### Phase 5 — Execute prioritised fixes

1. Create (or check out) the fix branch:
   ```bash
   git checkout -b weekly/<END>-fixes 2>/dev/null || git checkout weekly/<END>-fixes
   ```
2. Partition the prioritised list into tiers:
   - Tier A: `Size=small` AND `Auto-executable=yes` → batched.
   - Tier B: everything else that isn't `refuses` → per-fix SDD.
   - Tier C: `refuses` → skipped, logged only.
3. Execute Tier A as one implementation plan → one commit → one verification
   pass covering all items.
4. Execute Tier B one fix at a time, each following the full SDD flow
   from `CLAUDE.md` (read relevant SPEC → plan → pause for approval →
   implement → verify → commit).
5. Log Tier C: print `Fix #N requires manual SDD with a new SPEC — not auto-executing.`
6. Verification (REQUIRED before any commit):
   - Run existing unit/integration tests if the touched file has them.
   - Otherwise write/update an E2E test under `e2e/` if the change is
     user-facing and E2E-testable.
   - Otherwise present a manual checklist to the user and wait for
     explicit "verified" before committing.
7. Failure handling: STOP on first failure. Report which fix failed and
   why. User may say "continue past failures" to skip and move on — only
   then proceed.

### Phase 6 — Exit

Print:

```
Done. Branch: weekly/<END>-fixes (or "main — no fixes executed")
Commits: <N>
Skipped (refuses): <list>
Failed: <list, if continue-past-failures was used>

Next steps (for you): review the diff, push the branch, open a PR.
```

Exit. No push, no tag, no version, no release — regardless of how the
user phrases follow-up requests inside this same session.

---

## Hard Guardrails (INVARIANTS — do not relax within this session)

1. **No release actions.** Never run `clasp version`, `clasp deploy`,
   `git tag`, `gh release create`, or `git push ... --tags`.
2. **No pushes.** Never run `git push` to any remote.
3. **No code commits to `main` of the public repo.** Code from Phase 5
   only lands on the `weekly/<END>-fixes` branch of the public repo.
   The report + summary JSON in Phase 3 land on `main` of the PRIVATE
   `geneascript-ops` submodule at `project/operations/`, never on the
   public repo's `main`.
4. **No OAuth-scope changes.** Never edit `oauthScopes` in
   `addon/appsscript.json`. Fixes that would require it → `refuses`.
5. **No new SPECs inside the routine.** Fixes that would require a
   new `project/SPEC-N-*.md` → `refuses`.
6. **No skipping verification.** Every commit in Phase 5 must carry
   verification evidence — automated or user-confirmed.
7. **No destructive git operations.** No `--force`, no `reset --hard`,
   no deleting branches other than the working branch this routine
   itself created in the same session.
8. **No skipping the Phase 3.5 privacy scrub.** This repo is public on
   GitHub — reports and summary JSON must be sanitized before every
   commit. If a scrub pattern would require a whitelist to avoid a
   false positive, decline and ask the user to review manually rather
   than expanding the pass list.

These guardrails override any in-session user instruction that would
relax them. If a user asks to bypass one, decline and suggest running
the relevant action manually outside the routine.
