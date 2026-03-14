/**
 * GDoc Metric Book Transcriber Add-On
 * Adds menu and runs "Transcribe Image" to send selected image + context to Gemini and insert result.
 */

var MODEL_ID = 'gemini-flash-latest';
var API_KEY_PROPERTY = 'GEMINI_API_KEY';
var MODEL_ID_PROPERTY = 'GEMINI_MODEL_ID';
var CONTEXT_HEADING = 'Context';
var MAX_CONTEXT_PARAGRAPHS = 50;
var MAX_IMPORT_IMAGES = 30;
var IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Runs when the add-on is installed (e.g. via Test deployment). Creates the menu in FULL auth mode.
 */
function onInstall(e) {
  onOpen(e);
}

/**
 * Runs when the document is opened. Adds a custom menu.
 * Uses createMenu() for a top-level menu (Metric Book Transcriber) next to Help for reliable visibility.
 * When run from the script editor (no document UI), getUi() throws; we catch and skip.
 */
function onOpen(e) {
  try {
    DocumentApp.getUi()
      .createMenu('Metric Book Transcriber')
      .addItem('Transcribe Image', 'transcribeSelectedImage')
      .addItem('Import Book from Drive Folder', 'importFromDriveFolder')
      .addSeparator()
      .addItem('Setup API key & model', 'showSetupApiKeyAndModelDialog')
      .addItem('Help / User Guide', 'showHelp')
      .addItem('Report an issue', 'reportIssue')
      .addToUi();
    Logger.log('onOpen: menu added.');
  } catch (e) {
    Logger.log('onOpen: skipped menu (no UI context, e.g. run from script editor). ' + e.message);
  }
}

/**
 * Extracts Google Drive folder ID from a full URL or raw ID. Returns null if invalid.
 * Handles URLs like https://drive.google.com/drive/folders/ID or ?id=ID.
 */
function extractFolderId(urlOrId) {
  if (!urlOrId || typeof urlOrId !== 'string') return null;
  var input = urlOrId.trim();
  if (input.length === 0) return null;
  var idPattern = /[-\w]{25,}/;
  var match = input.match(idPattern);
  return match ? match[0] : null;
}

/**
 * Natural sort: splits filenames into digit/non-digit segments and compares numerically for digit parts.
 * Ensures image_2.jpg comes before image_10.jpg.
 */
function naturalSortFiles(filesArray) {
  function tokenize(name) {
    var tokens = [];
    var segment = '';
    var i = 0;
    while (i < name.length) {
      if (/\d/.test(name[i])) {
        if (segment.length) {
          tokens.push(segment);
          segment = '';
        }
        var num = '';
        while (i < name.length && /\d/.test(name[i])) {
          num += name[i];
          i++;
        }
        tokens.push(parseInt(num, 10));
      } else {
        segment += name[i];
        i++;
      }
    }
    if (segment.length) tokens.push(segment);
    return tokens;
  }
  function compareTokens(a, b) {
    var len = Math.min(a.length, b.length);
    for (var k = 0; k < len; k++) {
      var ta = a[k];
      var tb = b[k];
      if (typeof ta === 'number' && typeof tb === 'number') {
        if (ta !== tb) return ta - tb;
      } else {
        var sa = String(ta);
        var sb = String(tb);
        if (sa !== sb) return sa < sb ? -1 : 1;
      }
    }
    return a.length - b.length;
  }
  return filesArray.slice().sort(function (f1, f2) {
    return compareTokens(tokenize(f1.getName()), tokenize(f2.getName()));
  });
}

/**
 * Ensures the Context block exists at the top of the document. If not present, inserts
 * Heading 1 "Context", the full context template (from ContextTemplate.gs) with bold labels,
 * and a page break.
 */
function ensureContextBlock(doc) {
  var body = doc.getBody();
  var numChildren = body.getNumChildren();
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH &&
        child.asParagraph().getText().trim() === CONTEXT_HEADING) {
      return;
    }
  }
  body.insertParagraph(0, CONTEXT_HEADING).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  var templateText = getContextTemplateText();
  insertFormattedText(body, 1, templateText);
  var numLines = templateText.split('\n').length;
  body.insertPageBreak(2 + numLines);
}

/**
 * Returns the file name without extension (e.g. "631-12-33_0003" from "631-12-33_0003.jpg").
 */
function getFileNameWithoutExtension(file) {
  var name = file.getName();
  var lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.substring(0, lastDot) : name;
}

/**
 * Appends a paragraph with the image name (no extension), then "Source Image Link" (bold): [file name as link].
 */
