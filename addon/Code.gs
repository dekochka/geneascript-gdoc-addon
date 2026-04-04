/**
 * GDoc Metric Book Transcriber Add-On
 * Adds menu and runs "Transcribe Image" to send selected image + context to Gemini and insert result.
 */

var MODEL_ID = 'gemini-flash-latest';
var API_KEY_PROPERTY = 'GEMINI_API_KEY';
var MODEL_ID_PROPERTY = 'GEMINI_MODEL_ID';
var REQUEST_TEMPERATURE_PROPERTY = 'GEMINI_REQUEST_TEMPERATURE';
var REQUEST_MAX_OUTPUT_TOKENS_PROPERTY = 'GEMINI_REQUEST_MAX_OUTPUT_TOKENS';
var REQUEST_THINKING_MODE_PROPERTY = 'GEMINI_REQUEST_THINKING_MODE';
var REQUEST_THINKING_BUDGET_PROPERTY = 'GEMINI_REQUEST_THINKING_BUDGET';
var REQUEST_DEFAULT_TEMPERATURE = 0.1;
var REQUEST_DEFAULT_MAX_OUTPUT_TOKENS = 32768;
var REQUEST_DEFAULT_THINKING_MODE = 'auto';
var REQUEST_MIN_TEMPERATURE = 0;
var REQUEST_MAX_TEMPERATURE = 2;
var REQUEST_MIN_MAX_OUTPUT_TOKENS = 1;
var REQUEST_MAX_MAX_OUTPUT_TOKENS = 65536;
var CONTEXT_HEADING = 'Context';
var MAX_CONTEXT_PARAGRAPHS = 50;
var MAX_IMPORT_IMAGES = 30;
var IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
var PICKER_API_KEY_PROPERTY = 'GOOGLE_PICKER_API_KEY';
var PICKER_APP_ID_PROPERTY = 'GOOGLE_PICKER_APP_ID';
// Observability helpers are defined in addon/Observability.gs (logObsEvent, createRunId, hashId, classifyErrorCode, sanitizeErrorMessage).

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
      .createMenu('GeneaScript Metric Book Transcriber')
      .addItem('Open Sidebar', 'showTranscribeSidebar')
      .addItem('Transcribe Image', 'transcribeSelectedImage')
      .addItem('Import Book from Drive Files', 'showDrivePickerDialog')
      .addItem('Extract Context from Cover Image', 'openExtractContextDialog')
      .addSeparator()
      .addItem('Setup AI', 'showSetupApiKeyAndModelDialog')
      .addItem('Help / User Guide', 'showHelp')
      .addItem('Report an issue', 'reportIssue')
      .addToUi();
    Logger.log('onOpen: menu added.');
  } catch (e) {
    Logger.log('onOpen: skipped menu (no UI context, e.g. run from script editor). ' + e.message);
  }
}

/**
 * Extracts unique Google Drive file IDs from text containing file URLs/IDs.
 * Accepts IDs or links separated by commas, spaces, or newlines.
 */
