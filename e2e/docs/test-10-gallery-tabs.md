# Test 10 — Template Gallery preview tabs

🎯 **Goal:** Opening the Template Gallery reveals a preview pane that renders content for all 5 tabs (Context, Role, Columns, Output Format, Instructions).

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[disableScrim → safeSidebarClick #templateGalleryBtn]
    C[findGalleryFrame #previewToggle]
    D[Click #previewToggle]
    E([Assert #previewWrap.open visible])
    F{For each of 5 tabs}
    G[disableScrim → click tab button<br/><sub>Context / Role / Columns /<br/>Output Format / Instructions</sub>]
    H([Assert #tabContent NOT empty])
    I[disableScrim → click Cancel]
    J([Test passes])

    A --> B --> C --> D --> E --> F
    F --> G --> H --> F
    F -- all 5 done --> I --> J

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style G fill:#cfe3ff,stroke:#4a90e2
    style I fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style F fill:#fff5b8,stroke:#d4a72c
    style E fill:#c8e6c9,stroke:#43a047
    style H fill:#c8e6c9,stroke:#43a047
    style J fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Gallery opens with preview pane | ✅ |
| 2 | Each of 5 tabs switches and renders content | ✅ |
| 3 | Content area is not empty for any tab | ✅ |
| 4 | Cancel closes the gallery | ✅ implicit |

## Gaps / proposed improvements

- 💡 Could additionally assert tab content **differs** between tabs (proving actual tab switching, not just "stuck content"). A regression in v1.4.0 caused all tabs to share a textarea — this test would catch the next one.
