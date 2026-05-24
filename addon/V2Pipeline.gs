/**
 * V2 Pipeline — bridges the existing transcribe flow (Code.gs) to the new
 * schema-v2 prompt compiler and JSON output renderer.
 *
 * This file deliberately keeps the surgery on Code.gs minimal. The runtime
 * decision tree:
 *
 *   getSelectedTemplateId()
 *     ├── isV2Template?  ── yes ── compilePromptForRequest_ / parse JSON / render
 *     └── no            ── falls back to existing buildPrompt + insertFormattedText
 *
 * Public functions used by Code.gs:
 *   - isV2Template(templateId)
 *   - prepareV2Request(doc) → { promptText, responseSchema, ... } | null
 *   - getDocContext()              ← wraps the v2 context property reader
 *   - saveDocContext(values)
 *   - getDocTranslationEnabled()
 *   - setDocTranslationEnabled(enabled)
 *   - renderV2Response(doc, container, responseText, templateId) → insertedCount
 *
 * Functions used internally / by migration:
 *   - migrateContextBodyToProperties_(doc) → seeds DOC_CONTEXT from legacy "Context" heading
 */

// ---------------------------------------------------------------------------
// Template version detection
// ---------------------------------------------------------------------------

/**
 * True if the template ID corresponds to a v2 template (registered in
 * TemplateSchemaV2.gs). Custom v1 templates and legacy IDs return false.
 */
function isV2Template(templateId) {
  if (!templateId) return false;
  if (templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = (typeof resolveCustomTemplate === 'function') ? resolveCustomTemplate(templateId) : null;
    if (custom && custom.schemaVersion === SCHEMA_VERSION_V2) return true;
    return false;
  }
  return !!getRawTemplateV2(templateId);
}

/**
 * Returns the resolved v2 template object (after inheritance). For custom
 * v2 templates, treats the stored object as a child whose `parent` field
 * points at a registered template; uses resolveTemplateV2 directly.
 */
function getResolvedV2Template_(templateId) {
  if (!templateId) return null;
  if (templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = (typeof resolveCustomTemplate === 'function') ? resolveCustomTemplate(templateId) : null;
    if (!custom || custom.schemaVersion !== SCHEMA_VERSION_V2) return null;
    return resolveTemplateV2(custom);
  }
  return resolveTemplateV2(templateId);
}

// ---------------------------------------------------------------------------
// Document Context (Document Properties storage)
// ---------------------------------------------------------------------------

/**
 * Loads the document context object from Document Properties.
 * Returns an empty object if no context has been saved.
 *
 * On first read, attempts a one-time migration from the legacy "Context"
 * heading text in the document body (best-effort parsing of "**LABEL**: value"
 * lines into structured fields).
 */
function getDocContext() {
  var props = PropertiesService.getDocumentProperties();
  var raw = props.getProperty(DOC_CONTEXT_PROPERTY);
  if (raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (e) {
      Logger.log('getDocContext: parse error, treating as empty: ' + e.message);
    }
  }
  // First-read migration from legacy Context heading.
  try {
    var doc = DocumentApp.getActiveDocument();
    if (doc) {
      var migrated = migrateContextBodyToProperties_(doc);
      if (migrated) return migrated;
    }
  } catch (mErr) {
    Logger.log('getDocContext: migration attempt failed: ' + mErr.message);
  }
  return {};
}

/**
 * Saves a context-values object to Document Properties as JSON.
 * Strips empty / whitespace-only entries before saving.
 */
function saveDocContext(values) {
  if (!values || typeof values !== 'object') {
    PropertiesService.getDocumentProperties().deleteProperty(DOC_CONTEXT_PROPERTY);
    return { ok: true };
  }
  var clean = {};
  for (var k in values) {
    if (!Object.prototype.hasOwnProperty.call(values, k)) continue;
    var v = values[k];
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      var arr = [];
      for (var i = 0; i < v.length; i++) {
        var item = String(v[i] || '').trim();
        if (item) arr.push(item);
      }
      if (arr.length > 0) clean[k] = arr;
    } else {
      var s = String(v).trim();
      if (s) clean[k] = s;
    }
  }
  PropertiesService.getDocumentProperties().setProperty(DOC_CONTEXT_PROPERTY, JSON.stringify(clean));
  return { ok: true };
}

function getDocTranslationEnabled() {
  var raw = PropertiesService.getDocumentProperties().getProperty(DOC_TRANSLATION_ENABLED_PROPERTY);
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null; // undefined → defer to template default
}

function setDocTranslationEnabled(enabled) {
  PropertiesService.getDocumentProperties().setProperty(
    DOC_TRANSLATION_ENABLED_PROPERTY,
    enabled ? 'true' : 'false'
  );
  return { ok: true };
}

/**
 * Best-effort parser for the legacy "Context" heading section.
 * Reads "**LABEL**: value" or "LABEL: value" lines and maps known labels to
 * v2 field keys. Returns the parsed object (and saves it to properties), or
 * null if no Context heading was found.
 *
 * Mapping:
 *   ARCHIVE_NAME           → archiveName
 *   ARCHIVE_REFERENCE      → archiveReference
 *   DOCUMENT_DESCRIPTION   → description
 *   DATE_RANGE             → period
 *   VILLAGES               → villages (array, split on newlines)
 *   COMMON_SURNAMES        → commonSurnames (array, split on newlines)
 */
