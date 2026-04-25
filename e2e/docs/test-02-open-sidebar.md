# Test 02 — Open card, sidebar, core controls

🎯 **Goal:** Smoke-test that the add-on menu → homepage card → sidebar pipeline produces a usable sidebar with all six core buttons.

> This is the critical **Fix A** regression test — it exercises `openSidebarFromCard` via the right-rail icon path.

```mermaid
flowchart TD
    A[Navigate to test doc URL]
    B{Rail icon visible?}
    C[Click rail icon<br/><sub>ADDON_ICON_LABEL_RE</sub>]
    D[Click Open Sidebar button<br/><sub>triggers openSidebarFromCard</sub>]
    E[Click Extensions menu<br/>Hover 'GeneaScript - Metric Book Transcriber'<br/>Click 'Open Sidebar' submenu]
    F[waitForSidebarFrame]
    G([Assert #importBtn visible])
    H([Assert #setupBtn visible])
    I([Assert #extractBtnSidebar visible])
    J([Assert #templateGalleryBtn visible])
    K([Assert #refreshImgBtn visible])
    L([Assert #goBtn visible])
    M([Test passes])

    A --> B
    B -- yes --> C --> D --> F
    B -- no/throws --> E --> F
    F --> G --> H --> I --> J --> K --> L --> M

    style A fill:#cfe3ff,stroke:#4a90e2
    style C fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style E fill:#cfe3ff,stroke:#4a90e2
    style F fill:#cfe3ff,stroke:#4a90e2
    style B fill:#fff5b8,stroke:#d4a72c
    style G fill:#c8e6c9,stroke:#43a047
    style H fill:#c8e6c9,stroke:#43a047
    style I fill:#c8e6c9,stroke:#43a047
    style J fill:#c8e6c9,stroke:#43a047
    style K fill:#c8e6c9,stroke:#43a047
    style L fill:#c8e6c9,stroke:#43a047
    style M fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Sidebar opens within 120 s via EITHER rail-card OR menu path | ✅ fallback |
| 2 | All 6 action buttons visible and focusable | ✅ |
| 3 | No platform error logged for `openSidebarFromCard` | ❌ Not verified from the test side |

## Gaps / proposed improvements

- ⚠️ **No check that `openSidebarFromCard` didn't log a platform error** — the bug fixed in v1.4.3 was invisible to users but showed 23 ERROR entries/week in GCP logs. Could be verified by inspecting `page.on('console')` or requesting Apps Script execution logs after the test.
- 💡 Optional: assert `#footer` text matches current version (fast early-warning if `clasp push` didn't take).
