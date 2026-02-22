/**
 * GDoc Metric Book Transcriber Add-On
 * Adds menu and runs "Transcribe Image" to send selected image + context to Gemini and insert result.
 */

var MODEL_ID = 'gemini-3-flash-preview';
var API_KEY_PROPERTY = 'GEMINI_API_KEY';
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
 * Appends a paragraph: "Source Image Link" (bold): [file name as link to Drive file].
 */
function appendSourceImageLink(body, file) {
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
  var ui = DocumentApp.getUi();
  var doc = DocumentApp.getActiveDocument();
  var response = ui.prompt('Drive Folder', 'Enter the Google Drive Folder ID or URL containing the metric book scans.', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;
  var folderId = extractFolderId(response.getResponseText());
  if (!folderId) {
    ui.alert('Invalid link', 'Invalid Drive Folder link. Please check the URL.', ui.ButtonSet.OK);
    return;
  }
  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    ui.alert('Access denied', 'Cannot access folder. Please ensure the folder is shared with you or you are the owner.', ui.ButtonSet.OK);
    return;
  }
  var imageFiles = [];
  var fileIterator = folder.getFiles();
  while (fileIterator.hasNext()) {
    var file = fileIterator.next();
    var mime = file.getMimeType();
    if (IMAGE_MIME_TYPES.indexOf(mime) !== -1) imageFiles.push(file);
  }
  if (imageFiles.length === 0) {
    ui.alert('No images', 'No images found in this folder.', ui.ButtonSet.OK);
    return;
  }
  imageFiles = naturalSortFiles(imageFiles);
  if (imageFiles.length > MAX_IMPORT_IMAGES) {
    imageFiles = imageFiles.slice(0, MAX_IMPORT_IMAGES);
  }
  var count = imageFiles.length;
  ui.alert('Importing', 'Importing ' + count + ' images. Please wait...', ui.ButtonSet.OK);
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
      appendSourceImageLink(body, file);
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
  var doneMsg = 'Import complete. ' + added + ' image(s) added.';
  if (skipped > 0) {
    doneMsg += ' ' + skipped + ' skipped (invalid or too large for Docs).';
  }
  ui.alert('Done', doneMsg, ui.ButtonSet.OK);
}

/**
 * Main action: transcribe the selected metric book image using Gemini and insert result below it.
 */
function transcribeSelectedImage() {
  Logger.log('transcribeSelectedImage: start');
  var ui = DocumentApp.getUi();
  var doc = DocumentApp.getActiveDocument();

  var apiKey = PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') {
    Logger.log('transcribeSelectedImage: missing API key');
    ui.alert('Configuration', 'Please set your Google AI API key in Script Properties (Project Settings → Script properties). Add a key named ' + API_KEY_PROPERTY + '.', ui.ButtonSet.OK);
    return;
  }
  Logger.log('transcribeSelectedImage: API key present');

  var selection = doc.getSelection();
  if (!selection) {
    Logger.log('transcribeSelectedImage: no selection');
    ui.alert('Selection required', 'Please select a single image (metric book scan) and run Transcribe Image again.', ui.ButtonSet.OK);
    return;
  }

  var rangeElements = selection.getRangeElements();
  if (!rangeElements || rangeElements.length !== 1) {
    Logger.log('transcribeSelectedImage: selection count=' + (rangeElements ? rangeElements.length : 0));
    ui.alert('Selection required', 'Please select exactly one image.', ui.ButtonSet.OK);
    return;
  }

  var element = rangeElements[0].getElement();
  Logger.log('transcribeSelectedImage: element type=' + element.getType());
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
  Logger.log('transcribeSelectedImage: image blob size=' + (blob.getBytes && blob.getBytes().length) + ', mimeType=' + mimeType);

  var context = getContextFromDocument(doc);
  var prompt = buildPrompt(context);
  Logger.log('transcribeSelectedImage: context length=' + (context ? context.length : 0) + ', prompt length=' + (prompt ? prompt.length : 0));

  showAwaitingDialog(ui);
}

/**
 * Shows a modal dialog with status message and runs the transcription worker.
 * The native status bar cannot be changed; this dialog provides a clear custom status during the API call.
 */
function showAwaitingDialog(ui) {
  var html = '<!DOCTYPE html><html><head><base target="_top"></head><body style="font-family: Arial, sans-serif; padding: 16px;">' +
    '<p style="margin:0;">Awaiting response from Gemini API… This may take up to 1 minute.</p>' +
    '<script>google.script.run.withSuccessHandler(function(r){google.script.host.close();if(r&&r.ok){google.script.run.showDoneAlert();}else if(r&&!r.ok){google.script.run.showErrorAlert(r.message||"Unknown error");}})' +
    '.withFailureHandler(function(err){google.script.run.showErrorAlert(err.message||String(err));google.script.host.close();})' +
    '.runTranscribeWorker();</script></body></html>';
  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(320).setHeight(80), 'Transcribing');
}

/**
 * Called from the awaiting dialog. Performs API call and insert; returns { ok: true } or { ok: false, message: string }.
 */
function runTranscribeWorker() {
  Logger.log('runTranscribeWorker: start');
  var doc = DocumentApp.getActiveDocument();
  var apiKey = PropertiesService.getScriptProperties().getProperty(API_KEY_PROPERTY);
  if (!apiKey || apiKey.trim() === '') {
    return { ok: false, message: 'API key not set. Add ' + API_KEY_PROPERTY + ' in Script properties.' };
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
  Logger.log('callGemini: start, model=' + MODEL_ID + ', prompt length=' + (prompt ? prompt.length : 0) + ', image size=' + (imageBlob.getBytes && imageBlob.getBytes().length));
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL_ID + ':generateContent?key=' + encodeURIComponent(apiKey);
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
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    Logger.log('callGemini: empty content in candidate');
    throw new Error('Empty content in response');
  }

  var result = candidate.content.parts[0].text || '';
  Logger.log('callGemini: success, result length=' + result.length);
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