function migrateContextBodyToProperties_(doc) {
  if (typeof getContextRange !== 'function') return null;
  var body = doc.getBody();
  var range = getContextRange(body);
  if (!range) return null;
  var lines = [];
  for (var j = range.start + 1; j <= range.end; j++) {
    var el = body.getChild(j);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    lines.push(el.asParagraph().getText());
  }
  if (lines.length === 0) return null;

  var values = {};
  var currentKey = null;
  var currentLines = [];
  function flushCurrent() {
    if (!currentKey) return;
    var text = currentLines.join('\n').replace(/^\s+|\s+$/g, '');
    if (!text) { currentKey = null; currentLines = []; return; }
    if (currentKey === 'villages' || currentKey === 'commonSurnames') {
      var arr = [];
      var raw = text.split(/\r?\n|,/);
      for (var ri = 0; ri < raw.length; ri++) {
        var v = raw[ri].replace(/^\s+|\s+$/g, '');
        if (v) arr.push(v);
      }
      values[currentKey] = arr;
    } else {
      values[currentKey] = text;
    }
    currentKey = null;
    currentLines = [];
  }
  var keyMap = {
    ARCHIVE_NAME: 'archiveName',
    ARCHIVE_REFERENCE: 'archiveReference',
    DOCUMENT_DESCRIPTION: 'description',
    DATE_RANGE: 'period',
    VILLAGES: 'villages',
    COMMON_SURNAMES: 'commonSurnames'
  };
  for (var li = 0; li < lines.length; li++) {
    var line = lines[li];
    var stripped = line.replace(/^\*+/, '').replace(/\*+/g, '').replace(/^\s+|\s+$/g, '');
    var colonIdx = stripped.indexOf(':');
    var matched = false;
    if (colonIdx > 0) {
      var label = stripped.substring(0, colonIdx).replace(/^\s+|\s+$/g, '').toUpperCase();
      if (keyMap[label]) {
        flushCurrent();
        currentKey = keyMap[label];
        var rest = stripped.substring(colonIdx + 1).replace(/^\s+|\s+$/g, '');
        if (rest) currentLines.push(rest);
        matched = true;
      }
    }
    if (!matched && currentKey) {
      currentLines.push(line);
    }
  }
  flushCurrent();

  if (Object.keys(values).length === 0) return null;
  saveDocContext(values);
  Logger.log('migrateContextBodyToProperties_: migrated ' + Object.keys(values).length + ' fields from legacy Context heading');
  return values;
}

// ---------------------------------------------------------------------------
// Request preparation (called from Code.gs before callGemini)
// ---------------------------------------------------------------------------

/**
 * Prepares a v2 transcription request for the active document.
 * Returns null if the selected template is not v2 (caller should fall back).
 *
 * Output shape:
 *   {
 *     promptText: string,
 *     responseSchema: object,
 *     translationConfig: { enabled, mode, languages, ... },
 *     templateId: string,
 *     resolvedTemplate: object
 *   }
 */
function prepareV2Request(doc) {
  var templateId = getSelectedTemplateId();
  if (!isV2Template(templateId)) return null;

  var contextValues = getDocContext();
  var translationOverride = getDocTranslationEnabled();
  var locale = 'en';
  try {
    if (typeof getEffectiveLocale === 'function') {
      var l = getEffectiveLocale();
      if (l === 'en' || l === 'uk' || l === 'ru') locale = l;
    }
  } catch (_e) {}

  var compileOpts = { locale: locale };
  if (translationOverride !== null) {
    compileOpts.translationEnabled = translationOverride;
  }

  var compiled = compilePrompt(templateId, contextValues, compileOpts);
  return {
    promptText: compiled.promptText,
    responseSchema: compiled.responseSchema,
    translationConfig: compiled.translationConfig,
    templateId: templateId,
    resolvedTemplate: compiled.resolvedTemplate
  };
}

// ---------------------------------------------------------------------------
// Output rendering
// ---------------------------------------------------------------------------

/**
 * Renders a Gemini JSON response into the document, immediately after the
 * element that contains the transcribed image. Returns the number of inserted
 * paragraphs (matches insertTranscriptionAfter's return for telemetry).
 *
 * Falls back to inserting raw text when the response can't be parsed as JSON.
 */
function renderV2Response(doc, elementContainingImage, responseText, templateId) {
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
  } catch (e) {
    Logger.log('renderV2Response: getChildIndex failed, appending. ' + e.message);
    insertIndex = body.getNumChildren() - 1;
  }
  insertIndex = insertIndex + 1;

  var parsed;
  try {
    parsed = parseJsonResponse(responseText);
  } catch (parseErr) {
    Logger.log('renderV2Response: parse failed, falling back to raw text. ' + parseErr.message);
    if (typeof insertFormattedText === 'function') {
      return insertFormattedText(body, insertIndex, responseText);
    }
    body.insertParagraph(insertIndex, responseText);
    return 1;
  }
  return renderJsonToDocs(parsed, templateId, body, insertIndex);
}

