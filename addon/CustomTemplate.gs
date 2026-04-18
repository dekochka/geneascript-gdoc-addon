/**
 * Custom Template CRUD, storage, and editor dialog.
 * Custom templates are stored in User Properties (personal library)
 * and can be exported to Document Properties (collaborator sharing).
 * See: project/designs/2026-04-18-custom-templates-design.md
 */

var CUSTOM_TEMPLATES_PROPERTY = 'CUSTOM_TEMPLATES';
var EXPORTED_TEMPLATES_PROPERTY = 'EXPORTED_CUSTOM_TEMPLATES';
var MAX_CUSTOM_TEMPLATES = 5;
var MAX_TEMPLATE_NAME_LENGTH = 80;
var MAX_TEMPLATE_DESC_LENGTH = 300;
var CUSTOM_ID_PREFIX = 'custom_';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function getCustomTemplates() {
  try {
    var json = PropertiesService.getUserProperties().getProperty(CUSTOM_TEMPLATES_PROPERTY);
    if (!json) return [];
    var arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.log('getCustomTemplates: parse error, returning empty. ' + e.message);
    return [];
  }
}

function saveCustomTemplatesArray(arr) {
  var json = JSON.stringify(arr);
  if (json.length > 9000) {
    return { ok: false, message: t('editor.too_large') };
  }
  PropertiesService.getUserProperties().setProperty(CUSTOM_TEMPLATES_PROPERTY, json);
  return { ok: true };
}

function getCustomTemplateById(id) {
  var templates = getCustomTemplates();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === id) return templates[i];
  }
  return null;
}

function getExportedCustomTemplates() {
  try {
    var json = PropertiesService.getDocumentProperties().getProperty(EXPORTED_TEMPLATES_PROPERTY);
    if (!json) return [];
    var arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.log('getExportedCustomTemplates: parse error. ' + e.message);
    return [];
  }
}

function getExportedCustomTemplateById(id) {
  var exported = getExportedCustomTemplates();
  for (var i = 0; i < exported.length; i++) {
    if (exported[i].id === id) return exported[i];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Resolution: find custom template by ID (User Props -> Document Props)
// ---------------------------------------------------------------------------

function resolveCustomTemplate(id) {
  var tpl = getCustomTemplateById(id);
  if (tpl) return tpl;
  return getExportedCustomTemplateById(id);
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function assemblePromptFromSections(sections) {
  var parts = [];
  if (sections.role) {
    parts.push('#### Role\n\n' + sections.role);
  }
  parts.push('#### Context\n\n{{CONTEXT}}');
  if (sections.inputStructure) {
    parts.push('#### Input Template Description\n\n' + sections.inputStructure);
  }
  if (sections.outputFormat) {
    parts.push('#### Output Format\n\n' + sections.outputFormat);
  }
  if (sections.instructions) {
    parts.push('#### Instructions\n\n' + sections.instructions);
  }
  return parts.join('\n\n');
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

function saveCustomTemplate(template) {
  var templates = getCustomTemplates();
  var existingIdx = -1;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === template.id) { existingIdx = i; break; }
  }
  if (existingIdx === -1 && templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  template.updatedAt = new Date().toISOString();
  if (existingIdx >= 0) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }
  var result = saveCustomTemplatesArray(templates);
  if (!result.ok) return result;
  return { ok: true, message: t('editor.saved') };
}

function deleteCustomTemplate(id) {
  var templates = getCustomTemplates();
  var filtered = [];
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id !== id) filtered.push(templates[i]);
  }
  if (filtered.length === templates.length) {
    return { ok: false, message: 'Template not found.' };
  }
  var result = saveCustomTemplatesArray(filtered);
  if (!result.ok) return result;

  // If deleted template was selected on this doc, revert to default
  try {
    var selectedId = PropertiesService.getDocumentProperties().getProperty(TEMPLATE_ID_PROPERTY);
    if (selectedId === id) {
      PropertiesService.getDocumentProperties().setProperty(TEMPLATE_ID_PROPERTY, DEFAULT_TEMPLATE_ID);
    }
  } catch (e) {
    Logger.log('deleteCustomTemplate: could not check selected ID. ' + e.message);
  }
  return { ok: true, message: 'Template deleted.' };
}