function extractDriveFileIds(inputText) {
  if (!inputText || typeof inputText !== 'string') return [];
  var matches = inputText.match(/[-\w]{25,}/g) || [];
  var deduped = [];
  var seen = {};
  for (var i = 0; i < matches.length; i++) {
    var id = matches[i];
    if (!seen[id]) {
      seen[id] = true;
      deduped.push(id);
    }
  }
  return deduped;
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
 * Legacy/manual import path that prompts for Drive file URLs/IDs.
 * Used as a fallback when picker setup is missing.
 */
function importFromDriveFolder() {
  Logger.log('importFromDriveFolder: manual fallback start');
  var ui = DocumentApp.getUi();
  var response = ui.prompt(
    'Drive Files',
    'Paste one or more Google Drive image file URLs or IDs (JPEG, PNG, WebP), separated by commas or new lines.',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var fileIds = extractDriveFileIds(response.getResponseText());
  importFromDriveFileIds(fileIds);
}

/**
 * Imports metric book images from explicit Drive file IDs selected by the user.
 * This is the core import path used by Google Picker and manual fallback.
 */
function importFromDriveFileIds(fileIds) {
  Logger.log('importFromDriveFileIds: start');
  var runId = createRunId('import');
  var operationStartMs = Date.now();
  var ui = DocumentApp.getUi();
  var doc = DocumentApp.getActiveDocument();
  var docIdHash = hashId(doc && doc.getId ? doc.getId() : null);
  logObsEvent('import_drive_start', {
    operation: 'import_drive',
    entrypoint: 'menu_or_sidebar',
    status: 'start',
    runId: runId,
    docIdHash: docIdHash
  });
  var normalizedIds = [];
  if (fileIds && fileIds.forEach) {
    fileIds.forEach(function (id) {
      if (id) normalizedIds.push(String(id).trim());
    });
  }
  Logger.log('importFromDriveFileIds: received fileIds=' + normalizedIds.length);
  if (!normalizedIds.length) {
    Logger.log('importFromDriveFileIds: invalid input, no file IDs provided');
    logObsEvent('import_drive_error', {
      operation: 'import_drive',
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'UNKNOWN',
      errorMessage: 'invalid drive file links'
    });
    ui.alert('Invalid input', 'No valid Drive file IDs found. Please provide file links or IDs.', ui.ButtonSet.OK);
    return { ok: false, message: 'No valid Drive file IDs found' };
  }

  var imageFiles = [];
  var rejectedCount = 0;
  for (var idIndex = 0; idIndex < normalizedIds.length; idIndex++) {
    var fileId = normalizedIds[idIndex];
    try {
      var file = DriveApp.getFileById(fileId);
      var mime = file.getMimeType();
      if (IMAGE_MIME_TYPES.indexOf(mime) !== -1) {
        imageFiles.push(file);
      } else {
        rejectedCount++;
      }
    } catch (e) {
      rejectedCount++;
      Logger.log('importFromDriveFileIds: cannot access file id=' + fileId + ' error=' + (e.message || String(e)));
    }
  }
  Logger.log('importFromDriveFileIds: selected=' + normalizedIds.length + ' imageFiles=' + imageFiles.length + ' rejected=' + rejectedCount);
  if (imageFiles.length === 0) {
    Logger.log('importFromDriveFileIds: no valid images after filtering');
    logObsEvent('import_drive_done', {
      operation: 'import_drive',
      status: 'success',
      runId: runId,
      docIdHash: docIdHash,
      selectedFiles: normalizedIds.length,
      imageFiles: 0,
      addedCount: 0,
      skippedCount: rejectedCount,
      count: 0,
      importLatencyMs: Date.now() - operationStartMs
    });
    ui.alert('No images', 'No accessible JPEG/PNG/WebP files found in your selection.', ui.ButtonSet.OK);
    return { ok: false, message: 'No accessible JPEG/PNG/WebP files found' };
  }
  imageFiles = naturalSortFiles(imageFiles);
  var truncated = false;
  if (imageFiles.length > MAX_IMPORT_IMAGES) {
    imageFiles = imageFiles.slice(0, MAX_IMPORT_IMAGES);
    truncated = true;
  }
  var count = imageFiles.length;
  Logger.log('importFromDriveFileIds: after sort count=' + count + ' truncated=' + truncated + ' MAX_IMPORT_IMAGES=' + MAX_IMPORT_IMAGES);
  ui.alert('Importing', 'Ready to import ' + count + ' image(s) from your selected files. Click OK to start — this may take a minute.', ui.ButtonSet.OK);
  ensureContextBlock(doc);
  var body = doc.getBody();
  var contentWidthPt = body.getPageWidth() - body.getMarginLeft() - body.getMarginRight();
  var skipped = 0;
  var skippedFiles = [];
  for (var i = 0; i < imageFiles.length; i++) {
    Logger.log('importFromDriveFileIds: inserting image ' + (i + 1) + '/' + count);
    var file = imageFiles[i];
    var imageStartMs = Date.now();
    try {
      var blob = file.getBlob();
      var bytes = blob.getBytes().length;
      Logger.log('importFromDriveFileIds: H1/H3 blobSize index=' + (i + 1) + ' fileName=' + file.getName() + ' blobSizeBytes=' + bytes + ' blobSizeMB=' + (bytes / 1e6).toFixed(2));
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
      logObsEvent('import_drive_image_processed', {
        operation: 'import_drive',
        status: 'success',
        runId: runId,
        docIdHash: docIdHash,
        selectedFiles: normalizedIds.length,
        imageOrdinal: i + 1,
        fileName: file.getName(),
        blobSizeBytes: bytes,
        imageImportLatencyMs: Date.now() - imageStartMs
      });
    } catch (e) {
      skipped++;
      var bytesForError = 0;
      try {
        bytesForError = file.getBlob().getBytes().length;
      } catch (_ignored) {}
      var sizeMB = (bytesForError / 1e6).toFixed(2);
      skippedFiles.push({
        name: file.getName(),
        sizeMB: sizeMB,
        reason: bytesForError > 0 ? 'Too large (' + sizeMB + ' MB)' : 'Invalid or inaccessible'
      });
      Logger.log('importFromDriveFileIds: FAILED H1/H3 index=' + (i + 1) + ' fileName=' + file.getName() + ' blobSizeBytes=' + bytesForError + ' blobSizeMB=' + sizeMB + ' error=' + (e.message || String(e)));
      Logger.log('importFromDriveFileIds: skipped image ' + (i + 1) + ' "' + file.getName() + '": ' + (e.message || String(e)));
      logObsEvent('import_drive_image_processed', {
        operation: 'import_drive',
        status: 'error',
        runId: runId,
        docIdHash: docIdHash,
        selectedFiles: normalizedIds.length,
        imageOrdinal: i + 1,
        fileName: file.getName(),
        blobSizeBytes: bytesForError,
        imageImportLatencyMs: Date.now() - imageStartMs,
        errorCode: classifyErrorCode(e.message || String(e)),
        errorMessage: sanitizeErrorMessage(e.message || String(e))
      });
    }
  }
  var added = count - skipped;
  Logger.log('importFromDriveFileIds: done added=' + added + ' skipped=' + skipped + ' count=' + count);
  logObsEvent('import_drive_done', {
    operation: 'import_drive',
    status: 'success',
    runId: runId,
    docIdHash: docIdHash,
    selectedFiles: normalizedIds.length,
    imageFiles: imageFiles.length,
    addedCount: added,
    skippedCount: skipped + rejectedCount,
    count: count,
    truncated: truncated,
    maxImportImages: MAX_IMPORT_IMAGES,
    importLatencyMs: Date.now() - operationStartMs
  });
  return {
    ok: true,
    added: added,
    skipped: skipped,
    rejected: rejectedCount,
    skippedFiles: skippedFiles
  };
}

/**
 * Returns Google Picker runtime config for sidebar/modal usage.
 * Requires script properties:
 * - GOOGLE_PICKER_API_KEY
 * - GOOGLE_PICKER_APP_ID (Cloud project number)
 * Also includes parent folder ID of current document for initial Picker view.
 *
 * ⚠️ SECURITY WARNING: This function returns sensitive credentials (OAuth token, API keys).
 * Never log the returned object directly. Always redact sensitive fields before logging.
 */
function getDrivePickerConfig() {
  Logger.log('getDrivePickerConfig: start');
  var props = PropertiesService.getScriptProperties();
  var developerKey = props.getProperty(PICKER_API_KEY_PROPERTY);
  var appId = props.getProperty(PICKER_APP_ID_PROPERTY);
  Logger.log('getDrivePickerConfig: developerKey=' + (developerKey ? 'present' : 'missing') + ', appId=' + (appId ? appId : 'missing'));
  if (!developerKey || !appId) {
    Logger.log('getDrivePickerConfig: configuration incomplete');
    return {
      ok: false,
      message: 'Picker is not configured. Set script properties GOOGLE_PICKER_API_KEY and GOOGLE_PICKER_APP_ID (Cloud project number).'
    };
  }

  // Try to get parent folder of current document to set as default Picker location
  var parentFolderId = null;
  try {
    var doc = DocumentApp.getActiveDocument();
    if (doc && doc.getId) {
      var docId = doc.getId();
      var docFile = DriveApp.getFileById(docId);
      var parents = docFile.getParents();
      if (parents.hasNext()) {
        var parent = parents.next();
        parentFolderId = parent.getId();
        Logger.log('getDrivePickerConfig: found parent folder id=' + parentFolderId);
      }
    }
  } catch (e) {
    Logger.log('getDrivePickerConfig: could not get parent folder: ' + (e.message || String(e)));
    // Non-fatal: Picker will open at root if parent not found
  }

  var oauthToken = ScriptApp.getOAuthToken();
  Logger.log('getDrivePickerConfig: success, parentFolderId=' + (parentFolderId || 'null'));
  return {
    ok: true,
    developerKey: developerKey,
    appId: appId,
    oauthToken: oauthToken,
    parentFolderId: parentFolderId
  };
}

/**
 * Opens Google Picker directly for multi-select Drive image import.
 * Shows a minimal loading dialog that auto-closes when Picker opens.
 */
function showDrivePickerDialog() {
  Logger.log('showDrivePickerDialog: start');
  var html = HtmlService.createHtmlOutput(getDrivePickerHtml())
    .setWidth(1100)
    .setHeight(700);
  Logger.log('showDrivePickerDialog: showing modal dialog');
  DocumentApp.getUi().showModalDialog(html, 'Import Drive Images');
  Logger.log('showDrivePickerDialog: dialog shown');
}

/**
 * Shows an error alert after import failure.
 * Called from Picker callback when import fails.
 */
function showImportError(errorMessage) {
  var ui = DocumentApp.getUi();
  ui.alert('Import Failed', errorMessage || 'An error occurred during import. Please try again.', ui.ButtonSet.OK);
}

function getDrivePickerHtml() {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    '<script src="https://apis.google.com/js/api.js"></script>',
    '<style>body{font-family:Arial,sans-serif;padding:20px;text-align:center}#status{font-size:14px;color:#5f6368;margin-top:20px;white-space:pre-wrap;text-align:left;max-width:600px;margin-left:auto;margin-right:auto}.error{color:#d93025}</style>',
    '</head><body>',
    '<div id="status">Loading Google Picker...</div>',
    '<div id="instructions" style="font-size:12px;color:#5f6368;margin-top:10px;display:none;">',
    '  <strong>Images tab:</strong> All accessible images<br>',
    '  <strong>Folders tab:</strong> Browse folders (images only)<br>',
    '  Use search to find files by name',
    '</div>',
    '<script>',
    'var pickerConfig=null;',
    'function setStatus(msg,isError){',
    '  var el=document.getElementById("status");',
    '  el.textContent=msg||"";',
    '  el.className=isError?"error":"";',
    '}',
    'function hideDialog(){',
    '  var el=document.getElementById("status");',
    '  if(el)el.style.display="none";',
    '  var inst=document.getElementById("instructions");',
    '  if(inst)inst.style.display="none";',
    '}',
    'function showError(msg){',
    '  document.getElementById("status").style.display="";',
    '  setStatus(msg,true);',
    '  setTimeout(function(){ google.script.host.close(); },3000);',
    '}',
    'function showStatus(msg){',
    '  document.getElementById("status").style.display="";',
    '  setStatus(msg,false);',
    '}',
    'function init(){',
    '  console.log("init: starting Picker configuration fetch");',
    '  google.script.run',
    '    .withSuccessHandler(function(cfg){',
    '      console.log("init: config received", {ok: cfg.ok, hasToken: !!cfg.oauthToken, hasKey: !!cfg.developerKey, appId: cfg.appId});',
    '      pickerConfig=cfg;',
    '      if(!cfg||!cfg.ok){',
    '        console.error("init: config invalid", {ok: cfg.ok, message: cfg.message});',
    '        showError((cfg&&cfg.message)||"Picker is not configured. Contact your administrator.");',
    '        return;',
    '      }',
    '      console.log("init: config valid, calling openPicker");',
    '      openPicker();',
    '    })',
    '    .withFailureHandler(function(e){',
    '      console.error("init: failed to get config", e);',
    '      showError("Failed to load Picker configuration: "+(e.message||String(e)));',
    '    })',
    '    .getDrivePickerConfig();',
    '}',
    'function openPicker(){',
    '  console.log("openPicker: starting");',
    '  setStatus("Opening Google Picker...");',
    '  console.log("openPicker: loading gapi picker");',
    '  gapi.load("picker",{',
    '    callback:function(){',
    '      console.log("openPicker: gapi picker loaded successfully");',
    '      var imagesView=new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES);',
    '      imagesView.setMode(google.picker.DocsViewMode.LIST);',
    '      if(pickerConfig.parentFolderId){',
    '        console.log("openPicker: setting parent folder for images view", pickerConfig.parentFolderId);',
    '        imagesView.setParent(pickerConfig.parentFolderId);',
    '      }',
    '      var foldersView=new google.picker.DocsView();',
    '      foldersView.setIncludeFolders(true);',
    '      foldersView.setMimeTypes("image/jpeg,image/png,image/webp");',
    '      foldersView.setMode(google.picker.DocsViewMode.LIST);',
    '      if(pickerConfig.parentFolderId){',
    '        console.log("openPicker: setting parent folder for folders view", pickerConfig.parentFolderId);',
    '        foldersView.setParent(pickerConfig.parentFolderId);',
    '      }',
    '      console.log("openPicker: building picker with size 1051x650 and two views");',
    '      var picker=new google.picker.PickerBuilder()',
    '        .addView(imagesView)',
    '        .addView(foldersView)',
    '        .setOAuthToken(pickerConfig.oauthToken)',
    '        .setDeveloperKey(pickerConfig.developerKey)',
    '        .setAppId(pickerConfig.appId)',
    '        .setOrigin(google.script.host.origin)',
    '        .setSize(1051, 650)',
    '        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)',
    '        .setCallback(onPicked)',
    '        .build();',
    '      console.log("openPicker: picker built, making visible");',
    '      picker.setVisible(true);',
    '      console.log("openPicker: picker shown, showing instructions briefly");',
    '      document.getElementById("instructions").style.display="";',
    '      setTimeout(function(){',
    '        console.log("openPicker: hiding instructions");',
    '        hideDialog();',
    '      }, 3000);',
    '    },',
    '    onerror:function(e){',
    '      console.error("openPicker: gapi load error", e);',
    '      showError("Failed to load Google Picker API. Check your network connection.");',
    '    }',
    '  });',
    '}',
    'function onPicked(data){',
    '  console.log("onPicked: callback triggered", data);',
    '  if(data.action===google.picker.Action.CANCEL){',
    '    console.log("onPicked: user cancelled, closing dialog");',
    '    google.script.host.close();',
    '    return;',
    '  }',
    '  if(data.action!==google.picker.Action.PICKED){',
    '    console.log("onPicked: action not PICKED, ignoring", data.action);',
    '    return;',
    '  }',
    '  var docs=data.docs||[];',
    '  console.log("onPicked: user selected", docs.length, "files");',
    '  var validImageMimes=["image/jpeg","image/png","image/webp"];',
    '  var ids=[];',
    '  var skipped=0;',
    '  for(var i=0;i<docs.length;i++){',
    '    var doc=docs[i];',
    '    if(!doc||!doc.id)continue;',
    '    if(doc.mimeType&&validImageMimes.indexOf(doc.mimeType)>=0){',
    '      ids.push(doc.id);',
    '    }else{',
    '      console.warn("onPicked: skipping non-image file", doc.name, doc.mimeType);',
    '      skipped++;',
    '    }',
    '  }',
    '  if(!ids.length){',
    '    var msg=skipped>0?"Only image files (JPEG, PNG, WebP) can be imported.":"No files selected.";',
    '    console.warn("onPicked: no valid images, skipped="+skipped);',
    '    showError(msg);',
    '    return;',
    '  }',
    '  if(skipped>0){',
    '    console.log("onPicked: skipped "+skipped+" non-image files");',
    '  }',
    '  console.log("onPicked: starting import for", ids.length, "files");',
    '  var statusMsg="Importing " + ids.length + " image"+(ids.length>1?"s":"")+"...";',
    '  if(skipped>0)statusMsg+=" (skipped "+skipped+" non-image file"+(skipped>1?"s":"")+")";',
    '  showStatus(statusMsg);',
    '  google.script.run',
    '    .withSuccessHandler(function(result){',
    '      console.log("onPicked: import completed", result);',
    '      if(!result||!result.ok){',
    '        showError(result&&result.message?result.message:"Import failed");',
    '        return;',
    '      }',
    '      var msg="Import complete!\\n\\n";',
    '      msg+="✓ "+result.added+" image"+(result.added===1?"":"s")+" added successfully\\n";',
    '      if(result.skipped>0){',
    '        msg+="✗ "+result.skipped+" failed (too large or invalid)\\n\\n";',
    '        msg+="Failed files:\\n";',
    '        for(var i=0;i<result.skippedFiles.length&&i<5;i++){',
    '          var sf=result.skippedFiles[i];',
    '          msg+="• "+sf.name+" - "+sf.reason+"\\n";',
    '        }',
    '        if(result.skippedFiles.length>5){',
    '          msg+="...and "+(result.skippedFiles.length-5)+" more\\n";',
    '        }',
    '      }',
    '      showStatus(msg);',
    '      setTimeout(function(){ google.script.host.close(); }, 4000);',
    '    })',
    '    .withFailureHandler(function(e){',
    '      console.error("onPicked: import failed", e);',
    '      showError("Import failed: " + (e.message||String(e)));',
    '    })',
    '    .importFromDriveFileIds(ids);',
    '}',
    'init();',
    '</script></body></html>'
  ].join('');
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
/** Model options for the dropdown (id = API model id). Use exact IDs from https://ai.google.dev/gemini-api/docs/models */
function getModelOptions() {
  return [
    { id: 'gemini-flash-latest', label: 'Gemini Flash Latest (default, free tier ~20/day)' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite (lower quality, 500 requests/day)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (best quality, billing)' }
  ];
}

function getDefaultRequestConfig() {
  return {
    temperature: REQUEST_DEFAULT_TEMPERATURE,
    maxOutputTokens: REQUEST_DEFAULT_MAX_OUTPUT_TOKENS,
    thinkingMode: REQUEST_DEFAULT_THINKING_MODE,
    thinkingBudget: null
  };
}

function getThinkingCapabilityByModel(modelId) {
  var id = (modelId || '').trim().toLowerCase();
  if (id.indexOf('gemini-3') === 0 || id === 'gemini-flash-latest') {
    return {
      configType: 'level',
      supportsThinkingBudget: false,
      supportsThinkingOff: false,
      thinkingModes: ['auto', 'minimal', 'standard', 'high']
    };
  }
  return {
    configType: 'budget',
    supportsThinkingBudget: true,
    supportsThinkingOff: true,
    thinkingModes: ['auto', 'off', 'minimal', 'standard', 'high'],
    minBudget: -1,
    maxBudget: 32768
  };
}

function parseOptionalInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return isFinite(value) ? Math.trunc(value) : null;
  }
  if (typeof value !== 'string') return null;
  var t = value.trim();
  if (!/^-?\d+$/.test(t)) return null;
  return parseInt(t, 10);
}

function validateRequestConfig(input, modelId) {
  input = input || {};
  var defaults = getDefaultRequestConfig();
  var capability = getThinkingCapabilityByModel(modelId || getStoredModel());
  var result = {
    temperature: defaults.temperature,
    maxOutputTokens: defaults.maxOutputTokens,
    thinkingMode: defaults.thinkingMode,
    thinkingBudget: null
  };

  var tempRaw = (input.temperature !== undefined && input.temperature !== null && input.temperature !== '') ? input.temperature : defaults.temperature;
  var tempNum = Number(tempRaw);
  if (!isFinite(tempNum)) {
    return { ok: false, message: 'Temperature must be a number.' };
  }
  if (tempNum < REQUEST_MIN_TEMPERATURE || tempNum > REQUEST_MAX_TEMPERATURE) {
    return { ok: false, message: 'Temperature must be between ' + REQUEST_MIN_TEMPERATURE + ' and ' + REQUEST_MAX_TEMPERATURE + '.' };
  }
  result.temperature = Number(tempNum.toFixed(2));

  var maxTokensRaw = (input.maxOutputTokens !== undefined && input.maxOutputTokens !== null && input.maxOutputTokens !== '') ? input.maxOutputTokens : defaults.maxOutputTokens;
  var maxTokens = parseOptionalInteger(maxTokensRaw);
  if (maxTokens === null) {
    return { ok: false, message: 'Max output tokens must be an integer.' };
  }
  if (maxTokens < REQUEST_MIN_MAX_OUTPUT_TOKENS || maxTokens > REQUEST_MAX_MAX_OUTPUT_TOKENS) {
    return { ok: false, message: 'Max output tokens must be between ' + REQUEST_MIN_MAX_OUTPUT_TOKENS + ' and ' + REQUEST_MAX_MAX_OUTPUT_TOKENS + '.' };
  }
  result.maxOutputTokens = maxTokens;

  var modeRaw = (input.thinkingMode || defaults.thinkingMode);
  var mode = String(modeRaw).trim().toLowerCase();
  if (capability.thinkingModes.indexOf(mode) === -1) {
    return { ok: false, message: 'Thinking mode "' + mode + '" is not supported for the selected model.' };
  }
  result.thinkingMode = mode;
  if (mode === 'off' && !capability.supportsThinkingOff) {
    return { ok: false, message: 'Thinking off mode is not supported for the selected model.' };
  }

  var budget = parseOptionalInteger(input.thinkingBudget);
  if (budget === null) {
    result.thinkingBudget = null;
  } else if (!capability.supportsThinkingBudget) {
    return { ok: false, message: 'Thinking budget is not supported for the selected model.' };
  } else {
    var minBudget = capability.minBudget;
    var maxBudget = capability.maxBudget;
    if (budget < minBudget || budget > maxBudget) {
      return { ok: false, message: 'Thinking budget must be between ' + minBudget + ' and ' + maxBudget + '.' };
    }
    result.thinkingBudget = budget;
  }

  return { ok: true, value: result };
}

function getStoredRequestConfig(modelId) {
  var props = PropertiesService.getUserProperties();
  var raw = {
    temperature: props.getProperty(REQUEST_TEMPERATURE_PROPERTY),
    maxOutputTokens: props.getProperty(REQUEST_MAX_OUTPUT_TOKENS_PROPERTY),
    thinkingMode: props.getProperty(REQUEST_THINKING_MODE_PROPERTY),
    thinkingBudget: props.getProperty(REQUEST_THINKING_BUDGET_PROPERTY)
  };
  var validated = validateRequestConfig(raw, modelId || getStoredModel());
  if (!validated.ok) {
    return getDefaultRequestConfig();
  }
  return validated.value;
}

function getSetupDialogState(modelId) {
  var resolvedModel = modelId || getStoredModel();
  var capability = getThinkingCapabilityByModel(resolvedModel);
  var config = getStoredRequestConfig(resolvedModel);
  return {
    config: config,
    capability: capability
  };
}

function buildGenerationConfigFromSettings(modelId, requestConfig) {
  var cfg = requestConfig || getStoredRequestConfig(modelId);
  var capability = getThinkingCapabilityByModel(modelId);
  var normalizedModelId = String(modelId || '').toLowerCase();
  var isGemini31Pro = normalizedModelId.indexOf('gemini-3.1-pro') === 0;
  var generationConfig = {
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens
  };

  if (capability.configType === 'level') {
    // Gemini 3.1 Pro does not support "minimal"; use "low" as the closest strictness.
    // Gemini 3 Flash / Flash-Lite support "minimal" natively.
    if (cfg.thinkingMode === 'minimal') generationConfig.thinkingConfig = { thinkingLevel: isGemini31Pro ? 'low' : 'minimal' };
    if (cfg.thinkingMode === 'standard') generationConfig.thinkingConfig = { thinkingLevel: 'medium' };
    if (cfg.thinkingMode === 'high') generationConfig.thinkingConfig = { thinkingLevel: 'high' };
  } else if (capability.configType === 'budget') {
    if (cfg.thinkingMode === 'off') {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    } else if (cfg.thinkingMode === 'minimal') {
      generationConfig.thinkingConfig = { thinkingBudget: cfg.thinkingBudget !== null ? cfg.thinkingBudget : 512 };
    } else if (cfg.thinkingMode === 'standard') {
      generationConfig.thinkingConfig = { thinkingBudget: cfg.thinkingBudget !== null ? cfg.thinkingBudget : 2048 };
    } else if (cfg.thinkingMode === 'high') {
      generationConfig.thinkingConfig = { thinkingBudget: cfg.thinkingBudget !== null ? cfg.thinkingBudget : 8192 };
    }
  }

  return generationConfig;
}

/**
 * Opens the API key & model dialog. When forUpdate is true (Setup from menu), key is optional and Save just closes.
 * When forUpdate is false (key missing), key is required and Save & Continue starts transcription.
 */
function showApiKeyDialog(forUpdate) {
  var ui = DocumentApp.getUi();
  var currentModel = getStoredModel();
  var setupState = getSetupDialogState(currentModel);
  var options = getModelOptions();
  var optionsHtml = options.map(function(o) {
    var sel = (o.id === currentModel) ? ' selected' : '';
    return '<option value="' + o.id + '"' + sel + '>' + o.label + '</option>';
  }).join('');
  var introHtml = forUpdate
    ? '<p style="margin:0 0 6px; font-size:13px; line-height:1.35;">Fine tune AI for Image Transcription. Set API Key and Model.</p>'
    : '<p style="margin:0 0 6px; font-size:13px; line-height:1.35;">To transcribe images, this add-on needs a <b>Google AI (Gemini) API key</b>.</p>' +
      '<p style="margin:0 0 6px; font-size:12px; color:#555; line-height:1.35;">Create a key at ' +
      '<a href="https://aistudio.google.com/api-keys" target="_blank">Google AI Studio API Keys</a> ' +
      '(sign in, click <b>Create API key</b>, then paste it below).</p>';
  var btnLabel = forUpdate ? 'Save' : 'Save &amp; Continue';
  var dialogTitle = forUpdate ? 'Setup AI' : 'Set API Key';
  var stateJson = JSON.stringify(setupState).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  var html = '<!DOCTYPE html><html><head><base target="_top"></head>' +
    '<body style="font-family: Arial, sans-serif; padding: 14px;">' +
    introHtml +
    '<p style="margin:0 0 6px; font-size:12px; color:#555; line-height:1.3;">' +
    'See <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank">Gemini API pricing</a> for cost details by model and token usage. Token usage impacts cost.</p>' +
    '<label style="display:block; margin-bottom:3px; font-weight:bold;">AI model for Image Transcription</label>' +
    '<select id="model" onchange="onModelChange()" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px; margin-bottom:8px;">' + optionsHtml + '</select>' +
    '<div style="border:1px solid #DADCE0; border-radius:8px; padding:10px; margin:6px 0 8px;">' +
      '<p style="margin:0 0 6px; font-size:12px; font-weight:bold; color:#3C4043;">Transcription behavior</p>' +
      '<div style="display:grid; grid-template-columns:42% 58%; gap:8px; align-items:start; margin-bottom:6px;">' +
        '<div>' +
          '<label style="display:block; margin-bottom:3px; font-weight:bold;">Transcription strictness</label>' +
          '<input id="temperature" type="number" step="0.1" min="0" max="2" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px;" />' +
        '</div>' +
        '<p style="margin:19px 0 0; font-size:11px; color:#5f6368; line-height:1.25;">Higher strictness keeps output closer to visible text; lower strictness allows more interpretation.</p>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:42% 58%; gap:8px; align-items:start; margin-bottom:6px;">' +
        '<div>' +
          '<label style="display:block; margin-bottom:3px; font-weight:bold;">Max text length</label>' +
          '<input id="maxOutputTokens" type="number" step="1" min="1" max="65536" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px;" />' +
        '</div>' +
        '<p style="margin:19px 0 0; font-size:11px; color:#5f6368; line-height:1.25;">Higher values reduce truncation risk on dense pages, but can increase cost and response size.</p>' +
      '</div>' +
      '<div style="display:grid; grid-template-columns:42% 58%; gap:8px; align-items:start; margin-bottom:6px;">' +
        '<div>' +
          '<label style="display:block; margin-bottom:3px; font-weight:bold;">Reasoning depth</label>' +
          '<select id="thinkingMode" onchange="onThinkingModeChange()" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px;"></select>' +
        '</div>' +
        '<p style="margin:19px 0 0; font-size:11px; color:#5f6368; line-height:1.25;">Higher thinking can improve difficult handwriting interpretation, but usually increases latency and token use.</p>' +
      '</div>' +
      '<div id="thinkingBudgetRow" style="display:none;">' +
        '<div style="display:grid; grid-template-columns:42% 58%; gap:8px; align-items:start;">' +
          '<div>' +
            '<label id="thinkingBudgetLabel" style="display:block; margin-bottom:3px; font-weight:bold;">Reasoning effort limit (optional)</label>' +
            '<input id="thinkingBudget" type="number" step="1" min="-1" max="32768" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px;" />' +
          '</div>' +
          '<p style="margin:19px 0 0; font-size:11px; color:#5f6368; line-height:1.25;">Larger budgets allow deeper reasoning on hard pages, but can increase latency and cost.</p>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<label style="display:block; margin-bottom:3px; font-weight:bold;">API Key:</label>' +
    '<input id="apiKey" type="text" style="width:100%; padding:5px; box-sizing:border-box; font-size:13px;" placeholder="' + (forUpdate ? 'Leave blank to keep current key' : 'Paste your API key here') + '" />' +
    '<p style="margin:4px 0 0; font-size:11px; color:#5f6368; line-height:1.3;">Need a key? Create one at <a href="https://aistudio.google.com/api-keys" target="_blank">aistudio.google.com/api-keys</a>.</p>' +
    '<div id="status" style="color:#C62828; margin-top:5px; font-size:12px;"></div>' +
    (forUpdate ? '<p style="margin:6px 0 0; font-size:12px;"><a href="#" onclick="if(confirm(\'Clear stored API key? You will be asked for it again on next Transcribe.\')){ google.script.run.withSuccessHandler(function(){ google.script.host.close(); }).clearApiKey(); } return false;">Clear stored API key</a></p>' : '') +
    '<div style="text-align:right; margin-top:8px;">' +
    '<button id="saveBtn" onclick="save()" style="padding:8px 16px; font-size:13px; cursor:pointer; border:0; border-radius:4px; color:#fff; background:#1A73E8;">' + btnLabel + '</button></div>' +
    '<script>' +
    'var forUpdate=' + (forUpdate ? 'true' : 'false') + ';' +
    'var setupState=JSON.parse("' + stateJson + '");' +
    'function getCapability(modelId){ if(!modelId) return setupState.capability; var m=String(modelId).toLowerCase(); if(m.indexOf("gemini-3")===0||m==="gemini-flash-latest"){ return { configType:"level", supportsThinkingBudget:false, supportsThinkingOff:false, thinkingModes:["auto","minimal","standard","high"] }; } return { configType:"budget", supportsThinkingBudget:true, supportsThinkingOff:true, thinkingModes:["auto","off","minimal","standard","high"], minBudget:-1, maxBudget:32768 }; }' +
    'function populateFromState(){ document.getElementById("temperature").value=setupState.config.temperature; document.getElementById("maxOutputTokens").value=setupState.config.maxOutputTokens; onModelChange(); if(setupState.config.thinkingBudget!==null&&setupState.config.thinkingBudget!==undefined){ document.getElementById("thinkingBudget").value=setupState.config.thinkingBudget; } }' +
    'function onModelChange(){ var modelId=document.getElementById("model").value; var cap=getCapability(modelId); var modeEl=document.getElementById("thinkingMode"); var current=modeEl.value||setupState.config.thinkingMode||"auto"; modeEl.innerHTML=""; for(var i=0;i<cap.thinkingModes.length;i++){ var v=cap.thinkingModes[i]; var opt=document.createElement("option"); opt.value=v; opt.text=v.charAt(0).toUpperCase()+v.slice(1); if(v===current){ opt.selected=true; } modeEl.appendChild(opt); } if(modeEl.selectedIndex<0&&modeEl.options.length){ modeEl.options[0].selected=true; } onThinkingModeChange(); }' +
    'function onThinkingModeChange(){ var modelId=document.getElementById("model").value; var cap=getCapability(modelId); var mode=document.getElementById("thinkingMode").value; var budgetEl=document.getElementById("thinkingBudget"); var budgetLabel=document.getElementById("thinkingBudgetLabel"); var budgetRow=document.getElementById("thinkingBudgetRow"); var modelSupportsBudget=!!cap.supportsThinkingBudget; var enabled=modelSupportsBudget&&(mode==="minimal"||mode==="standard"||mode==="high"); budgetRow.style.display=modelSupportsBudget?"block":"none"; budgetEl.disabled=!enabled; budgetLabel.style.color=enabled?"#202124":"#9AA0A6"; if(!enabled){ budgetEl.value=""; } }' +
    'function validateConfig(){ var modelId=document.getElementById("model").value; var cap=getCapability(modelId); var temp=Number(document.getElementById("temperature").value); if(!isFinite(temp)){ return { ok:false, message:"Temperature must be a number." }; } if(temp<0||temp>2){ return { ok:false, message:"Temperature must be between 0 and 2." }; } var maxOut=Number(document.getElementById("maxOutputTokens").value); if(!Number.isInteger(maxOut)){ return { ok:false, message:"Max output tokens must be an integer." }; } if(maxOut<1||maxOut>65536){ return { ok:false, message:"Max output tokens must be between 1 and 65536." }; } var mode=document.getElementById("thinkingMode").value; if(cap.thinkingModes.indexOf(mode)===-1){ return { ok:false, message:"Thinking mode is not supported for selected model." }; } var budgetRaw=document.getElementById("thinkingBudget").value; var budget=null; if(budgetRaw!==null&&budgetRaw!==undefined&&String(budgetRaw).trim()!==""){ if(!/^-?\\d+$/.test(String(budgetRaw).trim())){ return { ok:false, message:"Thinking budget must be an integer." }; } budget=parseInt(String(budgetRaw).trim(),10); if(!cap.supportsThinkingBudget){ return { ok:false, message:"Thinking budget is not supported for selected model." }; } if(budget<cap.minBudget||budget>cap.maxBudget){ return { ok:false, message:"Thinking budget must be between "+cap.minBudget+" and "+cap.maxBudget+"." }; } } return { ok:true, value:{ temperature:temp, maxOutputTokens:maxOut, thinkingMode:mode, thinkingBudget:budget } }; }' +
    'function save(){' +
      'var key=document.getElementById("apiKey").value;' +
      'var modelId=document.getElementById("model").value;' +
      'var cfg=validateConfig();' +
      'if(!forUpdate&&(!key||!key.trim())){document.getElementById("status").innerText="Please enter an API key.";return;}' +
      'if(!cfg.ok){document.getElementById("status").innerText=cfg.message;return;}' +
      'document.getElementById("status").innerText="Saving\\u2026";' +
      'document.getElementById("saveBtn").disabled=true;' +
      'google.script.run' +
        '.withSuccessHandler(function(r){' +
          'if(r&&r.ok){ if(forUpdate){ document.getElementById("status").innerText="Saved."; document.getElementById("status").style.color="green"; setTimeout(function(){ google.script.host.close(); }, 800); } else { startTranscription(); } }' +
          'else{ document.getElementById("status").innerText=(r&&r.message)||"Failed to save."; document.getElementById("saveBtn").disabled=false; }' +
        '})' +
        '.withFailureHandler(function(err){ document.getElementById("status").innerText=err.message||String(err); document.getElementById("saveBtn").disabled=false; })' +
        '.saveApiKeyAndModel(key, modelId, cfg.value);' +
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
    'populateFromState();' +
    '</script></body></html>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(500), dialogTitle);
}

/** Opens Setup AI dialog from the Extension menu (key optional, save and close). */
function showSetupApiKeyAndModelDialog() {
  showApiKeyDialog(true);
}

/**
 * Saves the API key to User Properties (private per Google account). Called from the API key dialog.
 */
function saveApiKey(key) {
  return saveApiKeyAndModel(key, null, null);
}

/**
 * Saves API key and/or model ID. Key or modelId can be null to leave unchanged.
 */
function saveApiKeyAndModel(key, modelId, requestConfig) {
  var modelSelected = (modelId && typeof modelId === 'string' && modelId.trim() !== '') ? modelId.trim() : null;
  var props = PropertiesService.getUserProperties();
  var effectiveModel = modelSelected || getStoredModel();
  var validatedConfig = validateRequestConfig(requestConfig || getStoredRequestConfig(effectiveModel), effectiveModel);
  if (!validatedConfig.ok) {
    logObsEvent('setup_action', {
      operation: 'setup',
      status: 'error',
      action: 'save_key_model',
      modelSelected: modelSelected,
      errorCode: 'UNKNOWN',
      errorMessage: validatedConfig.message
    });
    return { ok: false, message: validatedConfig.message };
  }
  if (key && typeof key === 'string' && key.trim() !== '') {
    props.setProperty(API_KEY_PROPERTY, key.trim());
    Logger.log('saveApiKeyAndModel: key saved');
  }
  if (modelId && typeof modelId === 'string' && modelId.trim() !== '') {
    props.setProperty(MODEL_ID_PROPERTY, modelId.trim());
    Logger.log('saveApiKeyAndModel: model saved ' + modelId.trim());
  }
  props.setProperty(REQUEST_TEMPERATURE_PROPERTY, String(validatedConfig.value.temperature));
  props.setProperty(REQUEST_MAX_OUTPUT_TOKENS_PROPERTY, String(validatedConfig.value.maxOutputTokens));
  props.setProperty(REQUEST_THINKING_MODE_PROPERTY, String(validatedConfig.value.thinkingMode));
  if (validatedConfig.value.thinkingBudget === null || validatedConfig.value.thinkingBudget === undefined) {
    props.deleteProperty(REQUEST_THINKING_BUDGET_PROPERTY);
  } else {
    props.setProperty(REQUEST_THINKING_BUDGET_PROPERTY, String(validatedConfig.value.thinkingBudget));
  }
  logObsEvent('setup_action', {
    operation: 'setup',
    status: 'success',
    action: 'save_key_model',
    modelSelected: modelSelected,
    keyUpdated: !!(key && typeof key === 'string' && key.trim() !== ''),
    temperature: validatedConfig.value.temperature,
    maxOutputTokens: validatedConfig.value.maxOutputTokens,
    thinkingMode: validatedConfig.value.thinkingMode,
    thinkingBudget: validatedConfig.value.thinkingBudget
  });
  return { ok: true };
}

/**
 * Saves only the model ID (called from Settings dialog).
 */
function saveModel(modelId) {
  if (!modelId || typeof modelId !== 'string' || modelId.trim() === '') {
    logObsEvent('setup_action', {
      operation: 'setup',
      status: 'error',
      action: 'save_model',
      errorCode: 'UNKNOWN',
      errorMessage: 'model missing'
    });
    return { ok: false, message: 'Please select a model.' };
  }
  PropertiesService.getUserProperties().setProperty(MODEL_ID_PROPERTY, modelId.trim());
  Logger.log('saveModel: model saved ' + modelId.trim());
  logObsEvent('setup_action', {
    operation: 'setup',
    status: 'success',
    action: 'save_model',
    modelSelected: modelId.trim()
  });
  return { ok: true };
}

/**
 * Clears the stored API key so the user will be prompted again on next Transcribe.
 */
function clearApiKey() {
  PropertiesService.getUserProperties().deleteProperty(API_KEY_PROPERTY);
  Logger.log('clearApiKey: key cleared');
  logObsEvent('setup_action', {
    operation: 'setup',
    status: 'success',
    action: 'clear_key'
  });
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
  var runId = createRunId('tx');
  var operationStartMs = Date.now();
  var operation = 'transcribe_single';
  var entrypoint = 'menu_dialog';
  var doc = DocumentApp.getActiveDocument();
  var docIdHash = hashId(doc && doc.getId ? doc.getId() : null);
  var apiKey = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'UNKNOWN',
      errorMessage: 'API key not set'
    });
    return { ok: false, message: 'API key not set. Run Transcribe Image to set your key.' };
  }
  logObsEvent('transcribe_image_start', {
    operation: operation,
    entrypoint: entrypoint,
    status: 'start',
    runId: runId,
    docIdHash: docIdHash
  });
  var selection = doc.getSelection();
  if (!selection) {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'DOC_SELECTION_INVALID',
      errorMessage: 'no selection'
    });
    return { ok: false, message: 'Please select a single image and run Transcribe Image again.' };
  }
  var rangeElements = selection.getRangeElements();
  if (!rangeElements || rangeElements.length !== 1) {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'DOC_SELECTION_INVALID',
      errorMessage: 'selection must contain exactly one range element'
    });
    return { ok: false, message: 'Please select exactly one image.' };
  }
  var element = rangeElements[0].getElement();
  if (element.getType() !== DocumentApp.ElementType.INLINE_IMAGE) {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'DOC_SELECTION_INVALID',
      errorMessage: 'selected element is not inline image'
    });
    return { ok: false, message: 'Please click on the metric book image to select it, then run Transcribe Image.' };
  }
  var inlineImage = element.asInlineImage();
  var blob = inlineImage.getBlob();
  var mimeType = blob.getContentType() || 'image/png';
  if (mimeType.indexOf('image/') !== 0) mimeType = 'image/png';
  var context = getContextFromDocument(doc);
  var prompt = buildPrompt(context);
  var geminiResult;
  try {
    geminiResult = callGemini(apiKey, prompt, blob, mimeType, {
      runId: runId,
      operation: operation,
      entrypoint: entrypoint,
      docIdHash: docIdHash
    });
  } catch (e) {
    Logger.log('runTranscribeWorker: callGemini threw ' + (e.message || String(e)));
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: classifyErrorCode(e.message || String(e)),
      errorMessage: sanitizeErrorMessage(e.message || String(e))
    });
    return { ok: false, message: 'Request failed: ' + (e.message || String(e)) };
  }
  var transcription = geminiResult.text;
  if (!transcription || transcription.trim() === '') {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'API_EMPTY_CANDIDATES',
      errorMessage: 'API returned no text'
    });
    return { ok: false, message: 'The API returned no text. Try again or check the image.' };
  }
  var elementContainingImage = inlineImage.getParent();
  while (elementContainingImage.getType() !== DocumentApp.ElementType.PARAGRAPH &&
         elementContainingImage.getType() !== DocumentApp.ElementType.LIST_ITEM) {
    elementContainingImage = elementContainingImage.getParent();
  }
  var insertedCount = insertTranscriptionAfter(doc, elementContainingImage, transcription);
  Logger.log('runTranscribeWorker: done');
  logObsEvent('transcribe_image_done', {
    operation: operation,
    entrypoint: entrypoint,
    status: 'success',
    runId: runId,
    docIdHash: docIdHash,
    model: geminiResult.model,
    imageBytes: geminiResult.imageBytes,
    promptTokens: geminiResult.promptTokens,
    outputTokens: geminiResult.outputTokens,
    totalTokens: geminiResult.totalTokens,
    thoughtTokens: geminiResult.thoughtTokens,
    estimatedCostUsd: geminiResult.estimatedCostUsd,
    pricingVersion: geminiResult.pricingVersion,
    finishReason: geminiResult.finishReason,
    insertedCount: insertedCount || 0,
    apiLatencyMs: geminiResult.apiLatencyMs,
    apiLatencySec: geminiResult.apiLatencyMs ? Number((geminiResult.apiLatencyMs / 1000).toFixed(3)) : null,
    latencyMs: Date.now() - operationStartMs
    ,
    latencySec: Number(((Date.now() - operationStartMs) / 1000).toFixed(3))
  });
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

