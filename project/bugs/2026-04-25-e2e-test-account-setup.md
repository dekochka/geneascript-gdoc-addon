# E2E Test Account Setup — 2026-04-25

## Problem

The primary support Gmail address must retain strict security (passkeys required, passwordless). Playwright cannot complete passkey challenges because they require a physical device (Touch ID / phone push / hardware key), so every E2E run is blocked by Google's "Use your passkey to confirm it's really you" dialog when running against that account.

## Resolution

Use a dedicated test Gmail account for automation. The address lives outside this repo (see local dev notes). It is used only by the Playwright suite and is never exposed externally.

### Requirements for the test account

- **Distinct Gmail** not used for any public-facing communication
- **Password sign-in enabled** (no passkey-only)
- **2-Step Verification off** — or SMS-based 2FA (so Playwright can bypass passkey)
- **"Skip password when possible" toggled off** under https://myaccount.google.com/signinoptions/passkeys
- **Added as an editor** on the demo document
- **Granted access to the GeneaScript Apps Script test deployment**
- **Gemini API key configured** in the add-on via Setup AI (so transcription tests can run)

### After account exists — add to E2E harness

1. `rm -rf /tmp/pw-geneascript-auth`
2. Run `npx tsx e2e/save-auth.ts` and sign in with **password** (skip passkey)
3. Grant the add-on OAuth consent
4. Once the test doc + sidebar load, press Enter to persist
