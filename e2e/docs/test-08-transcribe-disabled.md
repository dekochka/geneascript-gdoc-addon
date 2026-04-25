# Test 08 — No image selected: transcribe disabled

🎯 **Goal:** The Transcribe button is disabled whenever zero images are checked, even after the image list has been populated.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[Click Refresh]
    C([Assert first image checkbox visible])
    D[For each checkbox: uncheck]
    E([Assert #goBtn is disabled<br/><sub>timeout 10s</sub>])
    F([Test passes])

    A --> B --> C --> D --> E --> F

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style D fill:#cfe3ff,stroke:#4a90e2
    style C fill:#c8e6c9,stroke:#43a047
    style E fill:#c8e6c9,stroke:#43a047
    style F fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | After explicitly unchecking all boxes, Transcribe button is disabled | ✅ |

## Gaps / proposed improvements

- 💡 Symmetric test missing: check one box → Transcribe enabled. Covered partially by #9 (Extract) but not for Transcribe specifically.
- 💡 Could also assert `#goBtn` text reflects `"▶ Transcribe"` (or localized) rather than a multi-count variant.
