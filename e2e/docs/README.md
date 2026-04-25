# E2E Test Scenarios — Flow Diagrams

This folder documents every Playwright E2E test as a flow diagram. Each test has a clear **goal**, the **user actions** it simulates, and the **assertions / acceptance criteria** that gate pass/fail.

**How to read each diagram (top → bottom):**

- 🎯 **Goal** — what the test proves
- 🔵 rectangles — actions the test performs on the page
- 🟡 diamonds — conditional branches (skip conditions etc.)
- 🟢 rounded rectangles — assertions (acceptance criteria). A test PASSES only when every 🟢 check holds.
- 🔴 terminal — explicit failure / skip

**Source:** `e2e/geneascript-addon.spec.ts` (tests run serially — state carries between tests).

## Test index

1. [Blank out test document](test-01-blank-doc.md)
2. [Open card, sidebar, core controls](test-02-open-sidebar.md)
3. [Empty doc — no images for refresh](test-03-empty-refresh.md)
4. [Setup AI dialog](test-04-setup-dialog.md)
5. [No API key banner](test-05-key-banner.md)
6. [Import images from Drive](test-06-import-drive.md)
7. [Refresh image list](test-07-refresh-list.md)
8. [No image selected — transcribe disabled](test-08-transcribe-disabled.md)
9. [Extract Context dialog](test-09-extract-dialog.md)
10. [Template Gallery preview tabs](test-10-gallery-tabs.md)
11. [Gallery shows My Templates section](test-11-my-templates.md)
12. [Create blank custom template](test-12-create-template.md)
13. [Apply custom template](test-13-apply-template.md)
14. [Duplicate custom template](test-14-duplicate-template.md)
15. [Delete custom templates](test-15-delete-templates.md)
16. [Batch transcribe](test-16-batch-transcribe.md)
17. [Document result structure](test-17-result-structure.md)
