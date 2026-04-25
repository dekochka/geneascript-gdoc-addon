# E2E Optimization Part 2 — Shared Doc Fixture

**Status:** Planned — not started
**Dependent on:** Part 1 landed (`2026-04-25-e2e-optimization.md`) and v1.4.3 released

## Problem

Every test in the E2E suite starts with `openGeneascriptSidebar(page)`, which does a full `page.goto(testDocUrl())` and waits for Google Docs to hydrate (~30–45 s). Over 15 executed tests that's **~7–10 minutes of pure page-reload wait** per suite run — the biggest remaining cost after Part 1 trimmed sleeps.

Measured on 2026-04-25 full run (after Part 1):
- Total runtime: ~10–12 min
- Of which per-test doc reload: ~8 min
- Actual assertion work: ~2–4 min

## Why it works at all today

`test.describe.configure({ mode: 'serial' })` guarantees tests run in order, share no state by design, but Playwright still gives each test a fresh `page` fixture. Our tests rely on **document state** carrying over (e.g. test #13 needs the custom template created in #12) — they currently get this for free because the `page.goto` reloads the **same document** which has persisted state in Drive.

So the document state already persists. What we're wasting is the **browser hydration cycle**, not actual test isolation.

## Proposed change

### Step 1 — Add a shared `docPage` fixture

Create `e2e/fixtures-shared.ts`:

```typescript
import { test as base, Page, Frame } from '@playwright/test';
import { test as serialTest } from './fixtures';
import { openGeneascriptSidebar } from './helpers';

let sharedPage: Page | null = null;
let sharedSidebar: Frame | null = null;

export const test = serialTest.extend<{
  docPage: Page;
  docSidebar: Frame;
}>({
  docPage: async ({ context }, use) => {
    if (!sharedPage) {
      sharedPage = context.pages()[0] || await context.newPage();
      sharedSidebar = await openGeneascriptSidebar(sharedPage);
    }
    await use(sharedPage);
  },

  docSidebar: async ({ docPage }, use) => {
    if (!sharedSidebar) {
      sharedSidebar = await openGeneascriptSidebar(docPage);
    }
    await use(sharedSidebar);
  },
});
```

### Step 2 — Tests use `docPage` / `docSidebar` instead of fresh `page`

```typescript
// Before:
test('...', async ({ page }) => {
  const sidebar = await openGeneascriptSidebar(page);
  ...
});

// After:
test('...', async ({ docPage, docSidebar }) => {
  // No reload — page and sidebar already live from earlier tests.
  ...
});
```

### Step 3 — Handle stale-state risks

- **Dialogs left open** — each test must close dialogs it opened. Add a `test.afterEach` hook that presses Escape a few times to clean up modals.
- **Sidebar frame invalidation** — if a test causes a page navigation (e.g. test #6 Drive import calls `page.reload()`), the shared `sidebar` Frame handle becomes stale. Detect this by calling `sidebar.evaluate(() => 1)`; if it throws, reopen.
- **Test order matters more** — serial already guarantees this, but be explicit in comments.

### Step 4 — Guardrail: reload on unrecoverable errors

If a test fails, Playwright's retry or post-failure isolation might need a fresh page. Hook into `test.afterEach(async ({ docPage }) => { ... })` to verify the sidebar is still live; if not, null out the shared refs so the next test re-opens.

## Expected savings

| Metric | Current (post-Part 1) | Projected |
|---|---|---|
| Doc reloads | 15 × ~35 s = 8–9 min | 1 × ~35 s + 14 × ~1 s = 1 min |
| Total runtime | 10–12 min | **3–5 min** |

## Risks / open questions

1. **Playwright's test isolation model assumes fresh pages.** Sharing a page across tests is against the grain — a failing test can leave state that corrupts subsequent tests. Mitigation: strong `afterEach` cleanup.
2. **Retry behavior changes.** `retries: 1` in `playwright.config.ts` (CI) assumes each attempt is clean — with shared state, a retry may hit mid-flight dialogs.
3. **Debugging flakes becomes harder.** Failure in test N may actually have been caused by residue from test N-1.

## Acceptance

- All 17 tests still pass (no behavior changes)
- Full suite runtime **< 5 min** in happy path
- Per-test `openGeneascriptSidebar` call removed from every test file (exactly one in the fixture)
- Post-failure test isolation proven with a deliberate bug injection (one failing test shouldn't cascade into subsequent failures)

## Why this is Part 2 (not Part 1)

- Higher risk: breaks the "each test is independent" contract
- Needs per-test cleanup infrastructure that doesn't exist yet
- Can be iterated on without blocking v1.4.3 release
- Part 1 already trimmed ~10–15% for free, with zero risk

Owner: @dkochkin
Earliest implementation window: post-v1.4.3 release