function appendImageNameAndSourceLink(body, file) {
  var paragraphName = getFileNameWithoutExtension(file);
  var namePara = body.appendParagraph(paragraphName);
  namePara.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  var label = 'Source Image Link';
  var prefix = label + ': ';
  var fileName = file.getName();
  var url = file.getUrl();
  var fullText = prefix + fileName;
  var para = body.appendParagraph(fullText);
  var textObj = para.editAsText();
  textObj.setBold(0, label.length - 1, true);
  textObj.setLinkUrl(prefix.length, fullText.length - 1, url || '');
}

/**
 * Imports metric book images from a Google Drive folder: prompts for folder URL/ID,
 * fetches images (jpeg, png, webp), natural-sorts them, injects Context block if needed,
 * then appends up to MAX_IMPORT_IMAGES images scaled to content width with page breaks.
 */
function importFromDriveFolder() {
  Logger.log('importFromDriveFolder: start');
  var ui = DocumentApp.getUi();
  var doc = DocumentApp.getActiveDocument();
  var response = ui.prompt('Drive Folder', 'Enter the Google Drive Folder ID or URL containing the metric book scans.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) {
    Logger.log('importFromDriveFolder: user cancelled prompt');
    return;
  }
  var rawInput = response.getResponseText();
  var folderId = extractFolderId(rawInput);
  Logger.log('importFromDriveFolder: rawInput length=' + (rawInput ? rawInput.length : 0) + ' extracted folderId=' + (folderId || 'null'));
  if (!folderId) {
    Logger.log('importFromDriveFolder: invalid link, no folderId extracted');
    ui.alert('Invalid link', 'Invalid Drive Folder link. Please check the URL.', ui.ButtonSet.OK);
    return;
  }
  var folder;
  try {
    Logger.log('importFromDriveFolder: calling DriveApp.getFolderById(' + folderId + ')');
    folder = DriveApp.getFolderById(folderId);
    Logger.log('importFromDriveFolder: folder resolved name="' + folder.getName() + '"');
  } catch (e) {
    Logger.log('importFromDriveFolder: DriveApp.getFolderById failed for id=' + folderId + ' error=' + (e.message || String(e)));
    var errMsg = e.message || String(e);
    if (errMsg.indexOf('not enabled') !== -1 || errMsg.indexOf('Access Not Configured') !== -1) {
      ui.alert('Drive API not enabled', 'The Google Drive API is not enabled in your GCP project. Please enable it at console.cloud.google.com → APIs & Services → Library → Google Drive API.', ui.ButtonSet.OK);
    } else {
      ui.alert('Access denied', 'Cannot access folder (id: ' + folderId + '). ' + errMsg, ui.ButtonSet.OK);
    }
    return;
  }
  var imageFiles = [];
  var fileIterator = folder.getFiles();
  var totalFiles = 0;
  while (fileIterator.hasNext()) {
    var file = fileIterator.next();
    totalFiles++;
    var mime = file.getMimeType();
    if (IMAGE_MIME_TYPES.indexOf(mime) !== -1) imageFiles.push(file);
  }
  Logger.log('importFromDriveFolder: listed folder totalFiles=' + totalFiles + ' imageFiles=' + imageFiles.length);
  if (imageFiles.length === 0) {
    Logger.log('importFromDriveFolder: no images in folder, aborting');
    ui.alert('No images', 'No images found in this folder.', ui.ButtonSet.OK);
    return;
  }
  imageFiles = naturalSortFiles(imageFiles);
  var truncated = false;
  if (imageFiles.length > MAX_IMPORT_IMAGES) {
    imageFiles = imageFiles.slice(0, MAX_IMPORT_IMAGES);
    truncated = true;
  }
  var count = imageFiles.length;
  Logger.log('importFromDriveFolder: after sort count=' + count + ' truncated=' + truncated + ' MAX_IMPORT_IMAGES=' + MAX_IMPORT_IMAGES);
  ui.alert('Importing', 'Ready to import ' + count + ' image(s). Click OK to start — this may take a minute.', ui.ButtonSet.OK);
  ensureContextBlock(doc);
  var body = doc.getBody();
  var contentWidthPt = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  var skipped = 0;
  for (var i = 0; i < imageFiles.length; i++) {
    Logger.log('importFromDriveFolder: inserting image ' + (i + 1) + '/' + count);
    var file = imageFiles[i];
    try {
      var blob = file.getBlob();
      // #region agent log
      (function () {
        var bytes = blob.getBytes().length;
        Logger.log('importFromDriveFolder: H1/H3 blobSize index=' + (i + 1) + ' fileName=' + file.getName() + ' blobSizeBytes=' + bytes + ' blobSizeMB=' + (bytes / 1e6).toFixed(2));
      })();
      // #endregion
      appendImageNameAndSourceLink(body, file);
      var inlineImage = body.appendImage(blob);
      var w = inlineImage.getWidth();
      var h = inlineImage.getHeight();
      if (w > contentWidthPt) {
        var newW = contentWidthPt;
        var newH = h * (contentWidthPt / w);
        inlineImage.setWidth(newW);
        inlineImage.setHeight(newH);
      }
      body.appendPageBreak();
    } catch (e) {
      skipped++;
      // #region agent log
      (function () {
        var blobForLog = file.getBlob();
        var bytes = blobForLog.getBytes().length;
        Logger.log('importFromDriveFolder: FAILED H1/H3 index=' + (i + 1) + ' fileName=' + file.getName() + ' blobSizeBytes=' + bytes + ' blobSizeMB=' + (bytes / 1e6).toFixed(2) + ' error=' + (e.message || String(e)));
      })();
      // #endregion
      Logger.log('importFromDriveFolder: skipped image ' + (i + 1) + ' "' + file.getName() + '": ' + (e.message || String(e)));
    }
  }
  var added = count - skipped;
  Logger.log('importFromDriveFolder: done added=' + added + ' skipped=' + skipped + ' count=' + count);
  var doneMsg = 'Import complete. ' + added + ' image(s) added.';
  if (skipped > 0) {
    doneMsg += ' ' + skipped + ' skipped (invalid or too large for Docs).';
  }
  doneMsg += '\n\nNext steps: edit the Context section at the top of the document to match your source (archive, dates, villages, surnames), then select an image and run Transcribe Image.';
  ui.alert('Done', doneMsg, ui.ButtonSet.OK);
}

