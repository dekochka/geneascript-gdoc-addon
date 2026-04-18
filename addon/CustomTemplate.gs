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
  // Save immediately (consistent with createCustomTemplateFromParent/createBlankCustomTemplate)
  var saveResult = saveCustomTemplate(copy);
  if (!saveResult.ok) return saveResult;
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
    if (json.length > 9000) {
      return { ok: false, message: t('editor.too_large') };
    }
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

// ---------------------------------------------------------------------------
// Create-from-Template Picker Dialog
// ---------------------------------------------------------------------------

function showCreateFromTemplatePickerDialog() {
  var html = getCreateFromTemplatePickerHtml();
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(340),
    t('picker.create_title')
  );
}

function getCreateFromTemplatePickerHtml() {
  var templates = getTemplateListForClient();
  var itemsHtml = '';
  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];
    var checked = i === 0 ? ' checked' : '';
    var sel = i === 0 ? ' selected' : '';
    itemsHtml += '<label class="tpl-item' + sel + '" onclick="selItem(this)">' +
      '<input type="radio" name="parent" value="' + esc(tpl.id) + '"' + checked + '>' +
      '<div class="tpl-item-body">' +
      '<div class="tpl-item-title">' + esc(tpl.label) + '</div>' +
      '<div class="tpl-item-desc">' + esc(tpl.region) + ' &middot; ' + esc(tpl.religion) + ' &middot; ' + esc(tpl.recordTypes) + '</div>' +
      '</div>' +
      '</label>';
  }

  return [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; }',
    '.subtitle { font-size: 12px; color: #5f6368; margin-bottom: 16px; }',
    '.tpl-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }',
    '.tpl-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.15s; }',
    '.tpl-item:hover { border-color: #1a73e8; }',
    '.tpl-item.selected { border-color: #1a73e8; background: #e8f0fe; }',
    '.tpl-item input[type=radio] { accent-color: #1a73e8; margin: 0; }',
    '.tpl-item-body { flex: 1; }',
    '.tpl-item-title { font-weight: bold; font-size: 13px; margin-bottom: 1px; }',
    '.tpl-item-desc { font-size: 11px; color: #5f6368; }',
    '.actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #eee; }',
    '.btn { padding: 8px 20px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.status { font-size: 12px; margin-top: 8px; padding: 8px; border-radius: 4px; display: none; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '</style>',
    '</head><body>',
    '<p class="subtitle">' + esc(t('picker.create_hint')) + '</p>',
    '<div class="tpl-list">' + itemsHtml + '</div>',
    '<div id="statusMsg" class="status"></div>',
    '<div class="actions">',
    '<button class="btn" onclick="google.script.host.close()">' + esc(t('editor.cancel')) + '</button>',
    '<button class="btn btn-primary" id="goBtn" onclick="doCreate()">' + esc(t('picker.create_go')) + '</button>',
    '</div>',
    '<script>',
    'function selItem(el){',
    '  document.querySelectorAll(".tpl-item").forEach(function(x){x.classList.remove("selected");});',
    '  el.classList.add("selected");',
    '  el.querySelector("input[type=radio]").checked=true;',
    '}',
    'function doCreate(){',
    '  var r=document.querySelector("input[name=parent]:checked");',
    '  if(!r) return;',
    '  document.getElementById("goBtn").disabled=true;',
    '  document.getElementById("goBtn").textContent="Creating\\u2026";',
    '  google.script.run.withSuccessHandler(function(res){',
    '    if(res.ok){',
    '      google.script.run.showCustomTemplateEditorDialog(res.template.id);',
    '      google.script.host.close();',
    '    }else{',
    '      document.getElementById("statusMsg").className="status error";',
    '      document.getElementById("statusMsg").textContent=res.message;',
    '      document.getElementById("goBtn").disabled=false;',
    '      document.getElementById("goBtn").textContent="' + esc(t('picker.create_go')) + '";',
    '    }',
    '  }).withFailureHandler(function(e){',
    '    document.getElementById("statusMsg").className="status error";',
    '    document.getElementById("statusMsg").textContent=e.message||"Error";',
    '    document.getElementById("goBtn").disabled=false;',
    '    document.getElementById("goBtn").textContent="' + esc(t('picker.create_go')) + '";',
    '  }).createCustomTemplateFromParent(r.value);',
    '}',
    '</script>',
    '</body></html>'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Editor Dialog
