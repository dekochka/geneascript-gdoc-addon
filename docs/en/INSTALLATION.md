---
layout: default
lang: en
locale_section: true
title: Installation — GeneaScript Transcriber
permalink: /en/INSTALLATION.html
redirect_from:
  - /INSTALLATION.html
---

# ⚙️ Installation — GeneaScript Transcriber

This add-on runs in Google Docs™ and uses the **Google™ AI (Gemini™)** API to transcribe metric book images.

## ✅ Prerequisites

- **📧** A **Google Account™** (personal or **Google Workspace™**).
- **📄** A **Google Docs™** document where you want to transcribe metric book images.
- **🔑** A **Google™ AI (Gemini™) API key**. Get one at [Google AI Studio™](https://aistudio.google.com/api-keys). You can skip this step — the add-on will prompt you with instructions and a link on first use.

---

## 🏪 Install from Google Workspace™ Marketplace

```mermaid
flowchart LR
  A["🏪 Open Marketplace listing"] --> B[📥 Install]
  B --> C[📄 Open any Google Docs™ document]
  C --> D["🔑 Set API key<br/>(prompted on first Transcribe)"]
  D --> E([✅ Ready])
```

1. **🏪** Open the [GeneaScript Transcriber listing on the Google Workspace™ Marketplace](https://workspace.google.com/marketplace/app/geneascript_metric_book_transcriber/440886676248).
2. **📥** Click **Install** and grant the requested permissions.
3. **📄** Open any **Google Docs™** document. You should see the menu **Extensions** → **GeneaScript** with **Open Sidebar**, **Transcribe Image**, **Import Book from Drive Files**, **Extract Context from Cover Image**, **Setup AI**, and more. You can also click the add-on icon in the right-side panel to open the sidebar.
4. **🔑** The first time you run **Transcribe Image**, the add-on prompts you to enter a [Google™ AI (Gemini™) API key](https://aistudio.google.com/api-keys) and choose a model (default: Gemini™ Flash Latest, free tier ~20 requests/day). Get a key, paste it, pick a model, and click **Save & Continue**. Your key and model are stored privately (per user). To change them later, use **Extensions** → **GeneaScript** → **Setup AI**. In the same dialog you can set **Interface language** (English, Ukrainian, Russian, or Auto to follow your **Google Account™**). See [Gemini™ API pricing](https://ai.google.dev/gemini-api/docs/pricing) for model and token cost details.

That's it — you can now import images from Drive and transcribe them. See the [User Guide](USER_GUIDE.html) for step-by-step usage.

---

## 🔑 API key and model

- The API key and selected model are stored in **User Properties** (private to each **Google Account™**), not in the code. Each user's key and model choice are isolated.
- On first use of **Transcribe Image**, if no key is set, the add-on shows a dialog with a link to [Google AI Studio™ — API keys](https://aistudio.google.com/api-keys), a **model** dropdown (default: Gemini™ Flash Latest; options include Gemini™ 3.1 Flash Lite and Gemini™ 3.1 Pro Preview), and an API key field. After entering the key and clicking **Save & Continue**, both are saved and the transcription proceeds.
- To **update key or model** anytime: **Extensions** → **GeneaScript** → **Setup AI**. Leave the API key blank to keep the current key; change the model and click **Save**. Use **Clear stored API key** in that dialog to remove the key (you will be prompted again on next Transcribe).
- The same setup dialog also supports request tuning: **Transcription strictness** (default `0.1`), **Max text length**, **Reasoning depth**, and (when supported) **Reasoning effort limit**. Invalid combinations are blocked in the UI and revalidated server-side.
- Pricing and billing details: see [Gemini™ API pricing](https://ai.google.dev/gemini-api/docs/pricing).

---

## 🔧 Troubleshooting

| Issue | What to do |
|-------|------------|
| **Menu doesn't appear** | Reload the document. Try uninstalling and reinstalling the add-on from the Marketplace. |
| **"Please set your Google AI API key" / no key** | Run **Transcribe Image** — the add-on will prompt you to enter a key and choose a model, with a link to [Google AI Studio™ — API keys](https://aistudio.google.com/api-keys). Or use **Setup AI** to set or change key and model. |
| **Setup dialog shows validation error** | Check request settings in **Setup AI**. **Transcription strictness** must be between `0` and `2`; **Max text length** must be an integer between `1` and `65536`; reasoning options depend on the selected model. |
| **"Authorisation is required to perform that action"** | You may be a collaborator on the doc (not the person who added the add-on). Install the add-on for your account: **Extensions** → **GeneaScript** and complete the authorization when prompted. Or remove and re-add the add-on to re-authorize. |
| **Quota exceeded / 429** | Free tier has limited requests per day (e.g. ~20 for Gemini™ Flash Latest). The add-on shows the API error in the dialog. Check [Gemini™ API pricing](https://ai.google.dev/gemini-api/docs/pricing) and your quota/billing setup; consider switching model via **Setup AI**. |
| **Cannot access selected files** (Import from Drive) | Ensure each file is shared with you or owned by you. Re-authorize the add-on if you changed permissions. |
| **API errors / 403** | Confirm the API key is valid and the Generative Language API is enabled. Check [Google AI Studio™ — API keys](https://aistudio.google.com/api-keys). |
| **Timeout** | The script uses a 60-second timeout. Try a smaller image or try again. |

For usage (document structure, Context section, step-by-step with screenshots), see [USER_GUIDE.html](USER_GUIDE.html).