// ---------------------------------------------------------------------------
// Template creation
// ---------------------------------------------------------------------------

function createCustomTemplateFromParent(parentId) {
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var parentMeta = getTemplateById(parentId);
  if (!parentMeta) {
    return { ok: false, message: t('template.unknown', { id: parentId }) };
  }
  var prompt = getPromptForTemplate(parentId);
  var sections = parseSectionsFromPrompt(prompt);
  var now = new Date().toISOString();
  var tpl = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: '',
    description: '',
    parentTemplateId: parentId,
    sections: sections,
    contextDefaults: getContextDefaultsForTemplate(parentId),
    createdAt: now,
    updatedAt: now
  };
  // Save immediately so editor can load by ID
  var saveResult = saveCustomTemplate(tpl);
  if (!saveResult.ok) return saveResult;
  return { ok: true, template: tpl };
}

function createBlankCustomTemplate() {
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var now = new Date().toISOString();
  var tpl = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: '',
    description: '',
    parentTemplateId: null,
    sections: {
      role: '',
      inputStructure: '',
      outputFormat: getBlankOutputFormatScaffold(),
      instructions: getBlankInstructionsScaffold()
    },
    contextDefaults: getBlankContextDefaultsScaffold(),
    createdAt: now,
    updatedAt: now
  };
  var saveResult = saveCustomTemplate(tpl);
  if (!saveResult.ok) return saveResult;
  return { ok: true, template: tpl };
}

function parseSectionsFromPrompt(prompt) {
  var sections = { role: '', inputStructure: '', outputFormat: '', instructions: '' };
  var parts = prompt.split(/^####\s+/m);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var firstNewline = part.indexOf('\n');
    var header = (firstNewline > 0 ? part.substring(0, firstNewline) : part).trim();
    var body = firstNewline > 0 ? part.substring(firstNewline + 1).trim() : '';
    if (header === 'Role') sections.role = body;
    else if (header === 'Input Template Description') sections.inputStructure = body;
    else if (header === 'Output Format') sections.outputFormat = body;
    else if (header === 'Instructions') sections.instructions = body;
  }
  return sections;
}

function getBlankOutputFormatScaffold() {
  return [
    'Output must be formatted for readability in a document.',
    'Use **bold** for labels, names, and key attributes (e.g., **Name:**, **Parents:**).',
    'Do NOT use bullet points for the main record data. Use standard paragraphs.',
    'Use blank lines to separate records.',
    '',
    '**Quality Metrics:** Handwriting Quality (e.g., 3/5), Trust Score (e.g., 4/5).',
    '**Assessment:** Quality of Output (e.g., 2/5), Corrections Notes.',
    '',
    'Provide the language summaries formatted as a bulleted list below each record.',
    'IMPORTANT: Use these exact language labels verbatim:',
    '- **ru:** [Summary in Russian]',
    '- **uk:** [Summary in Ukrainian]',
    '- **original:** [Original transcription]',
    '- **en:** [Summary in English]',
    '',
    'Repeat Quality Metrics and Assessment under each record, not once for the whole document.'
  ].join('\n');
}

function getBlankInstructionsScaffold() {
  return [
    'Step 1: Extract page header metadata (year, page number, archival signatures if visible, village/parish names).',
    '',
    'Step 2: For each record provide structured summary per the record output format above.',
    '',
    'Transcription accuracy: Transcribe exactly as written; preserve original spelling and abbreviations. If unclear use [illegible] or [possibly X].'
  ].join('\n');
}

