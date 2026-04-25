# Test 05 — No API key banner

🎯 **Goal:** When no Gemini API key is configured, the yellow "Set up your API key" banner shows and Transcribe/Extract buttons are disabled.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B{#keyBanner visible?}
    C[/test.skip<br/>'API key is already configured'/]
    D([Assert #keyBanner visible])
    E([Assert #goBtn is disabled])
    F([Assert #extractBtnSidebar is disabled])
    G([Test passes])

    A --> B
    B -- no --> C
    B -- yes --> D --> E --> F --> G

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#fff5b8,stroke:#d4a72c
    style C fill:#f3c2c2,stroke:#c62828
    style D fill:#c8e6c9,stroke:#43a047
    style E fill:#c8e6c9,stroke:#43a047
    style F fill:#c8e6c9,stroke:#43a047
    style G fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | If no key is set — banner visible | ✅ |
| 2 | If no key is set — Transcribe button disabled | ✅ |
| 3 | If no key is set — Extract button disabled | ✅ |
| 4 | Skips cleanly when key IS set | ✅ |

## Gaps / proposed improvements

- ℹ️ This test is **inherently only informative on first setup**. Once the test account has a saved key, every run skips this.
- ℹ️ The reverse case ("banner hides after Setup save") is **intentionally not tested here** per product owner direction — Fix 4b was declined.
