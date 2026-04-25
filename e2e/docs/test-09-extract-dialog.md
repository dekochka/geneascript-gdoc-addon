# Test 09 — Extract Context dialog

🎯 **Goal:** When exactly one image is selected, the Extract Context dialog opens and shows its form.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[Click Refresh]
    C([Assert first image checkbox visible])
    D[Check first checkbox]
    E([Assert #extractBtnSidebar is enabled])
    F[Click #extractBtnSidebar]
    G[/Server call: openExtractContextDialogFromSidebar/]
    H[waitForModalText<br/><sub>/Cover Image|Обкладинка|Витягніть метадані/</sub>]
    I([Assert #extractBtn or first button in modal visible])
    J[Press Escape to close]
    K([Test passes])

    A --> B --> C --> D --> E --> F --> G --> H --> I --> J --> K

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style F fill:#cfe3ff,stroke:#4a90e2
    style J fill:#cfe3ff,stroke:#4a90e2
    style G fill:#fff0c2,stroke:#d4a72c
    style H fill:#fff0c2,stroke:#d4a72c
    style C fill:#c8e6c9,stroke:#43a047
    style E fill:#c8e6c9,stroke:#43a047
    style I fill:#c8e6c9,stroke:#43a047
    style K fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Selecting one image enables Extract button | ✅ |
| 2 | Clicking Extract opens the Extract dialog | ✅ |
| 3 | Dialog renders its form button | ✅ |

## Gaps / proposed improvements

- ⚠️ **Only tests dialog opening** — doesn't exercise the actual Gemini extraction call or verify Context paragraph is inserted into the doc.
- 💡 A deeper test would: click "Extract" in the dialog, wait for result fields, click "Apply", assert Context paragraph appears in doc body. Costs a real Gemini call — could be gated behind the same API-key prompt as #16.
