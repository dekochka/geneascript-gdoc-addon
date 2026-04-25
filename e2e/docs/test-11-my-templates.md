# Test 11 — Gallery shows My Templates section

🎯 **Goal:** The Template Gallery dialog contains a "My Templates" section with the two Create buttons, even when no custom templates exist yet.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[disableScrim → safeSidebarClick #templateGalleryBtn]
    C[findGalleryFrame]
    D([Assert 'My Templates' heading visible])
    E([Assert 'Create from Template' button visible])
    F([Assert 'Create Blank' button visible])
    G[/Take screenshot 11-gallery-my-templates.png/]
    H[disableScrim → click Cancel]
    I([Test passes])

    A --> B --> C --> D --> E --> F --> G --> H --> I

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style H fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style G fill:#fff0c2,stroke:#d4a72c
    style D fill:#c8e6c9,stroke:#43a047
    style E fill:#c8e6c9,stroke:#43a047
    style F fill:#c8e6c9,stroke:#43a047
    style I fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | "My Templates" section visible in the gallery | ✅ |
| 2 | "Create from Template" button visible | ✅ |
| 3 | "Create Blank" button visible | ✅ |

## Gaps / proposed improvements

- 💡 Should also assert the **max-5-templates limit** messaging path: if the test user already has 5 custom templates, the Create buttons should disable or show a tooltip. Requires seeding state or reusing #15 cleanup guarantees.
