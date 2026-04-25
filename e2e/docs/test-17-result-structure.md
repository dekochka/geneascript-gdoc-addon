# Test 17 — Document result structure after transcription

🎯 **Goal:** Capture a full-page screenshot of the document after transcription for visual / human review.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B{#keyBanner visible?<br/><sub>means #16 was skipped</sub>}
    SK[/test.skip<br/>'No transcription result to capture'/]
    C[/Take full-page screenshot<br/>17-document-result-structure.png/]
    D([Test passes])

    A --> B
    B -- yes --> SK
    B -- no --> C --> D

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#fff5b8,stroke:#d4a72c
    style SK fill:#f3c2c2,stroke:#c62828
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | If #16 didn't run, skip rather than capture empty screenshot | ✅ |
| 2 | Screenshot is written | ✅ |

## Gaps / proposed improvements

- ⚠️ **Not really a test** — no assertions on content. Current value is a build artifact + visual QA reference.
- 💡 Could assert doc body contains:
  - Expected per-record markers (year header, names, languages)
  - Archive reference string from the Context section
  - No raw API error text ("HTTP 503" etc.) in the document body
  - Inserted paragraph count matches number of selected images × expected insertions
- 💡 Could compare against a baseline screenshot (visual regression) to catch layout changes.
