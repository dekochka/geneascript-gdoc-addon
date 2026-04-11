---
layout: default
lang: en
locale_section: true
title: Privacy Policy — GeneaScript
permalink: /en/PRIVACY_POLICY.html
redirect_from:
  - /PRIVACY_POLICY.html
---

# Privacy Policy — GeneaScript Metric Book Transcriber

**Last updated:** 2026-04-04

GeneaScript Metric Book Transcriber ("the Add-on") is an open-source Google Docs™ Editor add-on that helps users transcribe images of metric books (birth, marriage, and death registers) using the Google™ AI (Gemini™) API.

## Data the Add-on Accesses

| Data | Why | Where it goes |
|------|-----|---------------|
| **Google™ AI (Gemini™) API key** | Required to call the Gemini™ API on the user's behalf. | Stored in Google Apps Script **User Properties** (private per Google account). Never sent anywhere other than Google's Generative Language API endpoint. |
| **Interface language preference (optional)** | Lets the user pin the add-on UI to English, Ukrainian, or Russian instead of following the Google account locale. | Stored in Google Apps Script **User Properties** (`UI_LOCALE`). Used only to choose UI strings; not sent to third parties. |
| **Document content (Context section)** | The text under the "Context" heading in the active Google Doc is read to build the transcription prompt. | Sent to the Google™ AI (Gemini™) API as part of the prompt. Not stored elsewhere. |
| **Selected image** | The image the user selects for transcription is read from the document. | Sent (base64-encoded) to the Google™ AI (Gemini™) API. Not stored elsewhere. |
| **Google Drive™ selected files (file names and images)** | When using "Import Book from Drive Files," the add-on reads only the image files the user explicitly selects via the Google Picker UI. The add-on uses the `drive.file` OAuth scope (non-sensitive), which grants access **only to files the user explicitly selects**—not to all Drive files. | Images are inserted into the user's Google Doc. File metadata and blobs are processed in memory only. No files are stored or cached. |

## Data Storage

- The **API key** is stored in Google Apps Script **User Properties**, which are private to each Google account. Other users of the same add-on cannot access another user's key.
- The add-on does **not** maintain any external database, server, or persistent storage outside of Google Apps Script User Properties.
- The add-on does **not** store document content, images, or transcription results outside the user's own Google Doc.

## Data Protection

- **Encryption in transit:** Data sent to Google APIs is transmitted over HTTPS/TLS.
- **Encryption at rest:** Data kept in Google systems (for example, Apps Script User Properties and Google Docs/Drive content) is protected by Google's platform security controls.
- **Access controls:** The add-on stores API keys in per-user Apps Script User Properties and runs under the active user's Google authorization context. The add-on does not provide a shared admin console or cross-user data access path.
- **Data minimization:** The add-on only processes data needed for user-requested actions (selected image, document context text, and selected Drive image files for import).
- **No external persistence:** The add-on does not copy user content into external databases or third-party storage controlled by the developer.
- **Deletion and retention:** Users can overwrite or remove their stored API key at any time. Document content and imported images remain under the user's Google Docs/Drive controls.

## Third-Party Services

The add-on sends data to a single third-party service:

- **Google™ AI (Gemini™) API** (`generativelanguage.googleapis.com`) — to perform image transcription. The data sent consists of the document Context text and the selected image. Google's own privacy terms govern how Google processes this data. See [Google's AI Privacy Policy](https://ai.google.dev/terms).

The add-on does **not** send data to any other third-party service.

## Gemini Data Usage

- The add-on sends only the minimum data needed for transcription (context text and selected image) and does not use that data to train any model itself.
- How data submitted through the Gemini™ API is handled by Google (including whether it may be used for model improvement) depends on your Gemini product tier and the terms that apply to your account/project.
- Review the applicable Google terms for your setup before use:
  - [Google AI for Developers terms](https://ai.google.dev/terms)
  - [Google Cloud terms](https://cloud.google.com/terms)

## Operational Telemetry

The add-on logs lightweight operational telemetry to **Google Cloud Logging** (part of the developer's Google Cloud project) for error diagnosis and quality monitoring. These logs include:

- **Event type** (e.g. transcription started, import completed, error occurred)
- **Timing and latency** (e.g. how long a transcription took)
- **Token usage and estimated cost** for Gemini API calls
- **Error codes and sanitized error messages** (truncated to 300 characters, no user content)
- **Anonymized user identifier** — a SHA-256 hash of a temporary session key; this cannot be reversed to identify a specific user

Telemetry logs do **not** contain document text, image data, file names, API keys, or any personally identifiable information. Logs are retained according to the developer's Google Cloud Logging retention settings.

The add-on does **not** use cookies, browser analytics, or any third-party tracking service.

## Data Sharing

The add-on does **not** share, sell, or transfer user data to any third party except as described above (Google AI API calls initiated by the user).

## User Control

- Users can delete their stored API key at any time by running `PropertiesService.getUserProperties().deleteProperty('GEMINI_API_KEY')` in the Apps Script editor console, or by entering a new key through the add-on's "Set API Key" dialog.
- Users can uninstall the add-on at any time, which removes all User Properties associated with it.
- The add-on only processes data when the user explicitly triggers an action (Transcribe Image, batch transcription via the Sidebar, or Import Book from Drive Files). It never runs in the background.

## Children's Privacy

The add-on is not directed at children under the age of 13 and does not knowingly collect personal information from children.

## Changes to This Policy

If this policy changes, the updated version will be posted in this repository with a new "Last updated" date.

## Contact

For questions about this privacy policy, open an issue at [github.com/dekochka/geneascript-gdoc-addon/issues](https://github.com/dekochka/geneascript-gdoc-addon/issues).
For privacy or security concerns, contact **geneascript.support@gmail.com**.

Google, Google Docs, Google Drive, Google AI, Google Cloud, Google Apps Script, and Gemini are trademarks of Google LLC.
