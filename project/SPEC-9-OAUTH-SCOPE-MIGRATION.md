# Feature specification: OAuth Scope Migration (drive.file + Google Picker API)

**Status:** Approved  
**Target version:** v0.9.0  
**Related:** `SPEC-2-GDRIVE-to-GDOC.md` (Drive import feature), `SPEC-4-PUBLISH-MARKETPLACE.md` (OAuth verification)

---

## 1. Overview and user story

**What we are building and why**

Google's OAuth Verification team requires migration from the `drive.readonly` scope to the narrower `drive.file` scope as part of Workspace Marketplace listing requirements. The `drive.readonly` scope grants broad access to all of a user's Drive files, which violates the minimum scope requirement under Google's API User Data Policy.

This migration implements Google's recommended approach: use the Google Picker API for user-controlled file selection, combined with the `drive.file` scope that only grants access to files explicitly selected or created by the application. This provides better security posture, improved user trust through explicit consent, and eliminates the need for annual CASA security assessments required for restricted scopes.

**User story**

- As a **metric book researcher**, I want to **import scan images from Google Drive using a native file picker interface that starts in my document's folder** so that **I have clear visibility and control over which files the add-on accesses, and I can quickly select multiple images from the same folder where I created my document, without needing to navigate or paste URLs**.

**Business value**

- **Compliance**: Required for Google Workspace Marketplace approval and continued listing
- **Security**: Narrower scope follows principle of least privilege
- **User trust**: Explicit file selection gives users confidence in data access controls
- **Reduced audit burden**: `drive.file` is non-sensitive; no annual CASA recertification required

## 2. Scope

| Change | File(s) | Notes |
|--------|---------|--------|
| OAuth scope narrowing | `addon/appsscript.json` | Change `drive.readonly` → `drive.file` |
| Picker UI implementation | `addon/Code.gs` | New functions: `showDrivePickerDialog`, `getDrivePickerConfig`, `getDrivePickerHtml`, `showImportError` |
| Import refactoring | `addon/Code.gs` | New: `importFromDriveFileIds`, `extractDriveFileIds` (hidden functions, not exposed in UI) |
| Menu label update | `addon/Code.gs` | "Import Book from Drive Folder" → "Import Book from Drive Files" |
| Privacy Policy update | `docs/PRIVACY_POLICY.md` | Add data protection mechanisms section |
| User documentation | `docs/USER_GUIDE.md`, `README.md` | Update import flow descriptions |
| Installation guide | `docs/INSTALLATION.md` | Add Picker API configuration section |
| Architecture docs | `docs/DESIGN.md` | Document new Drive import architecture |
| OAuth response templates | `docs/OAUTH_VERIFICATION_RESPONSE_TEMPLATES.md` | Email templates for Google verification team |

**Out of scope**

- Changes to transcription workflow (unaffected by this migration)
- Automated testing infrastructure (manual testing only)
- Migration path for users with existing documents (documents remain functional; only import flow changes)
- Folder enumeration capability (explicitly removed; use multi-select instead)
- Manual file URL/ID paste fallback in UI (too complex for end users; Picker is the only supported flow)

## 3. UI and frontend

### Entry point

**Primary workflow:** Sidebar → **Import from Drive Files** button → [Google Picker opens directly]  
**Alternative:** Extensions → Metric Book Transcriber → **Import Book from Drive Files** → [Google Picker opens directly]

### Components / behavior

#### Loading Dialog (Modal, 300×150px)

**Purpose:** Brief loading indicator while Picker initializes; auto-closes when Picker opens

**Initial state:**
- Title: "Select Drive Images"
- Body: "Loading Google Picker..." (centered text)
- No buttons (auto-process)

**Loading sequence:**
1. Dialog opens with "Loading Google Picker..." message
2. Calls `google.script.run.getDrivePickerConfig()` immediately
3. On success: 
   - Google Picker API loads from CDN (`apis.google.com/js/api.js`)
   - Picker modal appears showing Drive files
   - Loading dialog auto-closes