var HELP_URL = 'https://geneascript.com/USER_GUIDE.html';
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

function buildContextExtractionPrompt() {
  return getContextExtractionPromptTemplate();
}

function parseContextExtractionResponse(responseText) {
  var raw = String(responseText || '').trim();
  if (!raw) throw new Error('Empty model response.');
  try {
    return JSON.parse(raw);
  } catch (_e1) {}

  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch (_e2) {}
  }

  var first = raw.indexOf('{');
  var last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    var candidate = raw.substring(first, last + 1);
    try {
      return JSON.parse(candidate);
    } catch (_e3) {}
  }
  throw new Error('Could not parse JSON from model response.');
}

function normalizeStringList(value) {
  if (!value) return [];
  var list = [];
  if (Array.isArray(value)) {
    list = value;
  } else if (typeof value === 'string') {
    list = value.split(/\r?\n|,/);
  } else {
    list = [String(value)];
  }
  var seen = {};
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var v = String(list[i] || '').trim();
    if (!v) continue;
    var key = v.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    out.push(v);
  }
  return out;
}

function normalizeExtractedContext(raw) {
  raw = raw || {};
  var archiveName = String(raw.archiveName || raw.archive_name || '').trim();
  var archiveReference = String(raw.archiveReference || raw.archive_reference || '').trim();
  var documentDescription = String(raw.documentDescription || raw.document_description || raw.documentType || '').trim();
  var dateRange = String(raw.dateRange || raw.date_range || '').trim();
  var villages = normalizeStringList(raw.villages || raw.main_villages || raw.additional_villages);
  var commonSurnames = normalizeStringList(raw.commonSurnames || raw.common_surnames);
  var notes = String(raw.notes || '').trim();

  return {
    archiveName: archiveName,
    archiveReference: archiveReference,
    documentDescription: documentDescription,
    dateRange: dateRange,
    villages: villages,
    commonSurnames: commonSurnames,
    notes: notes
  };
}

