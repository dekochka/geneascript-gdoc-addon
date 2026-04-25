# Test 06 — Import images from Drive

🎯 **Goal:** Ensure the user can select and import multiple images from a Drive folder and they are inserted into the document + visible in the sidebar image list.

> Runs by default. Two modes:
> - **Fast path** (`GENEASCRIPT_IMPORT_FILE_IDS=id1,id2,...`): bypasses the picker and calls `importFromDriveFileIds` directly. Requires the test account to have already granted `drive.file` scope to those IDs (easiest way: run the picker manually once and note the IDs).
> - **Full picker** (when the env var is unset): drives the Google Picker iframe with DOM locators + CDP mouse events. Fragile but covers the user-visible flow.

```mermaid
flowchart TD
    A[Open GeneaScript sidebar]
    Z{GENEASCRIPT_IMPORT_FILE_IDS set?}

    subgraph F["Fast path"]
        F1[google.script.run<br/>importFromDriveFileIds<br/>from inside sidebar frame]
        F2([Assert result.ok === true])
        F3[Reload page + re-open sidebar]
        F4[Click Refresh]
        F5([Assert first checkbox visible])
        F6([Assert count ≥ provided IDs count])
    end

    subgraph P["Full picker flow"]
        P1[Click Import button]
        P2[disableScrim - kill MD scrim]
        P3[findPickerFrame<br/><sub>list view / doclist-grid iframe</sub>]
        P4[Double-click target folder]
        P5[CDP click: List View toggle]
        P6[CDP click: Name column sort]
        P7[CDP click file 1, Shift+click file 6<br/><sub>range select</sub>]
        P8[CDP click Select button]
        P9[Handle 'Importing' confirm alert<br/>multi-strategy OK click]
        P10[Poll up to 3 min:<br/>sidebar Refresh clickable = dialog gone]
        P11[Reload page + re-open sidebar]
        P12[Click Refresh]
        P13([Assert first checkbox visible])
        P14([Assert count ≥ IMPORT_IMAGE_COUNT])
    end

    G([Take after-import screenshot])
    H([Test passes])

    A --> Z
    Z -- yes --> F1 --> F2 --> F3 --> F4 --> F5 --> F6 --> G --> H
    Z -- no --> P1 --> P2 --> P3 --> P4 --> P5 --> P6 --> P7 --> P8 --> P9 --> P10 --> P11 --> P12 --> P13 --> P14 --> G

    style A fill:#cfe3ff,stroke:#4a90e2
    style F1 fill:#cfe3ff,stroke:#4a90e2
    style F3 fill:#cfe3ff,stroke:#4a90e2
    style F4 fill:#cfe3ff,stroke:#4a90e2
    style P1 fill:#cfe3ff,stroke:#4a90e2
    style P2 fill:#cfe3ff,stroke:#4a90e2
    style P4 fill:#cfe3ff,stroke:#4a90e2
    style P5 fill:#cfe3ff,stroke:#4a90e2
    style P6 fill:#cfe3ff,stroke:#4a90e2
    style P7 fill:#cfe3ff,stroke:#4a90e2
    style P8 fill:#cfe3ff,stroke:#4a90e2
    style P11 fill:#cfe3ff,stroke:#4a90e2
    style P12 fill:#cfe3ff,stroke:#4a90e2
    style P3 fill:#fff0c2,stroke:#d4a72c
    style P9 fill:#fff0c2,stroke:#d4a72c
    style P10 fill:#fff0c2,stroke:#d4a72c
    style G fill:#fff0c2,stroke:#d4a72c
    style Z fill:#fff5b8,stroke:#d4a72c
    style F2 fill:#c8e6c9,stroke:#43a047
    style F5 fill:#c8e6c9,stroke:#43a047
    style F6 fill:#c8e6c9,stroke:#43a047
    style P13 fill:#c8e6c9,stroke:#43a047
    style P14 fill:#c8e6c9,stroke:#43a047
    style H fill:#a5d6a7,stroke:#2e7d32
```

## Acceptance criteria

| # | Check | Fast path | Full picker |
|---|---|---|---|
| 1 | Server function accepts the import request without error | ✅ | ✅ (implicit via picker) |
| 2 | Sidebar image list contains at least the expected count | ✅ | ✅ |
| 3 | Picker opens, navigates, selects, and dismisses cleanly | — | ✅ |
| 4 | Post-import reload is not corrupted | ✅ | ✅ |

## Gaps / proposed improvements

- ⚠️ **"Document contains images" is asserted via the sidebar image list, not by inspecting the document DOM directly.** An image could be listed but not actually embedded in the doc body. Could add a check: `await page.evaluate(() => document.querySelectorAll('img[src*="drive"]').length)` or similar.
- 💡 The full-picker flow still uses hardcoded viewport pixel coordinates (1053,235 / 300,349 / 185,638). Brittle. Could be replaced with keyboard navigation (arrow keys + Enter) in a follow-up.
- 💡 Could capture the `import_drive_done` OBS event from Apps Script logs and assert `addedCount === expected`.
