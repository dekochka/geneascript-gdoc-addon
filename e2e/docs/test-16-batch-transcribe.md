# Test 16 — Batch transcribe (needs API key)

🎯 **Goal:** End-to-end transcription flow — select images, click Transcribe, handle replace-modal if present, wait for the run to finish.

> **Interactive:** if no API key is configured and no `GEMINI_API_KEY` env var is set, prompts the test runner on stdin for a key. Cached for the process so the prompt only appears once. Press Enter without input to skip transcription tests.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B{#keyBanner visible?}
    C{promptForGeminiKey returns key?}
    SK[/test.skip<br/>'Gemini API key not provided'/]
    D[saveGeminiKey via google.script.run]
    E([Assert save succeeded])
    F[Hide banner + call updBtn via in-frame JS]
    G([Assert #keyBanner hidden])
    H[Click Refresh]
    I([Assert image count ≠ '0'])
    J[Select up to 2 image checkboxes]
    K([Assert #goBtn enabled])
    L[Click Transcribe]
    M{#confirmModal visible?<br/><sub>replace existing transcription?</sub>}
    N[Click #confirmYes]
    O([Assert #progress visible within 30s])
    P([Assert #progText contains Done/Готово/etc<br/><sub>timeout 480s = 8 min</sub>])
    Q([Test passes])

    A --> B
    B -- yes --> C
    B -- no --> H
    C -- no --> SK
    C -- yes --> D --> E --> F --> G --> H
    H --> I --> J --> K --> L --> M
    M -- yes --> N --> O
    M -- no --> O
    O --> P --> Q

    style A fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style F fill:#cfe3ff,stroke:#4a90e2
    style H fill:#cfe3ff,stroke:#4a90e2
    style J fill:#cfe3ff,stroke:#4a90e2
    style L fill:#cfe3ff,stroke:#4a90e2
    style N fill:#cfe3ff,stroke:#4a90e2
    style B fill:#fff5b8,stroke:#d4a72c
    style C fill:#fff5b8,stroke:#d4a72c
    style M fill:#fff5b8,stroke:#d4a72c
    style SK fill:#f3c2c2,stroke:#c62828
    style E fill:#c8e6c9,stroke:#43a047
    style G fill:#c8e6c9,stroke:#43a047
    style I fill:#c8e6c9,stroke:#43a047
    style K fill:#c8e6c9,stroke:#43a047
    style O fill:#c8e6c9,stroke:#43a047
    style P fill:#c8e6c9,stroke:#43a047
    style Q fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | If no key: prompts interactively or reads `GEMINI_API_KEY` env var | ✅ |
| 2 | Key is saved via `saveApiKeyAndModel` server call | ✅ |
| 3 | After save, banner hides and Transcribe becomes available | ✅ |
| 4 | Progress bar appears | ✅ |
| 5 | Progress text eventually shows completion message | ✅ |

## Gaps / proposed improvements

- 💡 Should additionally assert:
  - The error banner (`#errorBanner`) is **NOT** visible after a successful run (would catch regressions where `API_OVERLOADED` / `API_KEY_INVALID` banner fires incorrectly).
  - No image row shows a `.st-fail` or `.st-warn` icon (all transcriptions succeeded).
- 💡 For flake protection: also accept "done with fails" but flag the test as informational with the number of failed images.