function getContextRange(body) {
  var numChildren = body.getNumChildren();
  var start = -1;
  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    if (child.asParagraph().getText().trim() === CONTEXT_HEADING) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  var end = numChildren - 1;
  for (var j = start + 1; j < numChildren; j++) {
    var el = body.getChild(j);
    if (el.getType() === DocumentApp.ElementType.PAGE_BREAK) {
      end = j - 1;
      break;
    }
    if (el.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var p = el.asParagraph();
      var heading = p.getHeading();
      // End Context before any new section heading.
      if (heading !== DocumentApp.ParagraphHeading.NORMAL &&
          heading !== DocumentApp.ParagraphHeading.HEADING1) {
        end = j - 1;
        break;
      }
      if (heading === DocumentApp.ParagraphHeading.HEADING1 &&
          p.getText().trim() !== CONTEXT_HEADING) {
        end = j - 1;
        break;
      }
      // Page break/inline image may be inside a paragraph child, not body-level.
      for (var k = 0; k < p.getNumChildren(); k++) {
        var childType = p.getChild(k).getType();
        if (childType === DocumentApp.ElementType.PAGE_BREAK ||
            childType === DocumentApp.ElementType.INLINE_IMAGE) {
          end = j - 1;
          j = numChildren; // break outer loop
          break;
        }
      }
    }
  }
  return { start: start, end: end };
}

