# E2E Test Account Setup — 2026-04-25

## Problem

`geneascript.support@gmail.com` is the public support address and must retain strict security (passkeys required, passwordless). Playwright cannot complete passkey challenges because they require a physical device (Touch ID / phone push / hardware key), so every E2E run is blocked by Google's "Use your passkey to confirm it's really you" dialog.

## Resolution

Create a dedicated test account for automation. It will be used only by the Playwright suite and never exposed externally.

### Requirements for the new account

- **Distinct Gmail** (e.g. `geneascript.test@gmail.com` or similar)
- **Password sign-in enabled** (no passkey-only)
- **2-Step Verification off** — or SMS-based 2FA (so Playwright can bypass passkey)
- **"Skip password when possible" toggled off** under https://myaccount.google.com/signinoptions/passkeys
- **Added as an editor** on the GeneaScript Demo document
- **Granted access to the GeneaScript Apps Script test deployment**
- **Gemini API key configured** in the add-on via Setup AI (so transcription tests can run)

### After account exists — add to E2E harness

1. `rm -rf /tmp/pw-geneascript-auth`
2. Update `e2e/save-auth.ts` doc instructions with the new account address
3. Run `npx tsx e2e/save-auth.ts` and sign in with **password** (skip passkey)
4. Grant the add-on OAuth consent
5. Once the test doc + sidebar load, press Enter to persist

Owner: @dkochkin