4. On error (Picker not configured):
   - Status: "Picker is not configured. Contact your administrator." (red, 3 seconds)
   - Dialog auto-closes after 3 seconds

**Picker interaction:**
1. Picker opens automatically (no button click needed)
2. **Picker starts in document's parent folder** (if available) - aligns with common workflow where doc is created in same folder as images
3. View: `google.picker.ViewId.DOCS_IMAGES` (images only)
4. Mode: `LIST` (clear file listing)
5. Feature: `MULTISELECT_ENABLED` (select multiple files)
6. User can navigate to other folders if needed (full Drive navigation available)
7. User selects 1+ image files
8. User clicks "Select" in Picker
9. Picker closes
10. Calls `google.script.run.importFromDriveFileIds(ids)`
11. Import proceeds in background
12. On success: Document shows import complete alert with counts
13. On error: Alert shows error message via `showImportError()`

**Note:** If document's parent folder cannot be determined (e.g., doc in "My Drive" root), Picker opens at Drive root with full navigation available.

### Error states

| Scenario | User sees |
|----------|-----------|
| **Picker not configured** | Loading dialog shows: "Picker is not configured. Contact your administrator." (red, 3 seconds, then auto-closes) |
| **Picker API load failure** | Loading dialog shows: "Failed to load Google Picker API. Check your network connection." (red, 3 seconds, then auto-closes) |
| **No files selected in Picker** | Picker closes silently (normal cancel behavior) |
| **User cancels Picker** | Picker closes silently (normal cancel behavior) |
| **No accessible images** | Alert: "No accessible JPEG/PNG/WebP files found. Added 0 images, skipped X files. Check file permissions or share settings." |
| **Some files inaccessible** | Alert: "Import complete. Added X images, skipped Y files (access denied or unsupported type)." |
| **Import exceeds MAX_IMPORT_IMAGES (30)** | Alert: "Import complete. Added 30 images (limit reached), skipped X additional files." |
| **Import fails after Picker** | Alert via `showImportError()`: "Import Failed: [error message]" |

### Mock data (for testing)

**Success case (`getDrivePickerConfig`):**
```json
{
  "ok": true,
  "developerKey": "AIza...",
  "appId": "123456789012",
  "oauthToken": "ya29.a0...",
  "parentFolderId": "1a2b3c4d5e6f7g8h9i0j"
}
```

**Note:** `parentFolderId` may be `null` if document is at Drive root or parent cannot be determined.

**Error case (`getDrivePickerConfig`):**
```json
{
  "ok": false,
  "message": "Picker is not configured. Set script properties GOOGLE_PICKER_API_KEY and GOOGLE_PICKER_APP_ID (Cloud project number)."
}
```

**Note:** The loading dialog is minimal (300×150px) and auto-closes quickly, so manual testing is straightforward.

## 4. Apps Script backend

### Core logic

