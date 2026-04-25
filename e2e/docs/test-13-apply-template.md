# Test 13 — Apply custom template

🎯 **Goal:** Selecting a custom template and clicking Apply persists the selection and updates the sidebar template label.

**Depends on #12** — the 'E2E Test Template' must already exist.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[disableScrim → safeSidebarClick #templateGalleryBtn]
    C[findGalleryFrame]
    D[Find .card containing 'E2E Test Template']
    E[Click the card]
    F([Assert card has class 'selected'])
    G[Click #applyBtn]
    H[/Server call: applyTemplate/]
    I([Assert #statusMsg contains 'applied'/'застосовано'<br/><sub>timeout 30s</sub>])
    J[/Screenshot 13-applied-custom/]
    K[Poll sidebar #templateLabel<br/><sub>v1.4.0 fix uses 2s poll</sub>]
    L([Assert #templateLabel contains 'E2E Test Template'<br/><sub>timeout 15s</sub>])
    M([Test passes])

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K --> L --> M

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style E fill:#cfe3ff,stroke:#4a90e2
    style G fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#fff0c2,stroke:#d4a72c
    style H fill:#fff0c2,stroke:#d4a72c
    style J fill:#fff0c2,stroke:#d4a72c
    style K fill:#fff0c2,stroke:#d4a72c
    style F fill:#c8e6c9,stroke:#43a047
    style I fill:#c8e6c9,stroke:#43a047
    style L fill:#c8e6c9,stroke:#43a047
    style M fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Clicking a custom-template card marks it `.selected` | ✅ |
| 2 | Apply succeeds and status message confirms | ✅ |
| 3 | Sidebar template label updates via polling (v1.4.0 fix) | ✅ |

## Gaps / proposed improvements

- 💡 Could verify the selected template ID is persisted to Document Properties by round-tripping through `getSelectedTemplateLabelForClient()` after a page reload.
