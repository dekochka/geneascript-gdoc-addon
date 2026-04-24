# E2E Suite Optimization — 2026-04-25

## Problem

The Playwright E2E suite has significant runtime waste that makes iteration slow (~25–30 min for a full run). Failures are also hard to diagnose because arbitrary sleeps hide the real wait condition.

## Inventory of waste

1. **Per-test doc reloads — the biggest cost.** Every test calls `openGeneascriptSidebar()`, which does `page.goto(testDocUrl())` and waits for Docs to hydrate (~15 s). Over 17 tests that's ~4 min spent reloading a doc we already have open. Tests are declared serial, so this is pure waste.

2. **27 hard-coded `waitForTimeout` calls totaling ~66 seconds of guaranteed sleep.** Most are "settle the UI" buffers rather than legitimate waits. Examples:
   - `helpers.ts:40` — `waitForTimeout(5000)` after account-chooser click → should wait for URL change
   - `helpers.ts:237` — `waitForTimeout(2000)` generic buffer
   - `spec.ts:113,161,217,222,270,550,630,637` — 2–5 s buffers after an action, many replaceable with `expect(locator).toBeVisible()`

3. **Default test timeout of 180 s in `playwright.config.ts`** — masks real stalls. A genuinely broken test can still pass if it lucks into a concrete locator after a 170 s wait. Lower to 60 s to get fast feedback on regressions.

4. **Profile copy step in `fixtures.ts` (~1–2 s per test).** Already removed in the v1.4.3 branch (launches source profile directly); keep that change.

## Proposed fixes

| # | Change | Expected saving |
|---|---|---|
| 1 | Open the doc + sidebar once in a `beforeAll` / shared fixture, reuse `Frame` across tests in the same `describe.serial` block. | ~3–4 min |
| 2 | Replace every `waitForTimeout` that is not a deliberate network/retry delay with `expect(...).toBeVisible()` / `waitForURL` / `waitForFunction`. | ~45–60 s |
| 3 | Reduce `use.actionTimeout` and test timeout in `playwright.config.ts` from 180 s → 60 s. | No direct saving but surfaces regressions faster. |
| 4 | Drop redundant `page.waitForTimeout(400)` inside sidebar frame-discovery loops — replace with `expect.poll`. | ~3–5 s |

Target runtime: **~8–12 min** for a full suite.

## Acceptance

- All 17 existing tests still pass (no behavior changes)
- Full run under 15 min on the test account
- No `waitForTimeout` > 1 s remaining in `e2e/` unless annotated with a comment explaining why

Owner: @dkochkin