**Picker configuration retrieval:**
- Read script properties `GOOGLE_PICKER_API_KEY` and `GOOGLE_PICKER_APP_ID`
- Generate OAuth token via `ScriptApp.getOAuthToken()`
- **Detect document's parent folder:**
  - Get document ID via `DocumentApp.getActiveDocument().getId()`
  - Use `DriveApp.getFileById(docId).getParents()` to find parent folder
  - If parent found, include `parentFolderId` in config (used to set Picker's initial view)
  - If not found (e.g., doc at Drive root), Picker opens at Drive root
- Return config object with optional `parentFolderId` or error

**File ID extraction (manual fallback):**
- Regex `/[-\w]{25,}/g` to extract all Drive IDs from user input
- Deduplicate IDs
- Return array

**Import from file IDs:**
- Loop through file IDs
- For each ID:
  - Call `DriveApp.getFileById(id)` (requires `drive.file` scope + user selection via Picker or explicit URL paste)
  - Validate MIME type against `IMAGE_MIME_TYPES`
  - Collect valid image files
  - Track rejected/inaccessible files
- Natural sort by filename
- Truncate to `MAX_IMPORT_IMAGES` (30)
- Insert Context block if missing
- For each image:
  - Insert H2 heading (filename without extension)
  - Insert "Source Image Link" with Drive URL
  - Insert image blob, scaled to content width
  - Insert page break
- Log observability events per-file and summary
- Return success/skip counts

### Functions and contracts

| Exposed to client? | Function name | Args | Return / errors |
|--------------------|---------------|------|------------------|
| Yes | `getDrivePickerConfig()` | (none) | `{ok: boolean, developerKey?: string, appId?: string, oauthToken?: string, parentFolderId?: string, message?: string}` |
| Yes | `showDrivePickerDialog()` | (none) | (void, shows loading dialog, auto-launches Picker) |
| No | `getDrivePickerHtml()` | (none) | string (HTML content for loading dialog) |
| Yes | `importFromDriveFileIds(fileIds)` | `string[]` | (void, modifies document, shows alert on completion) |
| Yes | `showImportError(errorMessage)` | `string` | (void, shows error alert after import failure) |

**Data flow:**

```
showDrivePickerDialog()
  ↓
[Loading dialog opens, calls getDrivePickerConfig()]
  ↓
[Picker API loads, Picker opens, loading dialog closes]
  ↓
User selects files in Picker
  ↓
importFromDriveFileIds(ids)
  ↓
Loop: DriveApp.getFileById(id) for each
  ↓
Filter, sort, insert images
  ↓
Alert with success/skip counts
```

### OAuth / manifest

**Scope changes:** Yes

**Previous scope:**
```json
"https://www.googleapis.com/auth/drive.readonly"
```

**New scope:**
```json
"https://www.googleapis.com/auth/drive.file"
```

**Scope description:**
- `drive.file`: "View and manage Google Drive files that you have opened or created with this app"
- **Only grants access to:**
  - Files explicitly selected via Picker
  - Files whose URLs/IDs the user manually provides
  - Files created by the app (not applicable to this add-on)
- **Does NOT grant access to:**
  - All user files (unlike `drive.readonly`)
  - Files in folders (no folder enumeration capability)

**Other scopes (unchanged):**
- `documents.currentonly` — Read/write active document
- `script.external_request` — Call Gemini API
- `script.container.ui` — Show dialogs/sidebar

### Configuration requirements

**Script properties (set by publisher/deployer):**
- `GOOGLE_PICKER_API_KEY`: API key from Google Cloud Console with Picker API enabled
- `GOOGLE_PICKER_APP_ID`: GCP project number (not project ID)

**Setup instructions:** See `docs/INSTALLATION.md` section "Setting up Google Picker API for Production"

## 5. Edge cases

| Scenario | Handling |
|----------|----------|
| **Picker API CDN down** | Loading dialog shows error for 3 seconds, then closes. User sees brief error message. |
| **Invalid API key** | `getDrivePickerConfig` returns error, loading dialog shows "Picker is not configured. Contact your administrator." (3 seconds) |
| **Missing App ID** | `getDrivePickerConfig` returns error, loading dialog shows "Picker is not configured. Contact your administrator." (3 seconds) |
| **Cannot detect parent folder** | Non-fatal: logged, Picker opens at Drive root with full navigation. User can browse to any folder. |
| **Document at Drive root (no parent)** | Picker opens at Drive root with full navigation available. |
| **Document in multiple parent folders** | Uses first parent found via `getParents().next()`. User can navigate to others if needed. |
| **User selects non-image files** | `DOCS_IMAGES` view pre-filters, but backend validates MIME type and skips |
| **User cancels Picker** | Picker closes silently (normal behavior, no error) |
| **No files selected** | Picker closes silently (normal behavior, no error) |
| **Selected file deleted before import** | `DriveApp.getFileById()` throws, caught per-file, counted in skip total |
| **Selected file access revoked** | `DriveApp.getFileById()` throws, caught per-file, counted in skip total |
| **Some files accessible, others not** | Partial success: import succeeds for accessible files, skips others, alert shows counts |
| **User selects 50 images** | First 30 imported (MAX_IMPORT_IMAGES limit), alert shows "Added 30, skipped 20 (limit reached)" |
| **Very large image file (>10MB)** | `getBlob()` may time out; caught per-file, counted in skip total |
| **Empty document** | Context block inserted before images (same as current behavior) |
| **Document already has Context block** | Preserved (ensureContextBlock checks for existing) |
| **User runs import multiple times** | Each run appends new images (no deduplication; user intent is to add more) |
| **Apps Script timeout (6 min limit)** | 30-image limit mitigates; if timeout occurs, partial import succeeds, user can re-run |

## 6. Acceptance criteria

Use as a verification checklist before merging to main.

### Functional

- [ ] Loading dialog opens from menu "Import Book from Drive Files" or sidebar button
- [ ] Loading dialog shows "Loading Google Picker..." message
- [ ] Picker opens automatically (no button click needed)
- [ ] Loading dialog auto-closes when Picker opens
- [ ] **Picker starts in document's parent folder** (when doc is in a folder, not at Drive root)
- [ ] User can navigate to other folders in Picker if needed
- [ ] Picker shows only image files (JPEG/PNG/WebP filter applied)
- [ ] Multi-select works, user can select 1-30 images
- [ ] Selected images import with Context block, H2 headings, source links, scaling, page breaks
- [ ] Natural sort order preserved (image_2.jpg before image_10.jpg)
- [ ] Import stops at MAX_IMPORT_IMAGES (30), alert shows truncation
- [ ] Non-image files skipped with count in alert
- [ ] Inaccessible files skipped with count in alert
- [ ] Picker cancellation closes silently (no error)
- [ ] Picker not configured shows error for 3 seconds then closes
- [ ] Error messages clear and actionable
- [ ] Observability events include `selectedFiles` count and per-file status

### OAuth and Configuration

- [ ] `appsscript.json` scope is `drive.file` (not `drive.readonly`)
- [ ] OAuth consent screen shows correct scope description
- [ ] `getDrivePickerConfig()` returns error if script properties not set
- [ ] Picker dialog handles missing config gracefully, manual fallback works
- [ ] Access to selected files succeeds with `drive.file` scope
- [ ] Access to non-selected files fails as expected (scope limitation)

### Documentation

- [ ] `SPEC-9-OAUTH-SCOPE-MIGRATION.md` exists and is comprehensive (this file)
- [ ] `docs/DESIGN.md` updated with new Drive import architecture section
- [ ] `docs/INSTALLATION.md` includes Picker API setup instructions
- [ ] `docs/USER_GUIDE.md` reflects new import flow (already updated in WIP)
- [ ] `README.md` reflects new import flow (already updated in WIP)
- [ ] `docs/PRIVACY_POLICY.md` includes data protection section (already updated in WIP)
- [ ] `docs/OAUTH_VERIFICATION_RESPONSE_TEMPLATES.md` includes email templates (already created in WIP)
- [ ] `project/SPEC-2-GDRIVE-to-GDOC.md` references SPEC-9 for scope change

### Code Quality

- [ ] No secrets or API keys hardcoded in source
- [ ] `google.script.run` calls use `.withSuccessHandler()` and `.withFailureHandler()`
- [ ] All errors caught and surfaced to user (no silent failures)
- [ ] Error classification includes new error types
- [ ] Observability events logged for all paths (success, error, partial)

### UX

- [ ] Picker flow is faster and more intuitive than folder URL paste
- [ ] Manual fallback is discoverable and clearly labeled
- [ ] Status messages provide clear feedback at each step
- [ ] Error states guide user to resolution (e.g., "use manual fallback")
- [ ] Import feedback detailed (success count, skip count, reasons)
- [ ] No regression in transcription workflow

## 7. Manual / Google-side steps

### Pre-deployment (one-time setup)

1. **Create/configure GCP project:**
   - Enable Google Picker API
   - Create API key, restrict to Picker API (recommended)
   - Note project number (App ID)

2. **Set script properties (production):**
   ```javascript
   // Run in Apps Script console for production deployment
   PropertiesService.getScriptProperties().setProperty('GOOGLE_PICKER_API_KEY', 'YOUR_API_KEY');
   PropertiesService.getScriptProperties().setProperty('GOOGLE_PICKER_APP_ID', 'YOUR_PROJECT_NUMBER');
   ```

3. **Deploy to production:**
   ```bash
   clasp push
   clasp version "Release v0.9.0 - OAuth scope migration"
   ```

### OAuth Verification Submission

1. **Update Cloud Console OAuth consent screen:**
   - Scopes: Remove `drive.readonly`, ensure `drive.file` present
   - Privacy Policy URL: Point to published privacy policy with data protection section
   - Support email: Current contact email
   - Application domain: Current domain

2. **Save and resubmit verification form**

3. **Reply to Google's email (use templates in `docs/OAUTH_VERIFICATION_RESPONSE_TEMPLATES.md`):**

   **Initial reply (same day as receiving feedback):**
   > Subject: Re: API OAuth Dev Verification - Confirming narrower scopes
   >
   > Confirming narrower scopes.
   >
   > We will migrate our Google Docs add-on to use the recommended Drive scope: `https://www.googleapis.com/auth/drive.file`
   >
   > We are updating both our Cloud Console configuration and application code to align with this narrower scope model (user-selected files only), and we are also updating our Privacy Policy to include explicit data protection disclosures.
   >
   > We will reply again with the updated Privacy Policy URL and confirmation once all changes are submitted.

   **Final reply (after deployment):**
   > Subject: Re: API OAuth Dev Verification - Confirming narrower scopes (Completed)
   >
   > Confirming narrower scopes.
   >
   > We have completed the requested updates:
   >
   > 1. Scope update: We updated our app to use `https://www.googleapis.com/auth/drive.file`. Our Drive import flow now works with user-selected files only.
   >
   > 2. Privacy Policy update: We added explicit data protection disclosures, including encryption in transit, per-user access controls, data minimization, and data retention/deletion behavior.
   >    Updated Privacy Policy URL: https://dekochka.github.io/geneascript-gdoc-addon/PRIVACY_POLICY
   >
   > 3. Cloud Console update: We saved and resubmitted the verification details in Cloud Console with the updated scope and policy link.
   >
   > Please continue processing our verification request.

4. **Monitor verification status:**
   - Cloud Console → APIs & Services → OAuth consent screen
   - Respond promptly to any follow-up questions

5. **Post-approval:**
   - Update `CHANGELOG.md` with OAuth migration notes
   - Announce to users (if applicable)
   - Monitor for any issues in production

### Developer setup (local testing)

Each developer working on this feature needs:
1. Own GCP project with Picker API enabled
2. Own API key
3. Set script properties in their local test deployment:
   ```javascript
   PropertiesService.getScriptProperties().setProperty('GOOGLE_PICKER_API_KEY', 'DEVELOPER_KEY');
   PropertiesService.getScriptProperties().setProperty('GOOGLE_PICKER_APP_ID', 'DEVELOPER_PROJECT_NUMBER');
   ```
4. `clasp push` to their test script
5. Test in Google Docs

---

## Implementation notes

**Status:** Implementation ~70% complete on branch `google-scopes-review-followups`

**Completed:**
- OAuth scope changed
- Core import refactored
- Picker UI implemented
- Manual fallback implemented
- Privacy Policy updated
- README/USER_GUIDE updated
- OAuth response templates created

**Remaining:**
- This spec document (being created now)
- `docs/DESIGN.md` update
- `docs/INSTALLATION.md` Picker setup section
- Code review and UX polish
- Edge case handling verification
- End-to-end testing
- `SPEC-2` reference update

**Testing strategy:**
Manual testing only (no automated UI tests). Follow test scenarios in plan verification section. Key scenarios:
- Picker happy path (5 images)
- Picker edge cases (cancel, non-images, 35 images)
- Manual fallback (single URL, multiple IDs, invalid input)
- Configuration errors (no API key, no App ID)
- OAuth scope validation (fresh account consent screen)

**Risks:**
- **Configuration complexity**: Mitigated by clear documentation + manual fallback
- **UX regression**: Mitigated by UX polish phase, Picker provides better experience than URL paste
- **Testing burden**: Manual only, but comprehensive test plan covers all paths