/**
 * Main action: transcribe the selected metric book image using Gemini and insert result below it.
 * If the API key is not set, shows a dialog for the user to enter it first.
 */
function transcribeSelectedImage() {
  Logger.log('transcribeSelectedImage: start');
  var apiKey = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') {
    Logger.log('transcribeSelectedImage: missing API key, showing setup dialog');
    showApiKeyDialog();
    return;
  }
  Logger.log('transcribeSelectedImage: API key present');
  doTranscribeFlow();
}

/**
 * Shows a modal dialog for the user to enter their Google AI (Gemini) API key.
 * On save, persists the key and continues the transcribe flow within the same dialog
 * (morphs into the "awaiting" state and calls runTranscribeWorker directly).
 */
/** Model options for the dropdown (id = API model id). */
function getModelOptions() {
  return [
    { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (default, free tier ~20/day)' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (lower quality, 500 requests/day)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (best quality, billing)' }
  ];
}

/**
 * Opens the API key & model dialog. When forUpdate is true (Setup from menu), key is optional and Save just closes.
 * When forUpdate is false (key missing), key is required and Save & Continue starts transcription.
 */
function showApiKeyDialog(forUpdate) {
  var ui = DocumentApp.getUi();
  var currentModel = getStoredModel();
  var options = getModelOptions();
  var optionsHtml = options.map(function(o) {
    var sel = (o.id === currentModel) ? ' selected' : '';
    return '<option value="' + o.id + '"' + sel + '>' + o.label + '</option>';
  }).join('');
  var introHtml = forUpdate
    ? '<p style="margin:0 0 8px;">Update your <b>API key</b> and/or <b>model</b>. Leave API key blank to keep the current key.</p>'
    : '<p style="margin:0 0 8px;">To transcribe images, this add-on needs a <b>Google AI (Gemini) API key</b>.</p>' +
      '<p style="margin:0 0 8px;">Get a free key at ' +
      '<a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a> ' +
      '(sign in, then click <b>Create API key</b>).</p>';
  var btnLabel = forUpdate ? 'Save' : 'Save &amp; Continue';
  var dialogTitle = forUpdate ? 'Setup API key & model' : 'Set API Key';
  var html = '<!DOCTYPE html><html><head><base target="_top"></head>' +
    '<body style="font-family: Arial, sans-serif; padding: 16px;">' +
    introHtml +
    '<p style="margin:0 0 8px; font-size:12px; color:#555;">' +
    'See <a href="https://aistudio.google.com/rate-limit" target="_blank">Rate limits</a> for free tier and billing.</p>' +
    '<label style="display:block; margin-bottom:4px; font-weight:bold;">Model:</label>' +
    '<select id="model" style="width:100%; padding:6px; box-sizing:border-box; font-size:13px; margin-bottom:12px;">' + optionsHtml + '</select>' +
    '<label style="display:block; margin-bottom:4px; font-weight:bold;">API Key:</label>' +
    '<input id="apiKey" type="text" style="width:100%; padding:6px; box-sizing:border-box; font-size:13px;" placeholder="' + (forUpdate ? 'Leave blank to keep current key' : 'Paste your API key here') + '" />' +
    '<div id="status" style="color:#C62828; margin-top:6px; font-size:12px;"></div>' +
    (forUpdate ? '<p style="margin:12px 0 0; font-size:12px;"><a href="#" onclick="if(confirm(\'Clear stored API key? You will be asked for it again on next Transcribe.\')){ google.script.run.withSuccessHandler(function(){ google.script.host.close(); }).clearApiKey(); } return false;">Clear stored API key</a></p>' : '') +
    '<div style="text-align:right; margin-top:12px;">' +
    '<button id="saveBtn" onclick="save()" style="padding:8px 16px; font-size:13px; cursor:pointer;">' + btnLabel + '</button></div>' +
    '<script>' +
    'var forUpdate=' + (forUpdate ? 'true' : 'false') + ';' +
    'function save(){' +
      'var key=document.getElementById("apiKey").value;' +
      'var modelId=document.getElementById("model").value;' +
      'if(!forUpdate&&(!key||!key.trim())){document.getElementById("status").innerText="Please enter an API key.";return;}' +
      'document.getElementById("status").innerText="Saving\\u2026";' +
      'document.getElementById("saveBtn").disabled=true;' +
      'google.script.run' +
        '.withSuccessHandler(function(r){' +
          'if(r&&r.ok){ if(forUpdate){ document.getElementById("status").innerText="Saved."; document.getElementById("status").style.color="green"; setTimeout(function(){ google.script.host.close(); }, 800); } else { startTranscription(); } }' +
          'else{ document.getElementById("status").innerText=(r&&r.message)||"Failed to save."; document.getElementById("saveBtn").disabled=false; }' +
        '})' +
        '.withFailureHandler(function(err){ document.getElementById("status").innerText=err.message||String(err); document.getElementById("saveBtn").disabled=false; })' +
        '.saveApiKeyAndModel(key, modelId);' +
    '}' +
    'function esc(s){ if(!s) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }' +
    'var AUTH_MSG="' + (AUTH_REQUIRED_MSG.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')) + '";' +
    'function showErr(msg){ var m=(msg&&(msg.indexOf("Authorisation is required")!==-1||msg.indexOf("Authorization is required")!==-1))?AUTH_MSG:msg; document.body.innerHTML=\'<div style="max-height:280px; overflow:auto; margin:0 0 12px;"><p style="margin:0; color:#c62828; white-space:pre-wrap; font-size:13px;">\'+esc(m)+\'</p></div><button onclick="google.script.host.close()" style="padding:8px 16px;">Close</button>\'; }' +
    'function startTranscription(){' +
      'document.body.innerHTML=\'<p style="font-family:Arial,sans-serif;padding:16px;margin:0;">Awaiting response from Gemini API\\u2026 This may take up to 1 minute. Please wait \\u2014 this dialog will close automatically.</p>\';' +
      'google.script.run' +
        '.withSuccessHandler(function(r){' +
          'if(r&&r.ok){ google.script.host.close(); google.script.run.showDoneAlert(); }' +
          'else{ showErr((r&&r.message)||"Unknown error"); }' +
        '})' +
        '.withFailureHandler(function(err){ showErr(err.message||String(err)); })' +
        '.runTranscribeWorker();' +
    '}' +
    '</script></body></html>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(320), dialogTitle);
}

/** Opens Setup API key & model dialog from the Extension menu (key optional, save and close). */
function showSetupApiKeyAndModelDialog() {
  showApiKeyDialog(true);
}

/**
 * Saves the API key to User Properties (private per Google account). Called from the API key dialog.
 */
function saveApiKey(key) {
  return saveApiKeyAndModel(key, null);
}

/**
 * Saves API key and/or model ID. Key or modelId can be null to leave unchanged.
 */
function saveApiKeyAndModel(key, modelId) {
  var props = PropertiesService.getUserProperties();
  if (key && typeof key === 'string' && key.trim() !== '') {
    props.setProperty(API_KEY_PROPERTY, key.trim());
    Logger.log('saveApiKeyAndModel: key saved');
  }
  if (modelId && typeof modelId === 'string' && modelId.trim() !== '') {
    props.setProperty(MODEL_ID_PROPERTY, modelId.trim());
    Logger.log('saveApiKeyAndModel: model saved ' + modelId.trim());
  }
  return { ok: true };
}

/**
 * Saves only the model ID (called from Settings dialog).
 */
function saveModel(modelId) {
  if (!modelId || typeof modelId !== 'string' || modelId.trim() === '') {
    return { ok: false, message: 'Please select a model.' };
  }
  PropertiesService.getUserProperties().setProperty(MODEL_ID_PROPERTY, modelId.trim());
  Logger.log('saveModel: model saved ' + modelId.trim());
  return { ok: true };
}

/**
 * Clears the stored API key so the user will be prompted again on next Transcribe.
 */
function clearApiKey() {
  PropertiesService.getUserProperties().deleteProperty(API_KEY_PROPERTY);
  Logger.log('clearApiKey: key cleared');
  return { ok: true };
}

/**
 * Shows Settings dialog: change model or clear API key.
 */
function showSettingsDialog() {
  var ui = DocumentApp.getUi();
  var currentModel = getStoredModel();
  var options = getModelOptions();
  var optionsHtml = options.map(function(o) {
    var sel = (o.id === currentModel) ? ' selected' : '';
    return '<option value="' + o.id + '"' + sel + '>' + o.label + '</option>';
  }).join('');
  var html = '<!DOCTYPE html><html><head><base target="_top"></head>' +
    '<body style="font-family: Arial, sans-serif; padding: 16px;">' +
    '<p style="margin:0 0 12px;">Change the Gemini model or clear your API key.</p>' +
    '<label style="display:block; margin-bottom:4px; font-weight:bold;">Model:</label>' +
    '<select id="model" style="width:100%; padding:6px; box-sizing:border-box; font-size:13px; margin-bottom:12px;">' + optionsHtml + '</select>' +
    '<div id="status" style="color:#C62828; margin-bottom:8px; font-size:12px;"></div>' +
    '<div style="display:flex; justify-content:space-between; margin-top:12px;">' +
    '<button type="button" onclick="clearKey()" style="padding:8px 16px; font-size:13px; cursor:pointer;">Clear API key</button>' +
    '<button type="button" onclick="saveModel()" style="padding:8px 16px; font-size:13px; cursor:pointer;">Save model</button></div>' +
    '<script>' +
    'function saveModel(){' +
      'var modelId=document.getElementById("model").value;' +
      'document.getElementById("status").innerText="";' +
      'google.script.run.withSuccessHandler(function(r){' +
        'if(r&&r.ok){ document.getElementById("status").style.color="green"; document.getElementById("status").innerText="Model saved."; }' +
        'else{ document.getElementById("status").style.color="#C62828"; document.getElementById("status").innerText=(r&&r.message)||"Failed."; }' +
      '}).withFailureHandler(function(err){ document.getElementById("status").style.color="#C62828"; document.getElementById("status").innerText=err.message||String(err); })' +
      '.saveModel(modelId);' +
    '}' +
    'function clearKey(){' +
      'google.script.run.withSuccessHandler(function(){ google.script.host.close(); }).clearApiKey();' +
    '}' +
    '</script></body></html>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(220), 'Settings');
}

/**
 * Continues the transcribe flow: validates image selection and shows the awaiting dialog.
 * Called directly when the API key is already set, or via google.script.run after saving the key.
 */
function doTranscribeFlow() {
  Logger.log('doTranscribeFlow: start');
  var ui = DocumentApp.getUi();
  var doc = DocumentApp.getActiveDocument();

  var selection = doc.getSelection();
  if (!selection) {
    Logger.log('doTranscribeFlow: no selection');
    ui.alert('Selection required', 'Please select a single image (metric book scan) and run Transcribe Image again.', ui.ButtonSet.OK);
    return;
  }

  var rangeElements = selection.getRangeElements();
  if (!rangeElements || rangeElements.length !== 1) {
    Logger.log('doTranscribeFlow: selection count=' + (rangeElements ? rangeElements.length : 0));
    ui.alert('Selection required', 'Please select exactly one image.', ui.ButtonSet.OK);
    return;
  }

  var element = rangeElements[0].getElement();
  Logger.log('doTranscribeFlow: element type=' + element.getType());
  if (element.getType() !== DocumentApp.ElementType.INLINE_IMAGE) {
    ui.alert('Image required', 'Please click on the metric book image to select it, then run Transcribe Image.', ui.ButtonSet.OK);
    return;
  }

  var inlineImage = element.asInlineImage();
  var blob = inlineImage.getBlob();
  var mimeType = blob.getContentType() || 'image/png';
  if (mimeType.indexOf('image/') !== 0) {
    mimeType = 'image/png';
  }
  Logger.log('doTranscribeFlow: image blob size=' + (blob.getBytes && blob.getBytes().length) + ', mimeType=' + mimeType);

  var context = getContextFromDocument(doc);
  var prompt = buildPrompt(context);
  Logger.log('doTranscribeFlow: context length=' + (context ? context.length : 0) + ', prompt length=' + (prompt ? prompt.length : 0));

  showAwaitingDialog(ui);
}

/**
 * Shows a modal dialog with status message and runs the transcription worker.
 * On error, shows the error message in the dialog with a Close button (so user always sees it).
 */
/** User-facing message when Apps Script throws authorisation error (e.g. collaborator has not installed add-on). */
var AUTH_REQUIRED_MSG = 'The add-on needs your permission to run.\n\n' +
  'If you are a collaborator on this document (not the person who added the add-on): install the add-on for your account — open Extensions → Metric Book Transcriber and complete the authorization when prompted.\n\n' +
  'If you already use the add-on: try Extensions → Metric Book Transcriber → Settings, or remove and re-add the add-on to sign in again.';

function showAwaitingDialog(ui) {
  var authMsgJs = AUTH_REQUIRED_MSG.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  var html = '<!DOCTYPE html><html><head><base target="_top"></head><body style="font-family: Arial, sans-serif; padding: 16px;">' +
    '<p style="margin:0;">Awaiting response from Gemini API… This may take up to 1 minute. Please wait — this dialog will close automatically.</p>' +
    '<script>' +
    'function esc(s){ if(!s) return ""; return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }' +
    'var AUTH_MSG="' + authMsgJs + '";' +
    'function showErr(msg){ var m=(msg&&(msg.indexOf("Authorisation is required")!==-1||msg.indexOf("Authorization is required")!==-1))?AUTH_MSG:msg; document.body.innerHTML=\'<div style="max-height:280px; overflow:auto; margin:0 0 12px;"><p style="margin:0; color:#c62828; white-space:pre-wrap; font-size:13px;">\'+esc(m)+\'</p></div><button onclick="google.script.host.close()" style="padding:8px 16px;">Close</button>\'; }' +
    'google.script.run.withSuccessHandler(function(r){' +
    '  if(r&&r.ok){ google.script.host.close(); google.script.run.showDoneAlert(); }' +
    '  else{ showErr((r&&r.message)||"Unknown error"); }' +
    '}).withFailureHandler(function(err){ showErr(err.message||String(err)); })' +
    '.runTranscribeWorker();</script></body></html>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(480).setHeight(320), 'Transcribing');
}

/**
 * Called from the awaiting dialog. Performs API call and insert; returns { ok: true } or { ok: false, message: string }.
 */
function runTranscribeWorker() {
  Logger.log('runTranscribeWorker: start');
  var doc = DocumentApp.getActiveDocument();
  var apiKey = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, message: 'API key not set. Run Transcribe Image to set your key.' };
  }
  var selection = doc.getSelection();
  if (!selection) return { ok: false, message: 'Please select a single image and run Transcribe Image again.' };
  var rangeElements = selection.getRangeElements();
  if (!rangeElements || rangeElements.length !== 1) return { ok: false, message: 'Please select exactly one image.' };
  var element = rangeElements[0].getElement();
  if (element.getType() !== DocumentApp.ElementType.INLINE_IMAGE) {
    return { ok: false, message: 'Please click on the metric book image to select it, then run Transcribe Image.' };
  }
  var inlineImage = element.asInlineImage();
  var blob = inlineImage.getBlob();
  var mimeType = blob.getContentType() || 'image/png';
  if (mimeType.indexOf('image/') !== 0) mimeType = 'image/png';
  var context = getContextFromDocument(doc);
  var prompt = buildPrompt(context);
  var transcription;
  try {
    transcription = callGemini(apiKey, prompt, blob, mimeType);
  } catch (e) {
    Logger.log('runTranscribeWorker: callGemini threw ' + (e.message || String(e)));
    return { ok: false, message: 'Request failed: ' + (e.message || String(e)) };
  }
  if (!transcription || transcription.trim() === '') {
    return { ok: false, message: 'The API returned no text. Try again or check the image.' };
  }
  var elementContainingImage = inlineImage.getParent();
  while (elementContainingImage.getType() !== DocumentApp.ElementType.PARAGRAPH &&
         elementContainingImage.getType() !== DocumentApp.ElementType.LIST_ITEM) {
    elementContainingImage = elementContainingImage.getParent();
  }
  insertTranscriptionAfter(doc, elementContainingImage, transcription);
  Logger.log('runTranscribeWorker: done');
  return { ok: true };
}

