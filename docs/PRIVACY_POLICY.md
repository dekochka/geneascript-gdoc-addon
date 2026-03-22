---
layout: default
---
# Privacy Policy — Metric Book Transcriber

**Last updated:** 2026-03-14

Metric Book Transcriber ("the Add-on") is an open-source Google Docs™ Editor add-on that helps users transcribe images of metric books (birth, marriage, and death registers) using the Google™ AI (Gemini™) API.

## Data the Add-on Accesses

| Data | Why | Where it goes |
|------|-----|---------------|
| **Google AI (Gemini) API key** | Required to call the Gemini API on the user's behalf. | Stored in Google Apps Script **User Properties** (private per Google account). Never sent anywhere other than Google's Generative Language API endpoint. |
| **Document content (Context section)** | The text under the "Context" heading in the active Google Doc is read to build the transcription prompt. | Sent to the Google AI (Gemini) API as part of the prompt. Not stored elsewhere. |
| **Selected image** | The image the user selects for transcription is read from the document. | Sent (base64-encoded) to the Google AI (Gemini) API. Not stored elsewhere. |
| **Google Drive™ folder contents (file names and images)** | When using "Import Book from Drive Folder," the add-on reads image files from the specified folder. | Images are inserted into the user's Google Doc. File metadata and blobs are processed in memory only. |

## Data Storage

- The **API key** is stored in Google Apps Script **User Properties**, which are private to each Google account. Other users of the same add-on cannot access another user's key.
- The add-on does **not** maintain any external database, server, or persistent storage outside of Google Apps Script User Properties.
- The add-on does **not** store document content, images, or transcription results outside the user's own Google Doc.

## Third-Party Services

The add-on sends data to a single third-party service:

- **Google AI (Gemini) API** (`generativelanguage.googleapis.com`) — to perform image transcription. The data sent consists of the document Context text and the selected image. Google's own privacy terms govern how Google processes this data. See [Google's AI Privacy Policy](https://ai.google.dev/terms).

The add-on does **not** send data to any other third-party service.

## Analytics and Tracking

The add-on does **not** collect analytics, telemetry, usage metrics, or tracking data of any kind.

## Cookies

The add-on does **not** use cookies.

## Data Sharing

The add-on does **not** share, sell, or transfer user data to any third party except as described above (Google AI API calls initiated by the user).

## User Control

- Users can delete their stored API key at any time by running `PropertiesService.getUserProperties().deleteProperty('GEMINI_API_KEY')` in the Apps Script editor console, or by entering a new key through the add-on's "Set API Key" dialog.
- Users can uninstall the add-on at any time, which removes all User Properties associated with it.
- The add-on only processes data when the user explicitly triggers an action (Transcribe Image, batch transcription via the Sidebar, or Import Book from Drive Folder). It never runs in the background.

## Children's Privacy

The add-on is not directed at children under the age of 13 and does not knowingly collect personal information from children.

## Changes to This Policy

If this policy changes, the updated version will be posted in this repository with a new "Last updated" date.

## Contact

For questions about this privacy policy, open an issue at [github.com/dekochka/geneascript-gdoc-addon/issues](https://github.com/dekochka/geneascript-gdoc-addon/issues).