function setBoldLabelParagraphText(paragraph, label, value) {
  var textValue = label + ': ' + (value || '');
  paragraph.setText(textValue);
  var txt = paragraph.editAsText();
  txt.setBold(0, label.length - 1, true);
}

function normalizeContextLabelPrefix(text) {
  var t = String(text || '').trim();
  t = t.replace(/^\*+/, '').replace(/\*+:/, ':').replace(/\*+$/, '');
  var colon = t.indexOf(':');
  if (colon < 0) return t.toUpperCase();
  return t.substring(0, colon).trim().toUpperCase();
}

function upsertLabeledField(body, range, label, value) {
  if (!value) return false;
  var normalizedTarget = String(label || '').toUpperCase();
  for (var i = range.start + 1; i <= range.end; i++) {
    var el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var p = el.asParagraph();
    var text = p.getText().trim();
    if (normalizeContextLabelPrefix(text) === normalizedTarget) {
      setBoldLabelParagraphText(p, label, value);
      return true;
    }
  }
  var insertAt = range.end + 1;
  var para = body.insertParagraph(insertAt, label + ': ' + value);
  setBoldLabelParagraphText(para, label, value);
  range.end++;
  return true;
}

function locateSectionLabel(body, range, label) {
  var normalizedTarget = String(label || '').toUpperCase();
  for (var i = range.start + 1; i <= range.end; i++) {
    var el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var text = el.asParagraph().getText().trim();
    if (normalizeContextLabelPrefix(text) === normalizedTarget) return i;
  }
  return -1;
}

function isKnownContextLabel(text) {
  var key = normalizeContextLabelPrefix(text);
  return key === 'ARCHIVE_NAME' ||
    key === 'ARCHIVE_REFERENCE' ||
    key === 'DOCUMENT_DESCRIPTION' ||
    key === 'DATE_RANGE' ||
    key === 'VILLAGES' ||
    key === 'COMMON_SURNAMES';
}

function normalizeLeadingContextBlankLines(body, range) {
  var firstContentIndex = -1;
  var blankIndexes = [];
  for (var i = range.start + 1; i <= range.end; i++) {
    var el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) {
      firstContentIndex = i;
      break;
    }
    var txt = el.asParagraph().getText();
    if (String(txt || '').trim() === '') {
      blankIndexes.push(i);
      continue;
    }
    firstContentIndex = i;
    break;
  }

  if (firstContentIndex < 0) return;

  if (blankIndexes.length === 0) {
    body.insertParagraph(range.start + 1, ' ');
    return;
  }

  // Keep exactly one leading blank paragraph.
  for (var j = blankIndexes.length - 1; j >= 1; j--) {
    body.removeChild(body.getChild(blankIndexes[j]));
  }
  body.getChild(blankIndexes[0]).asParagraph().setText(' ');
}

function mergeSectionListItems(body, range, sectionLabel, values) {
  if (!values || values.length === 0) return 0;
  var labelIndex = locateSectionLabel(body, range, sectionLabel);
  if (labelIndex < 0) {
    labelIndex = range.end + 1;
    var labelPara = body.insertParagraph(labelIndex, sectionLabel + ':');
    var labelText = labelPara.editAsText();
    labelText.setBold(0, sectionLabel.length - 1, true);
    range.end++;
  }

  var nextSectionStart = range.end + 1;
  for (var i = labelIndex + 1; i <= range.end; i++) {
    var el = body.getChild(i);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var t = el.asParagraph().getText();
    if (isKnownContextLabel(t)) {
      nextSectionStart = i;
      break;
    }
  }

  var itemIndexes = [];
  for (var j = labelIndex + 1; j < nextSectionStart; j++) {
    var itemEl = body.getChild(j);
    if (itemEl.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    itemIndexes.push(j);
  }

  var inserted = 0;
  var updateCount = Math.min(itemIndexes.length, values.length);
  for (var k = 0; k < updateCount; k++) {
    var existingIdx = itemIndexes[k];
    var value = String(values[k] || '').trim();
    if (!value) continue;
    body.getChild(existingIdx).asParagraph().setText(value);
  }

  var insertAt = labelIndex + 1 + itemIndexes.length;
  for (var m = itemIndexes.length; m < values.length; m++) {
    var extra = String(values[m] || '').trim();
    if (!extra) continue;
    body.insertParagraph(insertAt, extra);
    insertAt++;
    inserted++;
    range.end++;
  }

  // Clear any extra old rows if there were more existing items than new values.
  for (var n = values.length; n < itemIndexes.length; n++) {
    var staleIdx = itemIndexes[n];
    // Apps Script may throw on empty text writes in some document states.
    body.getChild(staleIdx).asParagraph().setText(' ');
  }

  return inserted;
}

function upsertContextFields(doc, extracted) {
  ensureContextBlock(doc);
  var body = doc.getBody();
  var range = getContextRange(body);
  if (!range) throw new Error('Context section is missing.');

  var updated = [];
  if (upsertLabeledField(body, range, 'ARCHIVE_NAME', extracted.archiveName)) updated.push('ARCHIVE_NAME');
  if (upsertLabeledField(body, range, 'ARCHIVE_REFERENCE', extracted.archiveReference)) updated.push('ARCHIVE_REFERENCE');
  if (upsertLabeledField(body, range, 'DOCUMENT_DESCRIPTION', extracted.documentDescription)) updated.push('DOCUMENT_DESCRIPTION');
  if (upsertLabeledField(body, range, 'DATE_RANGE', extracted.dateRange)) updated.push('DATE_RANGE');
  if (mergeSectionListItems(body, range, 'VILLAGES', extracted.villages) > 0) updated.push('VILLAGES');
  if (mergeSectionListItems(body, range, 'COMMON_SURNAMES', extracted.commonSurnames) > 0) updated.push('COMMON_SURNAMES');
  if (extracted.notes) {
    body.insertParagraph(range.end + 1, 'Notes: ' + extracted.notes);
    updated.push('NOTES');
  }
  normalizeLeadingContextBlankLines(body, range);
  return updated;
}

function resolveImageBodyIndexByLabel(label) {
  var target = String(label || '').trim();
  if (!target) return null;
  var response = getImageList();
  if (!response || !response.ok || !response.images) return null;
  for (var i = 0; i < response.images.length; i++) {
    var img = response.images[i];
    if (String(img.label || '').trim() === target) {
      return img.index;
    }
  }
  return null;
}

function extractContextFromImage(bodyIndex, expectedLabel) {
  var runId = createRunId('ctx');
  var doc = DocumentApp.getActiveDocument();
  var docIdHash = hashId(doc && doc.getId ? doc.getId() : null);
  var apiKey = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') return { ok: false, message: 'API key not set. Use Setup AI first.' };

  logObsEvent('context_extract_start', {
    operation: 'context_extract',
    status: 'start',
    runId: runId,
    docIdHash: docIdHash,
    bodyIndex: bodyIndex
  });

  var effectiveBodyIndex = bodyIndex;
  var hit = findInlineImageAtBodyIndex(doc, effectiveBodyIndex);
  if (!hit && expectedLabel) {
    var resolved = resolveImageBodyIndexByLabel(expectedLabel);
    if (typeof resolved === 'number' && !isNaN(resolved)) {
      effectiveBodyIndex = resolved;
      hit = findInlineImageAtBodyIndex(doc, effectiveBodyIndex);
    }
  }
  if (!hit) return { ok: false, message: 'No image found at body index ' + bodyIndex + '.' };
  var blob = hit.inlineImage.getBlob();
  var mimeType = blob.getContentType() || 'image/png';
  if (mimeType.indexOf('image/') !== 0) mimeType = 'image/png';

  try {
    var geminiResult = callGemini(apiKey, buildContextExtractionPrompt(), blob, mimeType, {
      runId: runId,
      operation: 'context_extract',
      entrypoint: 'context_dialog',
      docIdHash: docIdHash
    });
    var parsed = parseContextExtractionResponse(geminiResult.text);
    var extracted = normalizeExtractedContext(parsed);
    logObsEvent('context_extract_done', {
      operation: 'context_extract',
      status: 'success',
      runId: runId,
      docIdHash: docIdHash,
      bodyIndex: effectiveBodyIndex,
      finishReason: geminiResult.finishReason
    });
    return {
      ok: true,
      extracted: extracted,
      rawModelText: geminiResult.text,
      finishReason: geminiResult.finishReason
    };
  } catch (e) {
    var message = e.message || String(e);
    logObsEvent('context_extract_error', {
      operation: 'context_extract',
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      bodyIndex: bodyIndex,
      errorCode: classifyErrorCode(message),
      errorMessage: sanitizeErrorMessage(message)
    });
    return { ok: false, message: message };
  }
}

function applyExtractedContext(extracted) {
  var runId = createRunId('ctx_apply');
  var doc = DocumentApp.getActiveDocument();
  var docIdHash = hashId(doc && doc.getId ? doc.getId() : null);
  try {
    var normalized = normalizeExtractedContext(extracted || {});
    var updatedFields = upsertContextFields(doc, normalized);
    logObsEvent('context_apply_done', {
      operation: 'context_apply',
      status: 'success',
      runId: runId,
      docIdHash: docIdHash,
      updatedFields: updatedFields
    });
    return { ok: true, updatedFields: updatedFields };
  } catch (e) {
    var message = e.message || String(e);
    logObsEvent('context_apply_error', {
      operation: 'context_apply',
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: classifyErrorCode(message),
      errorMessage: sanitizeErrorMessage(message)
    });
    return { ok: false, message: message };
  }
}

/**
 * Calls the Gemini API with the given prompt and image.
 * Returns { text: string, finishReason: string }.
 */
function callGemini(apiKey, prompt, imageBlob, mimeType, telemetry) {
  telemetry = telemetry || {};
  var apiStartMs = Date.now();
  var modelId = getStoredModel();
  var requestConfig = getStoredRequestConfig(modelId);
  var generationConfig = buildGenerationConfigFromSettings(modelId, requestConfig);
  var imageBytesArr = imageBlob.getBytes();
  var imageBytes = imageBytesArr.length;
  Logger.log('callGemini: start, model=' + modelId + ', prompt length=' + (prompt ? prompt.length : 0) + ', image size=' + imageBytes);
  logObsEvent('transcribe_image_api_start', {
    operation: telemetry.operation || 'transcribe_single',
    entrypoint: telemetry.entrypoint || 'unknown',
    status: 'start',
    runId: telemetry.runId || null,
    docIdHash: telemetry.docIdHash || null,
    model: modelId,
    temperature: requestConfig.temperature,
    maxOutputTokens: requestConfig.maxOutputTokens,
    thinkingMode: requestConfig.thinkingMode,
    thinkingBudget: requestConfig.thinkingBudget,
    promptLength: prompt ? prompt.length : 0,
    imageBytes: imageBytes
  });
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelId + ':generateContent?key=' + encodeURIComponent(apiKey);
  var base64Data = Utilities.base64Encode(imageBytesArr);

  var parts = [
    { inline_data: { mime_type: mimeType, data: base64Data } },
    { text: prompt }
  ];

  var payload = {
    contents: [{ parts: parts }],
    generationConfig: generationConfig
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
    logObsEvent('transcribe_image_api_error', {
      operation: telemetry.operation || 'transcribe_single',
      entrypoint: telemetry.entrypoint || 'unknown',
      status: 'error',
      runId: telemetry.runId || null,
      docIdHash: telemetry.docIdHash || null,
      model: modelId,
      httpCode: code,
      apiLatencyMs: Date.now() - apiStartMs,
      errorCode: classifyErrorCode(msg, code),
      errorMessage: sanitizeErrorMessage(msg)
    });
    throw new Error(msg + ' (HTTP ' + code + ')');
  }

  var json = JSON.parse(text);
  if (!json.candidates || json.candidates.length === 0) {
    var feedback = (json.promptFeedback && json.promptFeedback.blockReason) ? json.promptFeedback.blockReason : 'No candidates returned';
    Logger.log('callGemini: no candidates, feedback=' + feedback);
    logObsEvent('transcribe_image_api_error', {
      operation: telemetry.operation || 'transcribe_single',
      entrypoint: telemetry.entrypoint || 'unknown',
      status: 'error',
      runId: telemetry.runId || null,
      docIdHash: telemetry.docIdHash || null,
      model: modelId,
      httpCode: code,
      apiLatencyMs: Date.now() - apiStartMs,
      errorCode: 'API_EMPTY_CANDIDATES',
      errorMessage: sanitizeErrorMessage(feedback)
    });
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
  var promptTokens = usage.promptTokenCount || null;
  var outputTokens = usage.candidatesTokenCount || null;
  var totalTokens = usage.totalTokenCount || null;
  var thoughtTokens = usage.thoughtsTokenCount || null;
  var estimatedCostUsd = estimateGeminiCostUsd(modelId, promptTokens, outputTokens);
  var imageKBytes = Number((imageBytes / 1024).toFixed(3));
  logObsEvent('transcribe_image_api_done', {
    operation: telemetry.operation || 'transcribe_single',
    entrypoint: telemetry.entrypoint || 'unknown',
    status: 'success',
    runId: telemetry.runId || null,
    docIdHash: telemetry.docIdHash || null,
    model: modelId,
    finishReason: finishReason,
    promptTokens: promptTokens,
    outputTokens: outputTokens,
    totalTokens: totalTokens,
    thoughtTokens: thoughtTokens,
    estimatedCostUsd: estimatedCostUsd,
    pricingVersion: GEMINI_PRICING_VERSION,
    imageBytes: imageBytes,
    imageKBytes: imageKBytes,
    apiLatencyMs: Date.now() - apiStartMs
    ,
    apiLatencySec: Number(((Date.now() - apiStartMs) / 1000).toFixed(3))
  });
  return {
    text: result,
    finishReason: finishReason,
    model: modelId,
    promptTokens: promptTokens,
    outputTokens: outputTokens,
    totalTokens: totalTokens,
    thoughtTokens: thoughtTokens,
    estimatedCostUsd: estimatedCostUsd,
    pricingVersion: GEMINI_PRICING_VERSION,
    imageBytes: imageBytes,
    imageKBytes: imageKBytes,
    apiLatencyMs: Date.now() - apiStartMs
    ,
    apiLatencySec: Number(((Date.now() - apiStartMs) / 1000).toFixed(3))
  };
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
  var count = insertFormattedText(body, insertIndex + 1, text);
  Logger.log('insertTranscriptionAfter: done, insertedCount=' + count);
  return count;
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
  currentIndex++;
  return currentIndex - startIndex;
}

// ---------------------------------------------------------------------------
// Card Service — homepage card for the right-side panel icon
// ---------------------------------------------------------------------------

function buildHomepageCard() {
  var action = CardService.newAction().setFunctionName('openSidebarFromCard');
  var button = CardService.newTextButton()
    .setText('Open Transcriber Sidebar')
    .setOnClickAction(action);
  var section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText(
      'Use the sidebar for batch transcription, import, and setup.'))
    .addWidget(button);
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle('GeneaScript Metric Book Transcriber'))
    .addSection(section)
    .build();
}