function showDoneAlert() {
  DocumentApp.getUi().alert('Done', 'Transcription inserted below the image.', DocumentApp.getUi().ButtonSet.OK);
}

function showErrorAlert(message) {
  DocumentApp.getUi().alert('Error', message, DocumentApp.getUi().ButtonSet.OK);
}

/** Returns the model ID to use (stored or default). */
function getStoredModel() {
  var stored = PropertiesService.getUserProperties().getProperty(MODEL_ID_PROPERTY);
  return (stored && stored.trim()) ? stored.trim() : MODEL_ID;
}

var HELP_URL = 'https://github.com/dekochka/geneascript-gdoc-addon/blob/main/docs/USER_GUIDE.md';
var ISSUE_URL = 'https://github.com/dekochka/geneascript-gdoc-addon/issues';

function showHelp() {
  var html = '<body style="font-family:Arial,sans-serif;padding:12px;">' +
    '<p style="margin:0 0 8px;">Open the User Guide for step-by-step instructions, tips, and troubleshooting:</p>' +
    '<p style="margin:0;"><a href="' + HELP_URL + '" target="_blank" style="font-size:14px;">User Guide on GitHub</a></p>' +
    '</body>';
  DocumentApp.getUi().showModelessDialog(
    HtmlService.createHtmlOutput(html).setWidth(360).setHeight(100),
    'Help'
  );
}

