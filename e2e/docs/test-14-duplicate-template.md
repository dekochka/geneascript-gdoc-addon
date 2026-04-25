# Test 14 — Duplicate custom template

🎯 **Goal:** Clicking "Duplicate" on a custom template creates a copy with "(copy)" suffix and the new card appears in a reloaded gallery.

**Depends on #12** — 'E2E Test Template' must exist.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[disableScrim → safeSidebarClick #templateGalleryBtn]
    C[findGalleryFrame]
    D[Find .card with 'E2E Test Template']
    E[Click its '.action-link' Duplicate link]
    F[/Gallery dialog closes, then reopens/]
    G[Poll frames up to 60s:<br/>frame has #previewToggle AND<br/>'E2E Test Template copy']
    H([Assert galAfter ≠ null<br/><sub>duplicated template is visible in fresh gallery</sub>])
    I[/Screenshot 14-duplicated/]
    J[Click Cancel]
    K([Test passes])

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style E fill:#cfe3ff,stroke:#4a90e2
    style J fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#fff0c2,stroke:#d4a72c
    style F fill:#fff0c2,stroke:#d4a72c
    style G fill:#fff0c2,stroke:#d4a72c
    style I fill:#fff0c2,stroke:#d4a72c
    style H fill:#c8e6c9,stroke:#43a047
    style K fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Duplicate action triggers gallery re-render | ✅ |
| 2 | New card labelled 'E2E Test Template (copy)' appears | ✅ |

## Gaps / proposed improvements

- 💡 Could verify the duplicate has a **distinct ID** (not the same as the source) by inspecting data attributes on the card.
- 💡 Could also check the total custom-template count increased by exactly 1.