function openSidebarFromCard() {
  showTranscribeSidebar();
  return CardService.newActionResponseBuilder().build();
}

// ---------------------------------------------------------------------------
// Sidebar — image list, batch transcribe support
// ---------------------------------------------------------------------------

/** Returns true if the user has stored a Gemini API key. Called from sidebar on load. */
function hasApiKey() {
  var key = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  return !!(key && key.trim());
}

/**
 * Finds the INLINE_IMAGE element inside a body-level paragraph at the given index.
 * Returns { inlineImage, container } or null if the index is stale or has no image.
 */
function findInlineImageAtBodyIndex(doc, bodyIndex) {
  var body = doc.getBody();
  if (bodyIndex < 0 || bodyIndex >= body.getNumChildren()) return null;
  var child = body.getChild(bodyIndex);
  if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) return null;
  var para = child.asParagraph();
  for (var j = 0; j < para.getNumChildren(); j++) {
    if (para.getChild(j).getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      return { inlineImage: para.getChild(j).asInlineImage(), container: para };
    }
  }
  return null;
}

/**
 * Heuristic: checks whether a transcription block has already been inserted below
 * the image at bodyIndex. Looks at the next non-empty paragraph for known output markers.
 */
function hasTranscriptionBelow(doc, bodyIndex) {
  var body = doc.getBody();
  for (var offset = 1; offset <= 3; offset++) {
    var idx = bodyIndex + offset;
    if (idx >= body.getNumChildren()) break;
    var el = body.getChild(idx);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var text = el.asParagraph().getText().trim();
    if (text.length === 0) continue;
    return text.indexOf('Page Header') !== -1 ||
           text.indexOf('Address:') !== -1 ||
           text.indexOf('Quality Metrics:') !== -1 ||
           text.indexOf('Year:') !== -1;
  }
  return false;
}

/**
 * Scans the document body for inline images and returns metadata for the sidebar.
 * Label is the nearest preceding HEADING2, or "Image N" fallback.
 */
function getImageList() {
  Logger.log('getImageList: start');
  var doc = DocumentApp.getActiveDocument();
  var body = doc.getBody();
  var numChildren = body.getNumChildren();
  var images = [];
  var imageCounter = 0;
  var lastHeading2 = '';

  for (var i = 0; i < numChildren; i++) {
    var child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var para = child.asParagraph();
    if (para.getHeading() === DocumentApp.ParagraphHeading.HEADING2) {
      lastHeading2 = para.getText().trim();
    }
    for (var j = 0; j < para.getNumChildren(); j++) {
      if (para.getChild(j).getType() === DocumentApp.ElementType.INLINE_IMAGE) {
        imageCounter++;
        images.push({
          index: i,
          label: lastHeading2 || ('Image ' + imageCounter),
          hasTranscription: hasTranscriptionBelow(doc, i)
        });
        break;
      }
    }
  }

  Logger.log('getImageList: found ' + images.length + ' images');
  return { ok: true, images: images };
}

/**
 * Transcribes one inline image identified by its body child index.
 * Phase 3 stub — returns mock success after a short delay.
 * Real implementation will be wired in Phase 4.
 */
function transcribeImageByIndex(bodyIndex, expectedLabel) {
  Logger.log('transcribeImageByIndex: bodyIndex=' + bodyIndex);
  var runId = createRunId('tx');
  var operationStartMs = Date.now();
  var operation = 'transcribe_single';
  var entrypoint = 'sidebar';
  var apiKey = PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY);
  var doc = DocumentApp.getActiveDocument();
  var docIdHash = hashId(doc && doc.getId ? doc.getId() : null);
  if (!apiKey || apiKey.trim() === '') {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      errorCode: 'UNKNOWN',
      errorMessage: 'API key not set'
    });
    return { ok: false, message: 'API key not set. Use Setup AI first.' };
  }
  logObsEvent('transcribe_image_start', {
    operation: operation,
    entrypoint: entrypoint,
    status: 'start',
    runId: runId,
    docIdHash: docIdHash,
    bodyIndex: bodyIndex
  });
  var effectiveBodyIndex = bodyIndex;
  var hit = findInlineImageAtBodyIndex(doc, effectiveBodyIndex);
  if (!hit && expectedLabel) {
    var resolvedIndex = resolveImageBodyIndexByLabel(expectedLabel);
    if (typeof resolvedIndex === 'number' && !isNaN(resolvedIndex)) {
      effectiveBodyIndex = resolvedIndex;
      hit = findInlineImageAtBodyIndex(doc, effectiveBodyIndex);
    }
  }
  if (!hit) {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      bodyIndex: bodyIndex,
      errorCode: 'DOC_IMAGE_NOT_FOUND',
      errorMessage: 'No image found at provided body index'
    });
    return { ok: false, message: 'No image found at body index ' + bodyIndex + '. Refresh the image list and try again.' };
  }

  var blob = hit.inlineImage.getBlob();
  var mimeType = blob.getContentType() || 'image/png';
  if (mimeType.indexOf('image/') !== 0) mimeType = 'image/png';

  var context = getContextFromDocument(doc);
  var prompt = buildPrompt(context);

  var geminiResult;
  try {
    geminiResult = callGemini(apiKey, prompt, blob, mimeType, {
      runId: runId,
      operation: operation,
      entrypoint: entrypoint,
      docIdHash: docIdHash
    });
  } catch (e) {
    Logger.log('transcribeImageByIndex: callGemini threw ' + (e.message || String(e)));
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      bodyIndex: effectiveBodyIndex,
      errorCode: classifyErrorCode(e.message || String(e)),
      errorMessage: sanitizeErrorMessage(e.message || String(e))
    });
    return { ok: false, message: 'API error: ' + (e.message || String(e)) };
  }

  var transcription = geminiResult.text;
  if (!transcription || transcription.trim() === '') {
    logObsEvent('transcribe_image_error', {
      operation: operation,
      entrypoint: entrypoint,
      status: 'error',
      runId: runId,
      docIdHash: docIdHash,
      bodyIndex: effectiveBodyIndex,
      errorCode: 'API_EMPTY_CANDIDATES',
      errorMessage: 'The API returned no text'
    });
    return { ok: false, message: 'The API returned no text (finishReason=' + geminiResult.finishReason + ').' };
  }

  var insertedCount = insertTranscriptionAfter(doc, hit.container, transcription);
  Logger.log('transcribeImageByIndex: done, finishReason=' + geminiResult.finishReason + ', insertedCount=' + insertedCount);
  logObsEvent('transcribe_image_done', {
    operation: operation,
    entrypoint: entrypoint,
    status: 'success',
    runId: runId,
    docIdHash: docIdHash,
    bodyIndex: effectiveBodyIndex,
    model: geminiResult.model,
    imageBytes: geminiResult.imageBytes,
    promptTokens: geminiResult.promptTokens,
    outputTokens: geminiResult.outputTokens,
    totalTokens: geminiResult.totalTokens,
    thoughtTokens: geminiResult.thoughtTokens,
    estimatedCostUsd: geminiResult.estimatedCostUsd,
    pricingVersion: geminiResult.pricingVersion,
    finishReason: geminiResult.finishReason,
    insertedCount: insertedCount || 0,
    apiLatencyMs: geminiResult.apiLatencyMs,
    apiLatencySec: geminiResult.apiLatencyMs ? Number((geminiResult.apiLatencyMs / 1000).toFixed(3)) : null,
    latencyMs: Date.now() - operationStartMs,
    latencySec: Number(((Date.now() - operationStartMs) / 1000).toFixed(3))
  });
  return { ok: true, finishReason: geminiResult.finishReason, insertedCount: insertedCount || 0, bodyIndex: effectiveBodyIndex };
}