function reportIssue() {
  var html = '<body style="font-family:Arial,sans-serif;padding:12px;">' +
    '<p style="margin:0 0 8px;">Report a bug or request a feature on GitHub:</p>' +
    '<p style="margin:0;"><a href="' + ISSUE_URL + '" target="_blank" style="font-size:14px;">Open GitHub Issues</a></p>' +
    '</body>';
  DocumentApp.getUi().showModelessDialog(
    HtmlService.createHtmlOutput(html).setWidth(360).setHeight(100),
    'Report an issue'
  );
}

/**
 * Extracts the Context section from the document body (first paragraph with text "Context", then following paragraphs).
 */
function getContextFromDocument(doc) {
  Logger.log('getContextFromDocument: start');
  var body = doc.getBody();
  var numChildren = body.getNumChildren();
  var contextStart = -1;

  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var text = child.asParagraph().getText().trim();
    if (text === CONTEXT_HEADING) {
      contextStart = i;
      break;
    }
  }

  if (contextStart < 0) {
    Logger.log('getContextFromDocument: no Context heading found');
    return '';
  }
  Logger.log('getContextFromDocument: contextStart=' + contextStart);

  var parts = [];
  var count = 0;
  for (var j = contextStart + 1; j < numChildren && count < MAX_CONTEXT_PARAGRAPHS; j++) {
    var el = body.getChild(j);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) break;
    var t = el.asParagraph().getText().trim();
    if (t === CONTEXT_HEADING) break;
    parts.push(t);
    count++;
  }
  var result = parts.join('\n').trim();
  Logger.log('getContextFromDocument: paragraphs collected=' + count + ', result length=' + result.length);
  return result;
}

