# Test 03 — Empty doc: no images for refresh

🎯 **Goal:** After blanking the doc, verify Refresh correctly reports zero images and doesn't show stale state.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[Click #refreshImgBtn]
    C[/Server call: getImageList/]
    D([Assert #imgCount === '0'<br/><sub>timeout 120s</sub>])
    E([Test passes])

    A --> B --> C --> D --> E

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#c8e6c9,stroke:#43a047
    style E fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Refresh triggers `getImageList` | ✅ implicit |
| 2 | Count settles at "0" within 120 s | ✅ |

## Gaps / proposed improvements

- ⚠️ **Redundant with #1** — if #1 successfully blanked the doc and #2 opened the sidebar, the count is trivially zero. Considered optional smoke-coverage; could be merged into #1 or dropped.
- 💡 Could assert the empty-state message text renders (`sidebarEmptyState`), proving the UI branch triggers.