function openExtractContextDialog(preselectedBodyIndex, preselectedLabel) {
  var imagesResponse = getImageList();
  var images = (imagesResponse && imagesResponse.ok && imagesResponse.images) ? imagesResponse.images : [];
  var selected = (typeof preselectedBodyIndex === 'number') ? preselectedBodyIndex : '';
  var selectedLabel = String(preselectedLabel || '');
  var lockedSelection = (typeof preselectedBodyIndex === 'number' && !isNaN(preselectedBodyIndex));
  var html = '<!DOCTYPE html><html><head><base target="_top"></head><body style="font-family:Arial,sans-serif;padding:16px;">' +
    '<p style="margin:0 0 10px;font-size:12px;color:#444;">Extract metadata with AI, review fields, then apply updates to the Context section.</p>' +
    '<div id="imgWrap" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;"><label style="font-weight:bold;white-space:nowrap;">Cover Image</label><select id="imgSel" style="flex:1;padding:6px;"></select><div id="imgLabel" style="display:none;flex:1;padding:8px;border:1px solid #ddd;border-radius:4px;background:#fafafa;font-size:12px;"></div></div>' +
    '<div style="display:flex;gap:8px;justify-content:flex-start;align-items:center;margin-bottom:6px;">' +
      '<button id="extractBtn" style="min-height:34px;height:34px;padding:6px 12px;font-size:12px;background:#1a73e8;color:#fff;border:1px solid #1a73e8;border-radius:4px;cursor:pointer;">Extract</button>' +
      '<button onclick="google.script.host.close()" style="min-height:34px;height:34px;padding:6px 12px;font-size:12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer;">Cancel</button>' +
      '<button id="applyBtn" style="min-height:34px;height:34px;padding:6px 12px;font-size:12px;background:#1a73e8;color:#fff;border:1px solid #1a73e8;border-radius:4px;cursor:pointer;" disabled>Apply Context</button>' +
    '</div>' +
    '<div id="status" style="font-size:14px;font-weight:600;color:#1a73e8;margin-bottom:10px;min-height:20px;"></div>' +
    '<div id="form" style="display:none;">' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Archive name</label><input id="archiveName" style="width:100%;padding:6px;">' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Archive reference</label><input id="archiveReference" style="width:100%;padding:6px;">' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Document description</label><textarea id="documentDescription" style="width:100%;min-height:54px;padding:6px;"></textarea>' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Date range</label><input id="dateRange" style="width:100%;padding:6px;">' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Villages (one per line)</label><textarea id="villages" style="width:100%;min-height:70px;padding:6px;"></textarea>' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Common surnames (one per line)</label><textarea id="commonSurnames" style="width:100%;min-height:70px;padding:6px;"></textarea>' +
      '<label style="display:block;font-size:12px;margin-top:8px;">Notes</label><textarea id="notes" style="width:100%;min-height:52px;padding:6px;"></textarea>' +
    '</div>' +
    '<script>' +
      'var images=' + JSON.stringify(images) + ';' +
      'var preselected=' + JSON.stringify(selected) + ';' +
      'var preselectedLabel=' + JSON.stringify(selectedLabel) + ';' +
      'var locked=' + JSON.stringify(lockedSelection) + ';' +
      'function el(id){return document.getElementById(id);}' +
      'function setStatus(kind,msg){ var s=el("status"); if(kind==="error"){s.style.color="#c62828"; s.textContent="❌ "+msg;} else if(kind==="success"){s.style.color="#2e7d32"; s.textContent="✅ "+msg;} else if(kind==="progress"){s.style.color="#1a73e8"; s.textContent="🔄 "+msg;} else {s.style.color="#666"; s.textContent=msg||"";} }' +
      'function currentImageLabel(idx){if(preselectedLabel)return preselectedLabel;for(var i=0;i<images.length;i++){if(Number(images[i].index)===Number(idx))return images[i].label||("Image "+(i+1));}return "Selected image";}' +
      'function fillSelect(){var s=el("imgSel"); if(!images.length){s.innerHTML="<option value=\\"\\">No images found</option>"; el("extractBtn").disabled=true; setStatus("error","Import images first."); return;} var h=""; for(var i=0;i<images.length;i++){var m=images[i]; var sel=(String(preselected)!==""&&Number(preselected)===Number(m.index))?" selected":""; h+="<option value=\\""+m.index+"\\""+sel+">"+(m.label||("Image "+(i+1)))+"</option>";} s.innerHTML=h; if(locked){s.style.display="none"; el("imgLabel").style.display="block"; el("imgLabel").textContent=currentImageLabel(preselected);} }' +
      'function setForm(v){ el("archiveName").value=v.archiveName||""; el("archiveReference").value=v.archiveReference||""; el("documentDescription").value=v.documentDescription||""; el("dateRange").value=v.dateRange||""; el("villages").value=(v.villages||[]).join("\\n"); el("commonSurnames").value=(v.commonSurnames||[]).join("\\n"); el("notes").value=v.notes||""; }' +
      'function selectedLabelFromDropdown(){var s=el("imgSel"); if(!s||s.selectedIndex<0) return ""; return s.options[s.selectedIndex].text||"";}' +
      'function runExtract(){ var idx=locked?Number(preselected):parseInt(el("imgSel").value,10); var lbl=locked?currentImageLabel(preselected):selectedLabelFromDropdown(); if(isNaN(idx)){setStatus("error","Select a cover image."); return;} setStatus("progress","Extracting context..."); el("extractBtn").disabled=true; el("applyBtn").disabled=true; google.script.run.withSuccessHandler(function(r){ el("extractBtn").disabled=false; if(r&&r.ok){ setForm(r.extracted||{}); el("form").style.display="block"; setStatus("success","Extraction complete. Review and apply."); el("applyBtn").disabled=false; } else { setStatus("error",(r&&r.message)||"Extraction failed."); } }).withFailureHandler(function(e){ el("extractBtn").disabled=false; setStatus("error",e.message||String(e)); }).extractContextFromImage(idx, lbl); }' +
      'el("extractBtn").onclick=runExtract;' +
      'el("applyBtn").onclick=function(){ var payload={ archiveName:el("archiveName").value, archiveReference:el("archiveReference").value, documentDescription:el("documentDescription").value, dateRange:el("dateRange").value, villages:el("villages").value.split(/\\r?\\n/), commonSurnames:el("commonSurnames").value.split(/\\r?\\n/), notes:el("notes").value }; setStatus("progress","Applying context updates..."); el("applyBtn").disabled=true; google.script.run.withSuccessHandler(function(r){ if(r&&r.ok){ setStatus("success","Context updated."); setTimeout(function(){ google.script.host.close(); }, 350); } else { el("applyBtn").disabled=false; setStatus("error",(r&&r.message)||"Apply failed."); } }).withFailureHandler(function(e){ el("applyBtn").disabled=false; setStatus("error",e.message||String(e)); }).applyExtractedContext(payload); };' +
      'fillSelect(); if(locked){runExtract();}' +
    '</script>' +
    '</body></html>';
  DocumentApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(680), 'Extract Context from Cover Image');
}

function openExtractContextDialogFromSidebar(bodyIndex) {
  if (typeof bodyIndex !== 'number' || isNaN(bodyIndex)) {
    return { ok: false, message: 'Select exactly one image first.' };
  }
  var label = arguments.length > 1 ? arguments[1] : '';
  openExtractContextDialog(bodyIndex, label);
  return { ok: true };
}

/** Opens the sidebar panel. */
function showTranscribeSidebar() {
  var html = HtmlService.createHtmlOutput(getSidebarHtml())
    .setTitle('GeneaScript Metric Book Transcriber');
  DocumentApp.getUi().showSidebar(html);
}