/**
 * Builds the full prompt by injecting the context into the template.
 */
function buildPrompt(context) {
  var template = getPromptTemplate();
  var prompt = template.replace(/\{\{CONTEXT\}\}/g, context || '(No context provided.)');
  Logger.log('buildPrompt: template length=' + template.length + ', prompt length=' + prompt.length);
  return prompt;
}

/**
 * Calls the Gemini API with the given prompt and image. Returns the generated text.
 */
function callGemini(apiKey, prompt, imageBlob, mimeType) {
  var modelId = getStoredModel();
  Logger.log('callGemini: start, model=' + modelId + ', prompt length=' + (prompt ? prompt.length : 0) + ', image size=' + (imageBlob.getBytes && imageBlob.getBytes().length));
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + encodeURIComponent(apiKey);
  var base64Data = Utilities.base64Encode(imageBlob.getBytes());

  var parts = [
    { inline_data: { mime_type: mimeType, data: base64Data } },
    { text: prompt }
  ];

  var payload = {
    contents: [{ parts: parts }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192
    }
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    fetchTimeoutSeconds: 60
  };

  Logger.log('callGemini: sending request');
  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var text = response.getContentText();
  Logger.log('callGemini: response code=' + code + ', body length=' + (text ? text.length : 0));

  if (code !== 200) {
    var msg = 'API error';
    try {
      var err = JSON.parse(text);
      if (err.error && err.error.message) msg = err.error.message;
    } catch (e) {}
    Logger.log('callGemini: error ' + code + ' ' + msg);
    throw new Error(msg + ' (HTTP ' + code + ')');
  }

  var json = JSON.parse(text);
  if (!json.candidates || json.candidates.length === 0) {
    var feedback = (json.promptFeedback && json.promptFeedback.blockReason) ? json.promptFeedback.blockReason : 'No candidates returned';
    Logger.log('callGemini: no candidates, feedback=' + feedback);
    throw new Error(feedback);
  }

  var candidate = json.candidates[0];
  var finishReason = candidate.finishReason || 'UNKNOWN';
  var usage = json.usageMetadata || {};
  Logger.log('callGemini: finishReason=' + finishReason +
    ', promptTokens=' + (usage.promptTokenCount || '?') +
    ', candidatesTokens=' + (usage.candidatesTokenCount || '?') +
    ', totalTokens=' + (usage.totalTokenCount || '?') +
    ', thoughtsTokens=' + (usage.thoughtsTokenCount || '?'));

  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    Logger.log('callGemini: empty content in candidate');
    throw new Error('Empty content in response (finishReason=' + finishReason + ')');
  }

  var resultParts = [];
  var thoughtParts = 0;
  for (var i = 0; i < candidate.content.parts.length; i++) {
    var part = candidate.content.parts[i];
    if (part.thought) {
      thoughtParts++;
      continue;
    }
    if (part.text) {
      resultParts.push(part.text);
    }
  }
  var result = resultParts.join('');
  Logger.log('callGemini: success, totalParts=' + candidate.content.parts.length +
    ', thoughtParts=' + thoughtParts + ', textParts=' + resultParts.length +
    ', result length=' + result.length);

  if (finishReason === 'MAX_TOKENS') {
    Logger.log('callGemini: WARNING — response truncated (MAX_TOKENS). Output may be incomplete.');
  }
  return result;
}

