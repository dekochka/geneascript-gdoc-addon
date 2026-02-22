# Add-on logo

Use your GeneaScript logo here and in the manifest.

## Size

Your image `GeneaScript_logo_med.png` (1000×1000 px) is **suitable** for the add-on logo. Google displays the toolbar icon small and will scale it. For a crisper look in the Extensions menu, you can optionally use a 48×48 or 128×128 px version.

## Using it in the manifest

The `logoUrl` in `appsscript.json` must be a **public HTTPS URL**. A local path or file:// URL will not work.

1. **Host the image** somewhere public, for example:
   - **GitHub**: Add this image to the repo (e.g. in `addon/img/GeneaScript_logo_med.png`), push, then use the raw URL:  
     `https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/BRANCH/addon/img/GeneaScript_logo_med.png`
   - **Google Cloud Storage**: Upload to a bucket with public read access and use the object URL.
   - Any static host or CDN that serves the image over HTTPS.

2. **Set the URL** in `appsscript.json`:
   - Open `addon/appsscript.json`.
   - Under `addOns.common`, set `logoUrl` to your public image URL (replace the current placeholder).

Example:

```json
"addOns": {
  "common": {
    "name": "Metric Book Transcriber",
    "logoUrl": "https://your-host.com/path/to/GeneaScript_logo_med.png"
  },
  "docs": {}
}
```

Copy `GeneaScript_logo_med.png` from your other project (`genea_gcloud_gemini_transcriber/img/`) into this folder if you want to keep the asset in this repo and use a GitHub raw URL.