// ---------------------------------------------------------------------------

function showCustomTemplateEditorDialog(templateId) {
  var html = getCustomTemplateEditorHtml(templateId);
  var tpl = templateId ? getCustomTemplateById(templateId) : null;
  var isNew = !tpl || !tpl.label;
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(640).setHeight(700),
    isNew ? t('editor.title_new') : t('editor.title_edit')
  );
}

function getCustomTemplateEditorHtml(templateId) {
  var tpl = null;
  if (templateId) {
    tpl = getCustomTemplateById(templateId);
  }
  var isNew = !tpl || !tpl.label;

  var parentLabel = '';
  var hasParent = false;
  if (tpl && tpl.parentTemplateId) {
    var pm = getTemplateById(tpl.parentTemplateId);
    if (pm) {
      parentLabel = t('template.' + tpl.parentTemplateId + '.label');
      hasParent = true;
    }
  }

  var eiJson = stringifyForHtmlScript(getEditorClientI18n());

  var tabs = [
    { key: 'role', label: t('editor.tab_role') },
    { key: 'inputStructure', label: t('editor.tab_input') },
    { key: 'outputFormat', label: t('editor.tab_output') },
    { key: 'instructions', label: t('editor.tab_instructions') },
    { key: 'contextDefaults', label: t('editor.tab_context') }
  ];

  var tabBtnsHtml = '';
  for (var ti = 0; ti < tabs.length; ti++) {
    var cls = ti === 0 ? ' active' : '';
    tabBtnsHtml += '<button class="tab-btn' + cls + '" data-tab="' + tabs[ti].key + '" onclick="switchTab(this)">' + esc(tabs[ti].label) + '</button>';
  }

  return [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; display: flex; flex-direction: column; height: calc(100vh - 32px); }',
    '.editor-header { margin-bottom: 12px; }',
    '.editor-header .subtitle { font-size: 12px; color: #5f6368; }',
    '.parent-info { font-size: 11px; color: #5f6368; margin-top: 4px; padding: 6px 10px; background: #f1f3f4; border-radius: 4px; display: inline-block; }',
    '.parent-info strong { color: #1a73e8; }',
    '.field-group { margin-bottom: 10px; }',
    '.field-group label { display: block; font-size: 12px; font-weight: bold; color: #333; margin-bottom: 3px; }',
    '.field-group .req { color: #c5221f; }',
    '.field-group input[type=text], .field-group textarea { width: 100%; box-sizing: border-box; padding: 7px 10px; border: 1px solid #dadce0; border-radius: 4px; font-family: Arial, sans-serif; font-size: 13px; color: #333; }',
    '.field-group input:focus, .field-group textarea:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.15); }',
    '.char-count { font-size: 10px; color: #999; text-align: right; margin-top: 2px; }',
    '.tab-bar { display: flex; border-bottom: 1px solid #dadce0; background: #f1f3f4; border-radius: 4px 4px 0 0; margin-top: 4px; }',
    '.tab-btn { padding: 7px 10px; font-size: 11px; border: none; background: none; cursor: pointer; color: #5f6368; white-space: nowrap; border-bottom: 2px solid transparent; }',
    '.tab-btn:hover { color: #1a73e8; }',
    '.tab-btn.active { color: #1a73e8; border-bottom-color: #1a73e8; font-weight: bold; }',
    '.tab-panel { border: 1px solid #dadce0; border-top: none; border-radius: 0 0 4px 4px; flex: 1; display: flex; flex-direction: column; min-height: 0; }',
    '.tab-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }',
    '.tab-panel-header .sec-label { font-size: 11px; font-weight: bold; color: #5f6368; }',
    '.modified-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f9ab00; margin-left: 4px; vertical-align: middle; }',
    '.reset-btn { font-size: 11px; padding: 3px 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff; color: #5f6368; cursor: pointer; display: flex; align-items: center; gap: 3px; }',
    '.reset-btn:hover { border-color: #f9ab00; color: #e37400; background: #fef7e0; }',
    '.section-editor { flex: 1; display: flex; }',
    '.section-editor textarea { width: 100%; box-sizing: border-box; min-height: 180px; padding: 8px 10px; border: none; font-family: "Roboto Mono", "Courier New", monospace; font-size: 11px; line-height: 1.5; color: #333; resize: vertical; flex: 1; }',
    '.section-editor textarea:focus { outline: none; background: #fafbff; }',
    '.empty-hint { font-size: 10px; color: #f9ab00; padding: 4px 10px; background: #fef7e0; border-top: 1px solid #fce8b2; }',
    '.scroll-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }',
    '.actions { display: flex; gap: 8px; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid #eee; }',
    '.actions-left { display: flex; gap: 8px; }',
    '.actions-right { display: flex; gap: 8px; }',
    '.btn { padding: 7px 18px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.btn-danger { color: #c5221f; border-color: #c5221f; }',
    '.btn-danger:hover { background: #fce8e6; }',
    '.status { font-size: 12px; margin-top: 6px; padding: 6px; border-radius: 4px; display: none; }',
    '.status.success { display: block; background: #e6f4ea; color: #137333; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '</style>',
    '</head><body>',
    '<div class="editor-header">',
    '  <div class="subtitle">' + esc(t('editor.subtitle')) + '</div>',
    hasParent ? '  <div class="parent-info">' + esc(t('editor.parent_info', { name: parentLabel })) + '</div>' : '',
    '</div>',
    '<div class="scroll-body">',
    '<div class="field-group">',
    '  <label>' + esc(t('editor.field_name')) + ' <span class="req">*</span></label>',
    '  <input type="text" id="tplName" maxlength="80" value="">',
    '</div>',
    '<div class="field-group">',
    '  <label>' + esc(t('editor.field_desc')) + ' <span class="req">*</span></label>',
    '  <textarea id="tplDesc" rows="2" maxlength="300"></textarea>',
    '  <div class="char-count"><span id="descCount">0</span> / 300</div>',
    '</div>',
    '<div class="tab-bar">' + tabBtnsHtml + '</div>',
    '<div class="tab-panel">',
    '  <div class="tab-panel-header">',
    '    <span class="sec-label" id="secLabel"></span>',
    hasParent ? '    <button class="reset-btn" id="resetBtn" onclick="doReset()">&#8635; ' + esc(t('editor.reset_btn')) + '</button>' : '',
    '  </div>',
    '  <div class="section-editor"><textarea id="secTextarea"></textarea></div>',
    '  <div class="empty-hint" id="emptyHint" style="display:none">' + esc(t('editor.section_empty_hint')) + '</div>',
    '</div>',
    '</div>',
    '<div id="statusMsg" class="status"></div>',
    '<div class="actions">',
    '  <div class="actions-left">',
    isNew ? '' : '    <button class="btn btn-danger" onclick="doDelete()">' + esc(t('editor.delete')) + '</button>',
    '  </div>',
    '  <div class="actions-right">',
    '    <button class="btn" onclick="google.script.host.close()">' + esc(t('editor.cancel')) + '</button>',
    '    <button class="btn btn-primary" id="saveBtn" onclick="doSave()">' + esc(t('editor.save')) + '</button>',
    '  </div>',
    '</div>',
    '<script>',
    'var EI=' + eiJson + ';',
    'var tpl=' + stringifyForHtmlScript(tpl || {}) + ';',
    'var parentId=' + stringifyForHtmlScript(hasParent ? tpl.parentTemplateId : null) + ';',
    'var parentSections=null;',
    'var currentTab="role";',
    'var sectionData={',
    '  role: tpl.sections ? tpl.sections.role || "" : "",',
    '  inputStructure: tpl.sections ? tpl.sections.inputStructure || "" : "",',
    '  outputFormat: tpl.sections ? tpl.sections.outputFormat || "" : "",',
    '  instructions: tpl.sections ? tpl.sections.instructions || "" : "",',
    '  contextDefaults: tpl.contextDefaults || ""',
    '};',
    '',
    'document.getElementById("tplName").value = tpl.label || "";',
    'document.getElementById("tplDesc").value = tpl.description || "";',
    'document.getElementById("descCount").textContent = (tpl.description || "").length;',
    'document.getElementById("tplDesc").addEventListener("input", function(){ document.getElementById("descCount").textContent = this.value.length; });',
    '',
    'showSection("role");',
    '',
    'function switchTab(btn){',
    '  document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active");});',
    '  btn.classList.add("active");',
    '  saveCurrent();',
    '  currentTab = btn.getAttribute("data-tab");',
    '  showSection(currentTab);',
    '}',
    '',
    'function saveCurrent(){',
    '  sectionData[currentTab] = document.getElementById("secTextarea").value;',
    '}',
    '',
    'var tabLabels = { role: EI.tabRole, inputStructure: EI.tabInput, outputFormat: EI.tabOutput, instructions: EI.tabInstructions, contextDefaults: EI.tabContext };',
    '',
    'function showSection(key){',
    '  document.getElementById("secLabel").textContent = tabLabels[key] || key;',
    '  document.getElementById("secTextarea").value = sectionData[key] || "";',
    '  var hint = document.getElementById("emptyHint");',
    '  hint.style.display = (!sectionData[key] || !sectionData[key].trim()) ? "block" : "none";',
    '  document.getElementById("secTextarea").oninput = function(){ hint.style.display = this.value.trim() ? "none" : "block"; };',
    '}',
    '',
    'function doReset(){',
    '  if(!parentId) return;',
    '  if(!confirm(EI.resetConfirm)) return;',
    '  if(parentSections){',
    '    applyReset();',
    '  } else {',
    '    google.script.run.withSuccessHandler(function(ps){',
    '      parentSections = ps;',
    '      applyReset();',
    '    }).withFailureHandler(function(e){',
    '      showStatus("error", e.message || "Reset failed");',
    '    }).getParentSectionsForReset(parentId);',
    '  }',
    '}',
    '',
    'function applyReset(){',
    '  if(!parentSections) return;',
    '  sectionData[currentTab] = parentSections[currentTab] || "";',
    '  showSection(currentTab);',
    '}',
    '',
    'function doSave(){',
    '  saveCurrent();',
    '  var name = document.getElementById("tplName").value.trim();',
    '  var desc = document.getElementById("tplDesc").value.trim();',
    '  if(!name){ showStatus("error", EI.nameRequired); return; }',
    '  if(!desc){ showStatus("error", EI.descRequired); return; }',
    '  var obj = {',
    '    id: tpl.id || "",',
    '    label: name,',
    '    description: desc,',
    '    parentTemplateId: tpl.parentTemplateId || null,',
    '    sections: {',
    '      role: sectionData.role,',
    '      inputStructure: sectionData.inputStructure,',
    '      outputFormat: sectionData.outputFormat,',
    '      instructions: sectionData.instructions',
    '    },',
    '    contextDefaults: sectionData.contextDefaults,',
    '    createdAt: tpl.createdAt || new Date().toISOString(),',
    '    updatedAt: new Date().toISOString()',
    '  };',
    '  document.getElementById("saveBtn").disabled = true;',
    '  document.getElementById("saveBtn").textContent = EI.saving;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){',
    '      showStatus("success", EI.saved);',
    '      setTimeout(function(){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }, 1000);',
    '    } else {',
    '      showStatus("error", r.message);',
    '      document.getElementById("saveBtn").disabled = false;',
    '      document.getElementById("saveBtn").textContent = EI.save;',
    '    }',
    '  }).withFailureHandler(function(e){',
    '    showStatus("error", EI.saveFailed + " " + (e.message || ""));',
    '    document.getElementById("saveBtn").disabled = false;',
    '    document.getElementById("saveBtn").textContent = EI.save;',
    '  }).saveCustomTemplateFromClient(JSON.stringify(obj));',
    '}',
    '',
    'function doDelete(){',
    '  if(!tpl.id) return;',
    '  if(!confirm("' + esc(t('gallery.confirm_delete')) + '")) return;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }',
    '    else{ showStatus("error", r.message); }',
    '  }).withFailureHandler(function(e){',
    '    showStatus("error", e.message || "Delete failed");',
    '  }).deleteCustomTemplateFromClient(tpl.id);',
    '}',
    '',
    'function showStatus(type, msg){',
    '  var el = document.getElementById("statusMsg");',
    '  el.className = "status " + type;',
    '  el.textContent = msg;',
    '}',
    '</script>',
    '</body></html>'
  ].join('\n');
}