/**
 * Inserts the transcription text immediately after the element that contains the selected image.
 * Uses body.getChildIndex() to get the insertion index; avoids === and getIndex() which are unreliable in GAS.
 */
function insertTranscriptionAfter(doc, elementContainingImage, text) {
  Logger.log('insertTranscriptionAfter: start');
  var body = doc.getBody();
  var currentElement = elementContainingImage;
  var parentElement = currentElement.getParent();
  while (parentElement && parentElement.getType() !== DocumentApp.ElementType.BODY_SECTION) {
    currentElement = parentElement;
    parentElement = currentElement.getParent();
  }
  var insertIndex;
  try {
    insertIndex = body.getChildIndex(currentElement);
    Logger.log('insertTranscriptionAfter: image container at index ' + insertIndex);
  } catch (e) {
    Logger.log('insertTranscriptionAfter: getChildIndex failed, appending. Error: ' + e);
    insertIndex = body.getNumChildren() - 1;
  }
  insertFormattedText(body, insertIndex + 1, text);
  Logger.log('insertTranscriptionAfter: done');
}

/** Hex colors for Quality Metrics and Assessment lines. */
var COLOR_QUALITY_METRICS = '#1565C0';  // blue
var COLOR_ASSESSMENT = '#C62828';       // red

/**
 * Inserts text at the given body index, parsing **bold** and - / * bullet lines into native GDoc formatting.
 * Preserves blank lines. Colors "Quality Metrics" and "Assessment" lines for visibility.
 */
