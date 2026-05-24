/**
 * SetupWizard — 2-step modal dialog for configuring template + context.
 *
 * Step 1: pick a template (grouped by category, only v2 user-facing variants).
 * Step 2: fill the template's context fields (auto-extract from cover available).
 *
 * On "Done" the dialog:
 *   - saves the template ID via setSelectedTemplateId
 *   - saves context values to Document Properties via saveDocContext
 *   - saves translation toggle to Document Properties (when changed)
 *
 * Server functions exposed to the dialog:
 *   - getSetupWizardBootstrap        — initial state for both steps
 *   - getContextFieldsForTemplate    — re-fetches context schema when user picks a different template
 *   - saveSetupWizard                — final save on Done
 */

function showSetupWizardDialog() {
  refreshAddonMenuForCurrentLocale();
  try { runV2MigrationsIfNeeded(); } catch (mErr) { Logger.log('showSetupWizardDialog: migration error ' + mErr.message); }
  var html = getSetupWizardHtml_();
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(640).setHeight(720),
    t('wizard.title')
  );
}

/**
 * Returns the initial state needed by the wizard's client script.
 *
 * Shape:
 *   {
 *     selectedTemplateId, locale,
 *     templates: [ { id, label, description, category, region, religion, recordType, timePeriod, isSelected } ],
 *     categories: [ { id, label } ],
 *     contextFields: [ { key, label, type, required, options, freeInput, placeholder, defaultValue, value } ],
 *     translationEnabled, translationLanguages,
 *     i18n: { ... },
 *     hasV1ContextHeading
 *   }
 */
function getSetupWizardBootstrap() {
  var locale = 'en';
  try {
    var l = getEffectiveLocale();
    if (l === 'en' || l === 'uk' || l === 'ru') locale = l;
  } catch (e) {}

  var selectedId = getSelectedTemplateId();
  if (!isV2Template(selectedId)) {
    var mapped = (LEGACY_TO_V2_TEMPLATE_ID_MAP && LEGACY_TO_V2_TEMPLATE_ID_MAP[selectedId])
      ? LEGACY_TO_V2_TEMPLATE_ID_MAP[selectedId] : 'generic_plain';
    selectedId = mapped;
  }

  var templates = getUserFacingTemplatesV2();
  var seenCats = {};
  var categories = [];
  var templateList = [];
  for (var i = 0; i < templates.length; i++) {
    var t2 = templates[i];
    var meta = t2.meta || {};
    var cat = meta.category || 'generic';
    if (!seenCats[cat]) {
      seenCats[cat] = true;
      categories.push({ id: cat, label: humanizeCategory_(cat) });
    }
    templateList.push({
      id: t2.id,
      label: meta.label || t2.id,
      description: meta.description || '',
      category: cat,
      region: meta.region || '',
      religion: meta.religion || '',
      recordType: meta.recordType || '',
      timePeriod: meta.timePeriod || '',
      icon: meta.icon || 'description',
      isSelected: t2.id === selectedId
    });
  }

  var contextFields = buildContextFieldStateForClient_(selectedId, locale);
  var translationCfg = getResolvedTranslationConfig(selectedId, getDocTranslationEnabled());

  var hasV1ContextHeading = false;
  try {
    var doc = DocumentApp.getActiveDocument();
    if (doc && typeof getContextRange === 'function') {
      var range = getContextRange(doc.getBody());
      hasV1ContextHeading = !!range;
    }
  } catch (_e) {}

  return {
    selectedTemplateId: selectedId,
    locale: locale,
    templates: templateList,
    categories: categories,
    contextFields: contextFields,
    translationEnabled: !!translationCfg.enabled,
    translationLanguages: translationCfg.languages || [],
    hasV1ContextHeading: hasV1ContextHeading,
    i18n: getWizardClientI18n_(locale)
  };
}

/**
 * Re-fetches context schema (with current saved values + template defaults
 * applied) when the user changes the template selection in step 1.
 */
