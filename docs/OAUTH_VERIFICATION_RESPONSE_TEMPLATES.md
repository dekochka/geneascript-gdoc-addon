# Google OAuth Verification Response Templates

Use these templates when replying to Google OAuth verification for the `drive.file` migration.

## 1) Immediate reply (same day)

Subject: Re: API OAuth Dev Verification - Confirming narrower scopes

Hello Google OAuth Verification Team,

Confirming narrower scopes.

We will migrate our Google Docs add-on to use the recommended Drive scope:
- `https://www.googleapis.com/auth/drive.file`

We are updating both our Cloud Console configuration and application code to align with this narrower scope model (user-selected files only), and we are also updating our Privacy Policy to include explicit data protection disclosures.

We will reply again with the updated Privacy Policy URL and confirmation once all changes are submitted.

Thank you.

## 2) Final confirmation reply (after updates are live)

Subject: Re: API OAuth Dev Verification - Confirming narrower scopes (Completed)

Hello Google OAuth Verification Team,

Confirming narrower scopes.

We have completed the requested updates:

1. Scope update
- We updated our app to use:
  - `https://www.googleapis.com/auth/drive.file`
- Our Drive import flow now works with user-selected files only.

2. Privacy Policy update
- We added explicit data protection disclosures, including encryption in transit, per-user access controls, data minimization, and data retention/deletion behavior.
- Updated Privacy Policy URL:
  - `<PASTE_PRIVACY_POLICY_URL_HERE>`

3. Cloud Console update
- We saved and resubmitted the verification details in Cloud Console with the updated scope and policy link.

Please continue processing our verification request.

Thank you.

## 3) Cloud Console submission checklist

- OAuth consent screen includes the current production app details.
- Scopes reflect the current implementation, including `drive.file`.
- Privacy Policy field points to the updated published policy URL.
- Support email and app domain values are current.
- Verification form has been saved and resubmitted after edits.