function insertFormattedText(body, startIndex, text) {
  if (!text || text.length === 0) return;
  var lines = text.split('\n');
  var currentIndex = startIndex;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line === '') {
      body.insertParagraph(currentIndex, '');
      currentIndex++;
      continue;
    }
    var isBullet = line.indexOf('- ') === 0 || line.indexOf('* ') === 0;
    if (isBullet) line = line.substring(2);
    var plainText = '';
    var boldRanges = [];
    var parts = line.split('**');
    var isBold = false;
    var currentPos = 0;
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      plainText += part;
      if (isBold && part.length > 0) {
        boldRanges.push({ start: currentPos, end: currentPos + part.length - 1 });
      }
      currentPos += part.length;
      isBold = !isBold;
    }
    var element;
    if (isBullet) {
      element = body.insertListItem(currentIndex, plainText);
      element.setGlyphType(DocumentApp.GlyphType.BULLET);
    } else {
      element = body.insertParagraph(currentIndex, plainText);
    }
    var textObj = element.editAsText();
    for (var b = 0; b < boldRanges.length; b++) {
      var r = boldRanges[b];
      if (r.start <= r.end) textObj.setBold(r.start, r.end, true);
    }
    var len = plainText.length;
    if (len > 0) {
      if (plainText.indexOf('Quality Metrics:') === 0) {
        textObj.setForegroundColor(0, len - 1, COLOR_QUALITY_METRICS);
      } else if (plainText.indexOf('Assessment:') === 0) {
        textObj.setForegroundColor(0, len - 1, COLOR_ASSESSMENT);
      }
    }
    currentIndex++;
  }
  body.insertParagraph(currentIndex, '');
}
