# Test 04 — Setup AI dialog

🎯 **Goal:** Verify the Setup AI modal opens cleanly with its form fields reachable.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[Click #setupBtn]
    C[/Server call: showSetupApiKeyAndModelDialog/]
    D["waitForModalText<br/><sub>regex: Setup AI / Налаштування ШІ / Настройка ИИ</sub>"]
    E([Assert first select or input in modal<br/>is visible within 30 s])
    F[Press Escape to close]
    G([Test passes])

    A --> B --> C --> D --> E --> F --> G

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style F fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#fff0c2,stroke:#d4a72c
    style E fill:#c8e6c9,stroke:#43a047
    style G fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | Modal with locale-aware title appears | ✅ |
| 2 | Modal contains at least one select or input | ✅ |
| 3 | Modal closes on Escape | ✅ implicit |

## Gaps / proposed improvements

- ⚠️ **Doesn't test save flow.** Saving a key is only tested in #16 (indirectly). If the Setup save handler breaks (e.g. dialog wiring regression), it's missed here.
- 💡 Could assert each known field by ID: `#apiKey`, `#modelId`, `#temperature`, `#maxOutputTokens`. Would catch schema drift.