function getBlankContextDefaultsScaffold() {
  return [
    '**ARCHIVE_NAME**:',
    '**ARCHIVE_REFERENCE**:',
    '**DOCUMENT_DESCRIPTION**:',
    '**DATE_RANGE**:',
    '**VILLAGES**:',
    '',
    '**COMMON_SURNAMES**:'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Client-facing functions (called from dialogs via google.script.run)
// ---------------------------------------------------------------------------

function getCustomTemplateListForClient() {
  var own = getCustomTemplates();
  var exported = getExportedCustomTemplates();
  var ownIds = {};
  var list = [];

  for (var i = 0; i < own.length; i++) {
    var tpl = own[i];
    ownIds[tpl.id] = true;
    var parentLabel = '';
    if (tpl.parentTemplateId) {
      var pm = getTemplateById(tpl.parentTemplateId);
      parentLabel = pm ? t('template.' + tpl.parentTemplateId + '.label') : '';
    }
    list.push({
      id: tpl.id,
      label: tpl.label,
      description: tpl.description,
      parentTemplateId: tpl.parentTemplateId,
      parentLabel: parentLabel,
      isOwn: true
    });
  }

  for (var j = 0; j < exported.length; j++) {
    var ex = exported[j];
    if (ownIds[ex.id]) continue;
    var exParentLabel = '';
    if (ex.parentTemplateId) {
      var epm = getTemplateById(ex.parentTemplateId);
      exParentLabel = epm ? t('template.' + ex.parentTemplateId + '.label') : '';
    }
    list.push({
      id: ex.id,
      label: ex.label,
      description: ex.description,
      parentTemplateId: ex.parentTemplateId,
      parentLabel: exParentLabel,
      isOwn: false
    });
  }

  return list;
}

function saveCustomTemplateFromClient(templateJson) {
  try {
    var tpl = JSON.parse(templateJson);
    if (!tpl.label || !tpl.label.trim()) {
      return { ok: false, message: t('editor.name_required') };
    }
    if (!tpl.description || !tpl.description.trim()) {
      return { ok: false, message: t('editor.desc_required') };
    }
    tpl.label = tpl.label.trim().substring(0, MAX_TEMPLATE_NAME_LENGTH);
    tpl.description = tpl.description.trim().substring(0, MAX_TEMPLATE_DESC_LENGTH);
    return saveCustomTemplate(tpl);
  } catch (e) {
    Logger.log('saveCustomTemplateFromClient error: ' + e.message);
    return { ok: false, message: t('editor.save_failed') };
  }
}

function deleteCustomTemplateFromClient(id) {
  try {
    return deleteCustomTemplate(id);
  } catch (e) {
    Logger.log('deleteCustomTemplateFromClient error: ' + e.message);
    return { ok: false, message: 'Delete failed: ' + e.message };
  }
}

function duplicateCustomTemplate(sourceId) {
  var source = getCustomTemplateById(sourceId);
  if (!source) {
    source = getExportedCustomTemplateById(sourceId);
  }
  if (!source) {
    return { ok: false, message: 'Source template not found.' };
  }
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var now = new Date().toISOString();
  var copy = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: source.label + ' (copy)',
    description: source.description,
    parentTemplateId: source.parentTemplateId,
    sections: {
      role: source.sections.role,
      inputStructure: source.sections.inputStructure,
      outputFormat: source.sections.outputFormat,
      instructions: source.sections.instructions
    },
    contextDefaults: source.contextDefaults,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, template: copy };
}

function exportCustomTemplateToDocument(id) {
  try {
    var tpl = getCustomTemplateById(id);
    if (!tpl) return { ok: false, message: 'Template not found.' };

    var exported = getExportedCustomTemplates();
    var found = false;
    for (var i = 0; i < exported.length; i++) {
      if (exported[i].id === tpl.id) {
        exported[i] = tpl;
        found = true;
        break;
      }
    }
    if (!found) exported.push(tpl);

    var json = JSON.stringify(exported);
    PropertiesService.getDocumentProperties().setProperty(EXPORTED_TEMPLATES_PROPERTY, json);
    return { ok: true, message: t('gallery.exported_ok') };
  } catch (e) {
    Logger.log('exportCustomTemplateToDocument error: ' + e.message);
    return { ok: false, message: 'Export failed: ' + e.message };
  }
}

function getParentSectionsForReset(parentId) {
  if (!parentId || !getTemplateById(parentId)) return null;
  var prompt = getPromptForTemplate(parentId);
  var sections = parseSectionsFromPrompt(prompt);
  sections.contextDefaults = getContextDefaultsForTemplate(parentId);
  return sections;
}
