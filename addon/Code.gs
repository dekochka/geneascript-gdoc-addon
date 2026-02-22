/**
 * GDoc Metric Book Transcriber Add-On
 * Adds menu and runs "Transcribe Image" to send selected image + context to Gemini and insert result.
 */

var MODEL_ID = 'gemini-3-flash-preview';
var API_KEY_PROPERTY = 'GEMINI_API_KEY';
var CONTEXT_HEADING = 'Context';
var MAX_CONTEXT_PARAGRAPHS = 50;

/**
 * Runs when the document is opened. Adds a custom menu.
 * When run from the script editor (no document UI), getUi() throws; we catch and skip.
 */
function onOpen() {
  try {
    DocumentApp.getUi()
      .createAddonMenu()
      .addItem('Transcribe Image', 'transcribeSelectedImage')
      .addToUi();
    Logger.log('onOpen: menu added.');
  } catch (e) {
    Logger.log('onOpen: skipped menu (no UI context, e.g. run from script editor). ' + e.message);
  }
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

  ui.alert('Transcribing', 'Sending image to Gemini. This may take up to a minute.', ui.ButtonSet.OK);

  var transcription;
  try {
    transcription = callGemini(apiKey, prompt, blob, mimeType);
  } catch (e) {
    Logger.log('transcribeSelectedImage: callGemini threw: ' + (e.message || String(e)));
    ui.alert('Error', 'Request failed: ' + (e.message || String(e)), ui.ButtonSet.OK);
    return;
  }

  if (!transcription || transcription.trim() === '') {
    Logger.log('transcribeSelectedImage: empty transcription');
    ui.alert('Empty response', 'The API returned no text. Try again or check the image.', ui.ButtonSet.OK);
    return;
  }
  Logger.log('transcribeSelectedImage: transcription length=' + transcription.length);

  var paragraphContainingImage = inlineImage.getParent();
  if (paragraphContainingImage.getType() !== DocumentApp.ElementType.PARAGRAPH) {
    paragraphContainingImage = paragraphContainingImage.getParent();
  }
  insertTranscriptionAfter(doc, paragraphContainingImage, transcription);
  Logger.log('transcribeSelectedImage: done');
  ui.alert('Done', 'Transcription inserted below the image.', ui.ButtonSet.OK);
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
 * Inserts the transcription text in a new paragraph immediately after the given paragraph.
 */
function insertTranscriptionAfter(doc, paragraphAfterWhich, text) {
  Logger.log('insertTranscriptionAfter: start, text length=' + (text ? text.length : 0));
  var body = doc.getBody();
  var numChildren = body.getNumChildren();
  var insertIndex = -1;

  for (var i = 0; i < numChildren; i++) {
    if (body.getChild(i) === paragraphAfterWhich) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex < 0) {
    Logger.log('insertTranscriptionAfter: paragraph not found in body, appending');
    body.appendParagraph(text);
    return;
  }

  Logger.log('insertTranscriptionAfter: insertIndex=' + insertIndex + ', inserting at ' + (insertIndex + 1));
  body.insertParagraph(insertIndex + 1, text);
  Logger.log('insertTranscriptionAfter: done');
}
