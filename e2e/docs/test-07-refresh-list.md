# Test 07 — Refresh image list

🎯 **Goal:** After images have been imported (either by previous test runs or by test #6), clicking Refresh populates the sidebar image list.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    B[Click #refreshImgBtn]
    C[/Server call: getImageList/]
    D([Assert first checkbox visible<br/><sub>timeout 120s</sub>])
    E([Assert checkbox count ≥ 1])
    F([Assert #imgCount ≠ '0'<br/><sub>timeout 30s</sub>])
    G([Test passes])

    A --> B --> C --> D --> E --> F --> G

    style A fill:#cfe3ff,stroke:#4a90e2
    style B fill:#cfe3ff,stroke:#4a90e2
    style C fill:#fff0c2,stroke:#d4a72c
    style D fill:#c8e6c9,stroke:#43a047
    style E fill:#c8e6c9,stroke:#43a047
    style F fill:#c8e6c9,stroke:#43a047
    style G fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Current coverage |
|---|---|---|
| 1 | At least one image checkbox renders after Refresh | ✅ |
| 2 | Sidebar image counter reflects non-zero count | ✅ |

## Gaps / proposed improvements

- ⚠️ **Silent dependency on doc state** — if #6 was skipped and the doc has no pre-imported images, this test fails with a confusing timeout instead of a clear "no images to refresh" message.
- 💡 Could add pre-check `if (count === 0) test.skip(...)` with a clear message pointing to #6 or manual import.
