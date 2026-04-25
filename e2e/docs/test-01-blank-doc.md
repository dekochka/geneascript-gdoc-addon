# Test 01 — Blank out test document

🎯 **Goal:** Start every full-suite run from a known-empty document so later tests aren't affected by leftover content.

```mermaid
flowchart TD
    A[Navigate to test doc URL<br/><sub>docs.google.com + addon_dry_run token</sub>]
    B[Open GeneaScript sidebar<br/><sub>via rail icon OR Extensions menu</sub>]
    C[Click into editor area<br/><sub>.kix-appview-editor</sub>]
    D[Select all: Cmd/Ctrl+A]
    E[Delete: Backspace]
    F[Wait 2s for Docs sync]
    G[/Take screenshot<br/>test-results/01-blank-doc.png/]
    H([Test passes])

    A --> B --> C --> D --> E --> F --> G --> H

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style C fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style E fill:#cfe3ff,stroke:#4a90e2
    style F fill:#cfe3ff,stroke:#4a90e2
    style G fill:#fff0c2,stroke:#d4a72c
    style H fill:#c8e6c9,stroke:#43a047
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Test doc loads within 120 s | ✅ via `openGeneascriptSidebar` timeout |
| 2 | Sidebar iframe finds `[data-testid="geneascript-import"]` | ✅ implicit |
| 3 | Editor is clickable (not blocked by overlays) | ✅ click succeeds |
| 4 | Screenshot is written | ✅ |

## Gaps / proposed improvements

- ⚠️ **No assertion the doc is actually empty** after the clear. A page-level check like `expect(await page.locator('.kix-canvas-tile-content').textContent()).toBe('')` would confirm the operation succeeded.