function getContextFieldsForTemplate(templateId) {
  var locale = 'en';
  try {
    var l = getEffectiveLocale();
    if (l === 'en' || l === 'uk' || l === 'ru') locale = l;
  } catch (e) {}
  if (!isV2Template(templateId)) {
    return { ok: false, message: 'Unknown template ID: ' + templateId };
  }
  var fields = buildContextFieldStateForClient_(templateId, locale);
  var translationCfg = getResolvedTranslationConfig(templateId, getDocTranslationEnabled());
  return {
    ok: true,
    contextFields: fields,
    translationEnabled: !!translationCfg.enabled,
    translationLanguages: translationCfg.languages || []
  };
}

/**
 * Saves final wizard state. Returns { ok, message } in the standard shape.
 */
function saveSetupWizard(payload) {
  try {
    payload = payload || {};
    var templateId = payload.templateId;
    if (!isV2Template(templateId)) {
      return { ok: false, message: 'Unknown template ID: ' + templateId };
    }
    setSelectedTemplateId(templateId);
    saveDocContext(payload.context || {});
    if (typeof payload.translationEnabled === 'boolean') {
      setDocTranslationEnabled(payload.translationEnabled);
    }
    return { ok: true, message: t('wizard.saved') };
  } catch (e) {
    Logger.log('saveSetupWizard error: ' + e.message);
    return { ok: false, message: t('wizard.save_error', { detail: e.message }) };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildContextFieldStateForClient_(templateId, locale) {
  var fields = getResolvedContextFields(templateId);
  var defaults = getResolvedContextDefaults(templateId);
  var savedValues = getDocContext();

  var out = [];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var key = f.key;
    var savedValue = savedValues[key];
    var defaultValue = defaults[key];
    // Saved value wins; defaults pre-fill only when nothing has been saved yet.
    var value;
    if (savedValue !== undefined && savedValue !== null && savedValue !== '') {
      value = savedValue;
    } else if (defaultValue !== undefined && defaultValue !== null) {
      value = defaultValue;
    } else {
      value = (f.type === 'tags') ? [] : '';
    }

    out.push({
      key: key,
      label: getLocalizedContextLabel(f, locale),
      type: f.type || 'string',
      required: !!f.required,
      options: f.options || null,
      freeInput: !!f.freeInput,
      placeholder: (f.placeholder && f.placeholder[locale]) || (f.placeholder && f.placeholder.en) || '',
      value: value
    });
  }
  return out;
}

function humanizeCategory_(cat) {
  switch (cat) {
    case 'generic':         return t('wizard.cat.generic');
    case 'metric_book':     return t('wizard.cat.metric_book');
    case 'census_revision': return t('wizard.cat.census_revision');
    case 'correspondence':  return t('wizard.cat.correspondence');
    case 'official_document': return t('wizard.cat.official_document');
    case 'custom':          return t('wizard.cat.custom');
    default:                return cat;
  }
}

function getWizardClientI18n_(locale) {
  return {
    step1Title: t('wizard.step1.title'),
    step1Subtitle: t('wizard.step1.subtitle'),
    step2Title: t('wizard.step2.title'),
    step2Subtitle: t('wizard.step2.subtitle'),
    nextBtn: t('wizard.next'),
    backBtn: t('wizard.back'),
    doneBtn: t('wizard.done'),
    cancelBtn: t('wizard.cancel'),
    skipBtn: t('wizard.skip'),
    autoExtractBtn: t('wizard.auto_extract'),
    autoExtractTitle: t('wizard.auto_extract_title'),
    autoExtractSubtitle: t('wizard.auto_extract_subtitle'),
    translationLabel: t('wizard.translation_label'),
    translationLanguages: t('wizard.translation_languages'),
    saving: t('wizard.saving'),
    fieldRequired: t('wizard.field_required'),
    addTag: t('wizard.add_tag'),
    fieldsCount: t('wizard.fields_count'),
    contextFieldsFor: t('wizard.context_fields_for'),
    legacyContextNote: t('wizard.legacy_context_note'),
    selectTemplate: t('wizard.select_template'),
    advancedLink: t('wizard.advanced_link')
  };
}

function getSetupWizardHtml_() {
  // Bootstrap is fetched client-side after the dialog opens to avoid a heavy
  // initial render; we only inject the i18n bundle here.
  var locale = 'en';
  try {
    var l = getEffectiveLocale();
    if (l === 'en' || l === 'uk' || l === 'ru') locale = l;
  } catch (e) {}
  var iJson = stringifyForHtmlScript(getWizardClientI18n_(locale));

  var parts = [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 0; color: #333; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }',
    '.header { padding: 14px 20px; border-bottom: 1px solid #e0e0e0; display: flex; align-items: center; justify-content: space-between; }',
    '.header-title { font-size: 16px; font-weight: 500; }',
    '.steps { display: flex; padding: 10px 20px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }',
    '.step { flex: 1; text-align: center; }',
    '.step-circle { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #e0e0e0; color: #999; font-size: 12px; font-weight: 600; }',
    '.step.active .step-circle { background: #1a73e8; color: #fff; }',
    '.step.done .step-circle { background: #34a853; color: #fff; }',
    '.step-label { display: block; font-size: 11px; margin-top: 4px; color: #999; }',
    '.step.active .step-label { color: #1a73e8; font-weight: 500; }',
    '.step.done .step-label { color: #34a853; }',
    '.body { flex: 1; overflow-y: auto; padding: 16px 20px; }',
    '.subtitle { font-size: 12px; color: #5f6368; margin-bottom: 14px; }',
    '.cat-label { font-size: 11px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: 0.4px; margin: 12px 0 6px; }',
    '.cat-label:first-child { margin-top: 0; }',
    '.tpl-card { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid #e0e0e0; border-radius: 8px; margin-bottom: 6px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }',
    '.tpl-card:hover { border-color: #1a73e8; }',
    '.tpl-card.selected { border-color: #1a73e8; background: #e8f0fe; }',
    '.tpl-card input[type=radio] { margin-top: 3px; accent-color: #1a73e8; }',
    '.tpl-card-body { flex: 1; }',
    '.tpl-title { font-weight: 500; font-size: 13px; }',
    '.tpl-desc { font-size: 12px; color: #5f6368; margin-top: 2px; line-height: 1.4; }',
    '.tpl-meta { font-size: 11px; color: #5f6368; margin-top: 3px; }',
    '.field-group { margin-bottom: 12px; }',
    '.field-label { font-size: 12px; font-weight: 500; display: block; margin-bottom: 4px; }',
    '.field-label .req { color: #d93025; }',
    '.field-input { width: 100%; padding: 7px 9px; border: 1px solid #dadce0; border-radius: 4px; font-size: 12px; box-sizing: border-box; font-family: inherit; }',
    '.field-input:focus { outline: none; border-color: #1a73e8; }',
    '.field-textarea { min-height: 50px; resize: vertical; }',
    '.tags { display: flex; flex-wrap: wrap; gap: 4px; }',
    '.tag { display: inline-flex; align-items: center; gap: 4px; background: #e8f0fe; color: #1a73e8; padding: 3px 10px; border-radius: 12px; font-size: 11px; }',
    '.tag .remove { cursor: pointer; font-weight: bold; opacity: 0.6; }',
    '.tag .remove:hover { opacity: 1; }',
    '.tag-input { border: 1px dashed #dadce0; background: #fff; color: #5f6368; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-family: inherit; min-width: 60px; }',
    '.tag-input:focus { outline: none; border-color: #1a73e8; color: #1a73e8; }',
    '.section-divider { font-size: 11px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: 0.4px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; }',
    '.section-divider:first-child { margin-top: 0; }',
    '.extract-card { background: #e6f4ea; border: 1px solid #34a853; border-radius: 8px; padding: 12px; margin-bottom: 14px; display: flex; align-items: center; gap: 10px; }',
    '.extract-card .icon { font-size: 20px; }',
    '.extract-card .body { flex: 1; }',
    '.extract-card .title { font-weight: 500; font-size: 12px; }',
    '.extract-card .sub { font-size: 11px; color: #5f6368; margin-top: 2px; }',
    '.legacy-note { background: #fef7e0; border: 1px solid #fbbc04; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; color: #6d4c00; }',
    '.translation-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e0e0e0; margin-top: 14px; }',
    '.translation-toggle { width: 36px; height: 20px; background: #ccc; border-radius: 10px; position: relative; cursor: pointer; }',
    '.translation-toggle.on { background: #1a73e8; }',
    '.translation-toggle::after { content: ""; display: block; width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.15s; }',
    '.translation-toggle.on::after { left: 18px; }',
    '.footer { padding: 12px 20px; border-top: 1px solid #e0e0e0; display: flex; justify-content: space-between; align-items: center; }',
    '.footer-actions { display: flex; gap: 8px; }',
    '.btn { padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #5f6368; font-family: inherit; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; font-weight: 500; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.btn-primary:disabled { background: #94c2f8; border-color: #94c2f8; cursor: default; }',
    '.btn-link { background: none; border: none; color: #1a73e8; font-size: 12px; cursor: pointer; padding: 4px 0; }',
    '.btn-link:hover { text-decoration: underline; }',
    '.status { font-size: 12px; padding: 8px 12px; border-radius: 4px; margin-top: 12px; display: none; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '.status.success { display: block; background: #e6f4ea; color: #137333; }',
    '.empty { text-align: center; padding: 30px; color: #999; }',
    '</style>',
    '</head><body>',
    '<div class="header">',
    '  <div class="header-title">' + esc(t('wizard.title')) + '</div>',
    '  <button class="btn-link" onclick="google.script.host.close()">&times;</button>',
    '</div>',
    '<div class="steps">',
    '  <div id="step1Indicator" class="step active"><div class="step-circle">1</div><div class="step-label">' + esc(t('wizard.step1.indicator')) + '</div></div>',
    '  <div id="step2Indicator" class="step"><div class="step-circle">2</div><div class="step-label">' + esc(t('wizard.step2.indicator')) + '</div></div>',
    '</div>',
    '<div class="body" id="body"><div class="empty">' + esc(t('wizard.loading')) + '</div></div>',
    '<div id="status" class="status"></div>',
    '<div class="footer">',
    '  <div>',
    '    <button class="btn-link" onclick="openAdvancedGallery()" id="advancedLink" style="display:none;">' + esc(t('wizard.advanced_link')) + '</button>',
    '  </div>',
    '  <div class="footer-actions">',
    '    <button class="btn" id="cancelBtn" onclick="google.script.host.close()">' + esc(t('wizard.cancel')) + '</button>',
    '    <button class="btn" id="backBtn" style="display:none" onclick="goToStep(1)">&larr; ' + esc(t('wizard.back')) + '</button>',
    '    <button class="btn" id="skipBtn" style="display:none" onclick="finishWizard()">' + esc(t('wizard.skip')) + '</button>',
    '    <button class="btn btn-primary" id="nextBtn" onclick="goToStep(2)">' + esc(t('wizard.next')) + ' &rarr;</button>',
    '    <button class="btn btn-primary" id="doneBtn" style="display:none" onclick="finishWizard()">' + esc(t('wizard.done')) + ' &check;</button>',
    '  </div>',
    '</div>',
    '<script>',
    'var I=', iJson, ';',
    'var BOOT=null;',
    'var state={ step:1, templateId:null, contextValues:{}, translationEnabled:false };',
    'function escHtml(s){if(s===undefined||s===null)return "";return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\"/g,"&quot;").replace(/\'/g,"&#39;");}',
    'function el(id){return document.getElementById(id);}',
    'function setStatus(kind,msg){var s=el("status"); s.className="status "+kind; s.textContent=msg||"";}',
    'function clearStatus(){el("status").className="status"; el("status").textContent="";}',
    'function bootstrap(){',
    '  google.script.run.withSuccessHandler(function(b){',
    '    BOOT=b||{};',
    '    state.templateId=BOOT.selectedTemplateId;',
    '    state.translationEnabled=!!BOOT.translationEnabled;',
    '    if(BOOT.contextFields){state.contextValues=valuesFromFields(BOOT.contextFields);}',
    '    renderStep();',
    '  }).withFailureHandler(function(e){',
    '    el("body").innerHTML="<div class=empty>"+escHtml(e.message||String(e))+"</div>";',
    '  }).getSetupWizardBootstrap();',
    '}',
    'function valuesFromFields(fields){var v={}; for(var i=0;i<fields.length;i++){v[fields[i].key]=fields[i].value;} return v;}',
    'function goToStep(n){',
    '  if(n===2){',
    '    if(!state.templateId){setStatus("error",I.selectTemplate); return;}',
    '    var t1=el("step1Indicator"); t1.className="step done";',
    '    var t2=el("step2Indicator"); t2.className="step active";',
    '    state.step=2;',
    '    google.script.run.withSuccessHandler(function(r){',
    '      if(r&&r.ok){',
    '        BOOT.contextFields=r.contextFields;',
    '        BOOT.translationEnabled=!!r.translationEnabled;',
    '        BOOT.translationLanguages=r.translationLanguages||[];',
    '        state.translationEnabled=!!r.translationEnabled;',
    '        state.contextValues=valuesFromFields(r.contextFields);',
    '        renderStep();',
    '      } else { setStatus("error",(r&&r.message)||"Failed to load context fields"); }',
    '    }).withFailureHandler(function(e){setStatus("error",e.message||String(e));}).getContextFieldsForTemplate(state.templateId);',
    '  } else {',
    '    state.step=1;',
    '    var t1b=el("step1Indicator"); t1b.className="step active";',
    '    var t2b=el("step2Indicator"); t2b.className="step";',
    '    renderStep();',
    '  }',
    '}',
    'function renderStep(){',
    '  clearStatus();',
    '  if(state.step===1){',
    '    el("backBtn").style.display="none";',
    '    el("skipBtn").style.display="none";',
    '    el("nextBtn").style.display="inline-block";',
    '    el("doneBtn").style.display="none";',
    '    el("advancedLink").style.display="inline-block";',
    '    renderTemplatesStep();',
    '  } else {',
    '    el("backBtn").style.display="inline-block";',
    '    el("skipBtn").style.display="inline-block";',
    '    el("nextBtn").style.display="none";',
    '    el("doneBtn").style.display="inline-block";',
    '    el("advancedLink").style.display="none";',
    '    renderContextStep();',
    '  }',
    '}',
    'function renderTemplatesStep(){',
    '  if(!BOOT||!BOOT.templates){el("body").innerHTML="<div class=empty>"+escHtml(I.selectTemplate)+"</div>"; return;}',
    '  var html=\'<div class="subtitle">\'+escHtml(I.step1Subtitle)+\'</div>\';',
    '  for(var ci=0;ci<BOOT.categories.length;ci++){',
    '    var cat=BOOT.categories[ci];',
    '    html+=\'<div class="cat-label">\'+escHtml(cat.label)+\'</div>\';',
    '    for(var ti=0;ti<BOOT.templates.length;ti++){',
    '      var tpl=BOOT.templates[ti];',
    '      if(tpl.category!==cat.id) continue;',
    '      var sel=(tpl.id===state.templateId)?" selected":"";',
    '      var meta=[]; if(tpl.region)meta.push(escHtml(tpl.region)); if(tpl.religion)meta.push(escHtml(tpl.religion)); if(tpl.recordType)meta.push(escHtml(tpl.recordType)); if(tpl.timePeriod)meta.push(escHtml(tpl.timePeriod));',
    '      html+=\'<label class="tpl-card\'+sel+\'" data-id="\'+escHtml(tpl.id)+\'">\'',
    '        +\'<input type="radio" name="tpl" value="\'+escHtml(tpl.id)+\'"\'+(sel?" checked":"")+\'>\'',
    '        +\'<div class="tpl-card-body">\'',
    '        +\'<div class="tpl-title">\'+escHtml(tpl.label)+\'</div>\'',
    '        +(tpl.description?\'<div class="tpl-desc">\'+escHtml(tpl.description)+\'</div>\':"")',
    '        +(meta.length?\'<div class="tpl-meta">\'+meta.join(" \\u00b7 ")+\'</div>\':"")',
    '        +\'</div></label>\';',
    '    }',
    '  }',
    '  el("body").innerHTML=html;',
    '  var cards=document.querySelectorAll(".tpl-card");',
    '  cards.forEach(function(c){',
    '    c.addEventListener("click",function(){',
    '      cards.forEach(function(x){x.classList.remove("selected");});',
    '      c.classList.add("selected");',
    '      var r=c.querySelector("input[type=radio]"); if(r) r.checked=true;',
    '      state.templateId=c.getAttribute("data-id");',
    '    });',
    '  });',
    '}',
    'function renderContextStep(){',
    '  var fields=BOOT.contextFields||[];',
    '  var subtitleHtml=\'<div class="subtitle">\'+escHtml(I.step2Subtitle)+\'</div>\';',
    '  var fieldsCountHtml=\'<div style="background:#e8f0fe;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:12px;">\' +',
    '    \'<strong>\'+escHtml(currentTemplateLabel())+\'</strong>\' +',
    '    \' \\u00b7 \' + escHtml(I.fieldsCount.replace("{n}", String(fields.length))) +',
    '    \'</div>\';',
    '  var legacyNote=BOOT.hasV1ContextHeading?\'<div class="legacy-note">\'+escHtml(I.legacyContextNote)+\'</div>\':"";',
    '  var extractCard=\'<div class="extract-card"><span class="icon">\\uD83E\\uDD16</span><div class="body"><div class="title">\'+escHtml(I.autoExtractTitle)+\'</div><div class="sub">\'+escHtml(I.autoExtractSubtitle)+\'</div></div><button class="btn btn-primary" onclick="openAutoExtract()">\'+escHtml(I.autoExtractBtn)+\'</button></div>\';',
    '  var fieldsHtml="";',
    '  if(fields.length===0){fieldsHtml=\'<div class="empty">No context fields for this template.</div>\';}',
    '  for(var i=0;i<fields.length;i++){',
    '    fieldsHtml+=renderField(fields[i]);',
    '  }',
    '  var translationHtml=BOOT.translationLanguages&&BOOT.translationLanguages.length?renderTranslationToggle():"";',
    '  el("body").innerHTML=subtitleHtml+fieldsCountHtml+legacyNote+extractCard+fieldsHtml+translationHtml;',
    '  bindFieldEvents();',
    '}',
    'function currentTemplateLabel(){',
    '  if(!BOOT||!BOOT.templates) return state.templateId||"";',
    '  for(var i=0;i<BOOT.templates.length;i++){if(BOOT.templates[i].id===state.templateId) return BOOT.templates[i].label;}',
    '  return state.templateId||"";',
    '}',
    'function renderField(f){',
    '  var v=state.contextValues[f.key]; if(v===undefined||v===null) v=(f.type==="tags")?[]:"";',
    '  var labelHtml=\'<label class="field-label">\'+escHtml(f.label)+(f.required?\' <span class="req">*</span>\':"")+\'</label>\';',
    '  if(f.type==="text"){',
    '    return \'<div class="field-group">\'+labelHtml+\'<textarea class="field-input field-textarea" data-key="\'+escHtml(f.key)+\'" placeholder="\'+escHtml(f.placeholder||"")+\'">\'+escHtml(v||"")+\'</textarea></div>\';',
    '  }',
    '  if(f.type==="tags"){',
    '    var existingTags=Array.isArray(v)?v:[];',
    '    var tagsHtml=\'\';',
    '    for(var ti=0;ti<existingTags.length;ti++){',
    '      var tval=existingTags[ti];',
    '      tagsHtml+=\'<span class="tag" data-key="\'+escHtml(f.key)+\'" data-tag="\'+escHtml(tval)+\'">\'+escHtml(tval)+\' <span class="remove" onclick="removeTag(this)">\\u00d7</span></span>\';',
    '    }',
    '    var optionsList=(f.options&&f.options.length)?\' list="opts-\'+escHtml(f.key)+\'"\':\'\';',
    '    var datalist=(f.options&&f.options.length)?\'<datalist id="opts-\'+escHtml(f.key)+\'">\'+f.options.map(function(o){return \'<option value="\'+escHtml(o)+\'">\';}).join("")+\'</datalist>\':\'\';',
    '    return \'<div class="field-group">\'+labelHtml+\'<div class="tags" data-key="\'+escHtml(f.key)+\'">\'+tagsHtml+\'<input type="text" class="tag-input" placeholder="\'+escHtml(I.addTag)+\'" data-key="\'+escHtml(f.key)+\'"\'+optionsList+\' onkeydown="onTagKey(event,this)">\'+datalist+\'</div></div>\';',
    '  }',
    '  return \'<div class="field-group">\'+labelHtml+\'<input type="text" class="field-input" data-key="\'+escHtml(f.key)+\'" value="\'+escHtml(v||"")+\'" placeholder="\'+escHtml(f.placeholder||"")+\'"></div>\';',
    '}',
    'function renderTranslationToggle(){',
    '  var langs=BOOT.translationLanguages||[];',
    '  var on=state.translationEnabled?" on":"";',
    '  return \'<div class="translation-row"><div><div style="font-weight:500;">\'+escHtml(I.translationLabel)+\'</div><div style="font-size:11px;color:#5f6368;">\'+escHtml(langs.join(", "))+\'</div></div><div id="trToggle" class="translation-toggle\'+on+\'" onclick="toggleTranslation()"></div></div>\';',
    '}',
    'function toggleTranslation(){',
    '  state.translationEnabled=!state.translationEnabled;',
    '  var t=el("trToggle"); if(t){t.className="translation-toggle"+(state.translationEnabled?" on":"");}',
    '}',
    'function bindFieldEvents(){',
    '  var inputs=document.querySelectorAll(".field-input");',
    '  inputs.forEach(function(i){',
    '    i.addEventListener("input",function(){',
    '      var k=i.getAttribute("data-key");',
    '      state.contextValues[k]=i.value;',
    '    });',
    '  });',
    '}',
    'function onTagKey(e,inp){',
    '  if(e.key==="Enter"||e.key===","){',
    '    e.preventDefault();',
    '    var v=String(inp.value||"").trim().replace(/,$/,"");',
    '    if(!v) return;',
    '    var k=inp.getAttribute("data-key");',
    '    var arr=Array.isArray(state.contextValues[k])?state.contextValues[k].slice():[];',
    '    if(arr.indexOf(v)<0){arr.push(v);}',
    '    state.contextValues[k]=arr;',
    '    inp.value="";',
    '    var container=inp.parentElement;',
    '    var tagEl=document.createElement("span");',
    '    tagEl.className="tag";',
    '    tagEl.setAttribute("data-key",k);',
    '    tagEl.setAttribute("data-tag",v);',
    '    tagEl.innerHTML=escHtml(v)+\' <span class="remove" onclick="removeTag(this)">\\u00d7</span>\';',
    '    container.insertBefore(tagEl,inp);',
    '  }',
    '}',
    'function removeTag(span){',
    '  var tag=span.parentElement;',
    '  var k=tag.getAttribute("data-key");',
    '  var v=tag.getAttribute("data-tag");',
    '  var arr=Array.isArray(state.contextValues[k])?state.contextValues[k].slice():[];',
    '  var idx=arr.indexOf(v); if(idx>=0)arr.splice(idx,1);',
    '  state.contextValues[k]=arr;',
    '  tag.parentElement.removeChild(tag);',
    '}',
    'function openAutoExtract(){',
    '  google.script.run.openExtractContextDialog();',
    '  google.script.host.close();',
    '}',
    'function finishWizard(){',
    '  el("doneBtn").disabled=true;',
    '  el("doneBtn").textContent=I.saving;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r&&r.ok){',
    '      setStatus("success",r.message||"");',
    '      setTimeout(function(){google.script.host.close();},700);',
    '    } else {',
    '      setStatus("error",(r&&r.message)||"Save failed");',
    '      el("doneBtn").disabled=false;',
    '      el("doneBtn").textContent=I.doneBtn+" \\u2713";',
    '    }',
    '  }).withFailureHandler(function(e){',
    '    setStatus("error",e.message||String(e));',
    '    el("doneBtn").disabled=false;',
    '    el("doneBtn").textContent=I.doneBtn+" \\u2713";',
    '  }).saveSetupWizard({templateId:state.templateId,context:state.contextValues,translationEnabled:state.translationEnabled});',
    '}',
    'function openAdvancedGallery(){',
    '  google.script.run.showTemplateGalleryDialog();',
    '  google.script.host.close();',
    '}',
    'bootstrap();',
    '</script>',
    '</body></html>'
  ];
  return parts.join('\n');
}
