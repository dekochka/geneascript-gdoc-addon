# Test 15 — Delete custom templates (cleanup)

🎯 **Goal:** Clean up after tests #12–14 by deleting every custom template created, and confirm the sidebar falls back to an OOB template label. Serves as test + cleanup.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B{Loop up to 3 times}
    C{Gallery already open?}
    D[disableScrim → safeSidebarClick #templateGalleryBtn]
    E[findGalleryFrame]
    F{.action-danger Delete button found?}
    G[Close gallery, exit loop]
    H[Click .action-danger Delete]
    I{#confirmYes modal visible?}
    J[Click #confirmYes]
    K[Wait 5s for gallery reload]
    L[Loop iteration ends]
    M[After loop: wait 5s]
    N[Read sidebar #templateLabel]
    O([Assert label does NOT contain<br/>'E2E Test Template'])
    P[/Screenshot 15-deleted-all/]
    Q([Test passes])

    A --> B
    B --> C
    C -- yes --> F
    C -- no --> D --> E --> F
    F -- no --> G --> M
    F -- yes --> H --> I
    I -- yes --> J --> K --> L
    I -- no --> K
    L --> B
    B -- 3 iterations done --> M --> N --> O --> P --> Q

    style A fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style H fill:#cfe3ff,stroke:#4a90e2
    style J fill:#cfe3ff,stroke:#4a90e2
    style G fill:#cfe3ff,stroke:#4a90e2
    style K fill:#cfe3ff,stroke:#4a90e2
    style M fill:#cfe3ff,stroke:#4a90e2
    style E fill:#fff0c2,stroke:#d4a72c
    style N fill:#fff0c2,stroke:#d4a72c
    style P fill:#fff0c2,stroke:#d4a72c
    style B fill:#fff5b8,stroke:#d4a72c
    style C fill:#fff5b8,stroke:#d4a72c
    style F fill:#fff5b8,stroke:#d4a72c
    style I fill:#fff5b8,stroke:#d4a72c
    style O fill:#c8e6c9,stroke:#43a047
    style Q fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | All custom templates can be deleted iteratively | ✅ |
| 2 | Confirm modal appears and is accepted | ✅ |
| 3 | After deletion, sidebar label reverts away from 'E2E Test Template' | ✅ |

## Gaps / proposed improvements

- 💡 Final assertion could be **stronger**: instead of "not contains E2E Test Template", assert label matches an OOB template name (Galician / Russian Imperial / Generic).
- 💡 Count-based assertion: after cleanup, `action-danger` buttons count = 0 in the gallery.