/** Builds the full sidebar HTML string. */
function getSidebarHtml() {
  var helpUrl = HELP_URL;
  var issueUrl = ISSUE_URL;
  return [
    '<!DOCTYPE html>',
    '<html><head><base target="_top">',
    '<style>',
    '*{box-sizing:border-box;margin:0;padding:0}',
    'body{font-family:Georgia,"Times New Roman",serif;font-size:13px;color:#333;padding:12px;display:flex;flex-direction:column;min-height:100vh}',
    '.section{margin-bottom:14px}',
    '.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}',
    '.section-title{font-weight:bold;font-size:13px}',
    '.btn{padding:6px 12px;font-size:12px;border:1px solid #ccc;background:#fff;border-radius:4px;cursor:pointer}',
    '.btn:hover{background:#f5f5f5}',
    '.btn-primary{background:#1a73e8;color:#fff;border-color:#1a73e8}',
    '.btn-primary:hover{background:#1557b0}',
    '.btn-primary:disabled{background:#94c2f8;border-color:#94c2f8;cursor:default}',
    '.btn-danger{color:#c62828;border-color:#c62828}',
    '.btn-danger:hover{background:#fbe9e7}',
    '.btn-sm{padding:3px 8px;font-size:11px}',
    '.image-list{max-height:40vh;overflow-y:auto;border:1px solid #e0e0e0;border-radius:4px}',
    '.image-row{display:flex;align-items:center;padding:5px 8px;border-bottom:1px solid #f0f0f0}',
    '.image-row:last-child{border-bottom:none}',
    '.image-row label{flex:1;font-size:12px;margin-left:6px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.image-row .status{font-size:11px;margin-left:4px;flex-shrink:0}',
    '.st-done{color:#2e7d32}.st-fail{color:#c62828}.st-warn{color:#e65100}.st-active{color:#1a73e8}',
    '.select-all{display:flex;align-items:center;padding:4px 0;margin-bottom:4px;font-size:12px}',
    '.select-all label{margin-left:6px;cursor:pointer}',
    '.progress{background:#e3f2fd;border-radius:4px;padding:8px;font-size:12px;display:none}',
    '.bar{height:4px;background:#e0e0e0;border-radius:2px;margin:6px 0}',
    '.bar-fill{height:100%;background:#1a73e8;border-radius:2px;transition:width 0.3s}',
    '.banner{padding:8px;border-radius:4px;font-size:12px;margin-bottom:12px}',
    '.banner-warn{background:#fff8e1;border:1px solid #ffecb3;color:#f57f17}',
    '.banner-error{background:#fbe9e7;border:1px solid #ffccbc;color:#c62828}',
    '.actions{border-top:1px solid #e0e0e0;padding-top:10px}',
    '.action-link{display:block;padding:4px 0;font-size:12px;color:#1a73e8;text-decoration:none;cursor:pointer}',
    '.action-link:hover{text-decoration:underline}',
    '.footer{margin-top:auto;padding-top:10px;font-size:11px;color:#999;text-align:center}',
    '.empty-state{padding:20px;text-align:center;color:#999;font-size:12px}',
    '.modal-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:100}',
    '.modal{background:#fff;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,0.18);padding:20px;max-width:280px;width:90%;font-size:13px}',
    '.modal-title{font-weight:bold;font-size:13px;margin-bottom:10px}',
    '.modal-list{margin:8px 0 12px;padding-left:18px;font-size:12px;color:#555}',
    '.modal-list li{margin-bottom:2px}',
    '.modal-note{font-size:11px;color:#888;margin-bottom:14px}',
    '.modal-actions{display:flex;gap:8px;justify-content:flex-end}',
    '</style>',
    '</head><body>',

    '<div class="banner" style="background:#fffde7;border:1px solid #fff9c4;color:#6d4c00;font-size:11px;line-height:1.4">',
    '  AI transcription provides a best-guess result and may not be accurate. Always review and cross-check output against the original image.',
    '</div>',

    '<div id="keyBanner" class="banner banner-warn" style="display:none">',
    '  Set up your API key to start transcribing.',
    '  <a href="#" onclick="setupKey();return false" style="display:block;margin-top:4px">Setup AI</a>',
    '</div>',

    '<div id="errorBanner" class="banner banner-error" style="display:none"></div>',

    '<div class="section">',
    '  <button id="importBtn" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="doImport()">&#8681; Import from Drive Files</button>',
    '  <button id="setupBtn" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="setupKey()">&#9881; Setup AI</button>',
    '  <button id="extractBtnSidebar" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="extractContextFromSelected()" disabled>&#9998; Extract Context from Selected Image</button>',
    '</div>',

    '<div class="section">',
    '  <div class="section-header">',
    '    <span class="section-title">Images (<span id="imgCount">0</span>)</span>',
    '    <button class="btn btn-sm" onclick="refreshImages()" title="Refresh image list">&#8635; Refresh</button>',
    '  </div>',
    '  <div class="select-all">',
    '    <input type="checkbox" id="selAll" onchange="toggleAll(this.checked)">',
    '    <label for="selAll">Select All</label>',
    '  </div>',
    '  <div id="imgList" class="image-list">',
    '    <div class="empty-state">Loading\u2026</div>',
    '  </div>',
    '</div>',

    '<div class="section">',
    '  <button id="goBtn" class="btn btn-primary" style="width:100%;margin-bottom:6px" onclick="transcribeSelected()" disabled>&#9654; Transcribe Selected</button>',
    '  <button id="stopBtn" class="btn btn-danger" style="width:100%;display:none" onclick="stopBatch()">&#9632; Stop</button>',
    '</div>',

    '<div id="progress" class="progress section">',
    '  <div id="progText">Transcribing\u2026</div>',
    '  <div class="bar"><div class="bar-fill" id="progBar" style="width:0%"></div></div>',
    '  <div id="progDetail"></div>',
    '  <div id="progTime" style="font-size:11px;color:#666;margin-top:2px"></div>',
    '</div>',

    '<div class="section" style="font-size:12px">',
    '  <a class="action-link" href="' + helpUrl + '" target="_blank">Help / User Guide &#8599;</a>',
    '  <a class="action-link" href="' + issueUrl + '" target="_blank">Report an issue &#8599;</a>',
    '</div>',

    '<div id="confirmModal" class="modal-overlay" style="display:none">',
    '  <div class="modal">',
    '    <div class="modal-title">Replace existing transcriptions?</div>',
    '    <div id="confirmBody"></div>',
    '    <div class="modal-note">Previous text below these images will be replaced.</div>',
    '    <div class="modal-actions">',
    '      <button class="btn" id="confirmNo">Cancel</button>',
    '      <button class="btn btn-primary" id="confirmYes">Continue</button>',
    '    </div>',
    '  </div>',
    '</div>',

    '<div class="footer">v0.9.1</div>',

    '<script>',
    'var imgs=[],stopReq=false,running=false;',

    'var lastImageCount=0;',
    'function init(){',
    '  google.script.run.withSuccessHandler(function(k){',
    '    if(!k)document.getElementById("keyBanner").style.display="block";',
    '  }).withFailureHandler(function(){}).hasApiKey();',
    '  refreshImages();',
    '  setInterval(function(){',
    '    if(!running){',
    '      console.log("Polling for image list changes");',
    '      google.script.run',
    '        .withSuccessHandler(function(r){',
    '          if(r&&r.ok){',
    '            var newCount=(r.images||[]).length;',
    '            if(newCount!==lastImageCount){',
    '              console.log("Image count changed from "+lastImageCount+" to "+newCount+", refreshing");',
    '              lastImageCount=newCount;',
    '              refreshImages();',
    '            }',
    '          }',
    '        })',
    '        .withFailureHandler(function(){})',
    '        .getImageList();',
    '    }',
    '  }, 3000);',
    '}',

    'function refreshImages(){',
    '  var prev={};',
    '  for(var i=0;i<imgs.length;i++){if(imgs[i]._s)prev[imgs[i].index]={s:imgs[i]._s,e:imgs[i]._e};}',
    '  document.getElementById("imgList").innerHTML=\'<div class="empty-state">Loading\\u2026</div>\';',
    '  document.getElementById("imgCount").textContent="0";',
    '  el("goBtn").disabled=true;',
    '  google.script.run',
    '    .withSuccessHandler(function(r){',
    '      if(r&&r.ok){',
    '        imgs=r.images||[];',
    '        lastImageCount=imgs.length;',
    '        for(var j=0;j<imgs.length;j++){var p=prev[imgs[j].index];if(p){imgs[j]._s=p.s;imgs[j]._e=p.e;}}',
    '        renderList();',
    '      }else el("imgList").innerHTML=\'<div class="empty-state">Failed to load images.</div>\';',
    '    })',
    '    .withFailureHandler(function(e){',
    '      el("imgList").innerHTML=\'<div class="empty-state">Error: \'+esc(e.message||String(e))+\'</div>\';',
    '    })',
    '    .getImageList();',
    '}',

    'function renderList(){',
    '  var c=el("imgList");',
    '  el("imgCount").textContent=imgs.length;',
    '  if(!imgs.length){c.innerHTML=\'<div class="empty-state">No images found. Import scans or paste images first.</div>\';el("goBtn").disabled=true;return;}',
    '  var h="";',
    '  for(var i=0;i<imgs.length;i++){',
    '    var m=imgs[i],st="";',
    '    if(m._s==="done")st=\'<span class="status st-done">\\u2713</span>\';',
    '    else if(m._s==="fail")st=\'<span class="status st-fail" title="\'+esc(m._e||"Failed")+\'">\\u2717</span>\';',
    '    else if(m._s==="warn")st=\'<span class="status st-warn" title="Output may be truncated">\\u26A0</span>\';',
    '    else if(m._s==="active")st=\'<span class="status st-active">\\u231B</span>\';',
    '    else if(m.hasTranscription)st=\'<span class="status st-done" title="Already transcribed">\\u2713</span>\';',
    '    h+=\'<div class="image-row"><input type="checkbox" class="ic" data-i="\'+i+\'" onchange="updBtn()"\'+',
    '      (running?" disabled":"")+\'><label>\'+esc(m.label)+\'</label>\'+st+\'</div>\';',
    '  }',
    '  c.innerHTML=h;',
    '  updBtn();',
    '}',

    'function checked(){',
    '  var cx=document.querySelectorAll(".ic:checked"),a=[];',
    '  for(var i=0;i<cx.length;i++)a.push(parseInt(cx[i].getAttribute("data-i"),10));',
    '  return a;',
    '}',

    'function updBtn(){',
    '  var n=checked().length,hasKey=el("keyBanner").style.display==="none";',
    '  var b=el("goBtn");',
    '  b.disabled=n===0||!hasKey||running;',
    '  b.textContent=n>1?"\\u25B6 Transcribe Selected ("+n+")":"\\u25B6 Transcribe Selected";',
    '  var e=el("extractBtnSidebar");',
    '  e.disabled=n!==1||!hasKey||running;',
    '}',

    'function toggleAll(v){',
    '  var bx=document.querySelectorAll(".ic");',
    '  for(var i=0;i<bx.length;i++)bx[i].checked=v;',
    '  updBtn();',
    '}',

    'var _timer=null,_start=0;',
    'function fmtSec(s){var m=Math.floor(s/60);s=Math.floor(s%60);return m>0?(m+"m "+s+"s"):(s+"s");}',

    'function showConfirmModal(names,onYes){',
    '  var list="<ul class=\\"modal-list\\">"+names.map(function(n){return"<li>"+esc(n)+"</li>";}).join("")+"</ul>";',
    '  el("confirmBody").innerHTML=list;',
    '  el("confirmModal").style.display="flex";',
    '  el("confirmYes").onclick=function(){el("confirmModal").style.display="none";onYes();};',
    '  el("confirmNo").onclick=function(){el("confirmModal").style.display="none";};',
    '}',

    'function transcribeSelected(){',
    '  var ci=checked();if(!ci.length)return;',
    '  var existing=ci.filter(function(di){return imgs[di].hasTranscription;});',
    '  if(existing.length>0){',
    '    var names=existing.map(function(di){return imgs[di].label;});',
    '    showConfirmModal(names,function(){startBatch(ci);});',
    '    return;',
    '  }',
    '  startBatch(ci);',
    '}',

    'function startBatch(ci){',
    '  var tasks=ci.map(function(di){return{di:di,bi:imgs[di].index};});',
    '  tasks.sort(function(a,b){return a.bi-b.bi;});',
    '  running=true;stopReq=false;',
    '  var total=tasks.length,done=0,fail=0,shift=0;',
    '  var avgSec=0;',
    '  _start=Date.now();',
    '  el("goBtn").disabled=true;',
    '  el("stopBtn").style.display="block";',
    '  el("progress").style.display="block";',
    '  el("errorBanner").style.display="none";',
    '  freeze(true);',

    '  function tickTime(num,total){',
    '    var elapsed=(Date.now()-_start)/1000;',
    '    var eta="";',
    '    if(avgSec>0){var rem=avgSec*(total-num+1);eta=" \\u00B7 ~"+fmtSec(rem)+" left";}',
    '    else{eta=" \\u00B7 ~30s per image";}',
    '    el("progTime").textContent="Elapsed: "+fmtSec(elapsed)+eta;',
    '  }',

    '  function startTick(num,total){',
    '    tickTime(num,total);',
    '    clearInterval(_timer);',
    '    _timer=setInterval(function(){tickTime(num,total);},1000);',
    '  }',

    '  function next(ti){',
    '    if(stopReq||ti>=tasks.length){clearInterval(_timer);finish(done,fail,stopReq);return;}',
    '    var t=tasks[ti],m=imgs[t.di];',
    '    m._s="active";renderList();',
    '    var num=ti+1;',
    '    el("progText").textContent="Transcribing "+num+" of "+total+"\\u2026";',
    '    el("progDetail").textContent=m.label;',
    '    el("progBar").style.width=((num-1)/total*100)+"%";',
    '    startTick(num,total);',
    '    var imgStart=Date.now();',
    '    google.script.run',
    '      .withSuccessHandler(function(r){',
    '        var dur=(Date.now()-imgStart)/1000;',
    '        avgSec=avgSec>0?(avgSec+dur)/2:dur;',
    '        if(r&&r.ok){',
    '          m._s=(r.finishReason==="MAX_TOKENS")?"warn":"done";done++;',
    '          shift+=(r.insertedCount||0);',
    '        }else{m._s="fail";m._e=(r&&r.message)||"Unknown error";fail++;}',
    '        renderList();next(ti+1);',
    '      })',
    '      .withFailureHandler(function(e){',
    '        m._s="fail";m._e=e.message||String(e);fail++;',
    '        renderList();next(ti+1);',
    '      })',
    '      .transcribeImageByIndex(t.bi+shift, m.label);',
    '  }',
    '  next(0);',
    '}',

    'function stopBatch(){',
    '  stopReq=true;',
    '  el("stopBtn").disabled=true;',
    '  el("stopBtn").textContent="\\u25A0 Stopping\\u2026";',
    '}',

    'function finish(done,fail,stopped){',
    '  running=false;',
    '  el("stopBtn").style.display="none";',
    '  el("stopBtn").disabled=false;',
    '  el("stopBtn").textContent="\\u25A0 Stop";',
    '  var elapsed=fmtSec((Date.now()-_start)/1000);',
    '  var s="Done: "+done+" succeeded";',
    '  if(fail>0)s+=", "+fail+" failed";',
    '  if(stopped)s+=" (stopped)";',
    '  s+=" in "+elapsed;',
    '  el("progText").textContent=s;',
    '  el("progDetail").textContent="";',
    '  el("progTime").textContent="";',
    '  el("progBar").style.width="100%";',
    '  freeze(false);',
    '  setTimeout(refreshImages,1500);',
    '}',

    'function freeze(v){',
    '  var bx=document.querySelectorAll(".ic");',
    '  for(var i=0;i<bx.length;i++)bx[i].disabled=v;',
    '  el("selAll").disabled=v;',
    '}',

    'function setupKey(){google.script.run.showSetupApiKeyAndModelDialog();}',
    'function doImport(){google.script.run.withFailureHandler(function(e){ el("errorBanner").textContent=e.message||String(e); el("errorBanner").style.display="block"; }).showDrivePickerDialog();}',
    'function extractContextFromSelected(){var ci=checked(); if(ci.length!==1){el("errorBanner").textContent="Select exactly one image to extract context."; el("errorBanner").style.display="block"; return;} el("errorBanner").style.display="none"; var chosen=imgs[ci[0]]; var bodyIndex=chosen.index; var label=chosen.label||""; google.script.run.withSuccessHandler(function(r){ if(!(r&&r.ok)){el("errorBanner").textContent=(r&&r.message)||"Unable to open extract dialog."; el("errorBanner").style.display="block"; } }).withFailureHandler(function(e){el("errorBanner").textContent=e.message||String(e); el("errorBanner").style.display="block";}).openExtractContextDialogFromSidebar(bodyIndex, label);}',
    'function el(id){return document.getElementById(id);}',
    'function esc(s){return s?String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"):""}',

    'init();',
    '</script>',
    '</body></html>'
  ].join('\n');
}
