/**
 * Template Gallery for Metric Book Transcriber.
 * Provides a registry of region/religion-specific transcription templates,
 * each with a complete Gemini prompt and context block defaults.
 * Selected template ID is stored in Document Properties (per-document).
 */

var TEMPLATE_ID_PROPERTY = 'SELECTED_TEMPLATE_ID';
var DEFAULT_TEMPLATE_ID = 'galicia_gc';

// ---------------------------------------------------------------------------
// Template registry
// ---------------------------------------------------------------------------

var TEMPLATES = {
  galicia_gc: {
    id: 'galicia_gc',
    label: 'Galician Greek Catholic (19th c.)',
    region: 'Galicia (Austrian Empire)',
    religion: 'Greek Catholic',
    recordTypes: 'Birth, Marriage, Death',
    description: 'Latin/Polish/Ukrainian registers from Galician Greek Catholic parishes. ' +
      'Column headers in Latin with Cyrillic equivalents. Names in Latinized form (Joannes, Eudocia). ' +
      'Surnames follow Polish orthography. Social status noted in Latin (agricolae, subditi).'
  },
  russian_orthodox: {
    id: 'russian_orthodox',
    label: 'Russian Imperial Orthodox (Metricheskaya Kniga)',
    region: 'Russian Empire',
    religion: 'Orthodox',
    recordTypes: 'Birth, Marriage, Death',
    description: 'Pre-reform Russian Cyrillic registers with Church Slavonic influence. ' +
      'Column headers in pre-reform Russian (Ѣ, І, Ѳ, ъ). Patronymics standard. ' +
      'Social estates (крестьянинъ, мещанинъ, военный поселянинъ). Julian calendar dates.'
  },
  generic_plain: {
    id: 'generic_plain',
    label: 'Generic — verbatim text (letters, typescript, etc.)',
    region: 'Any source',
    religion: 'N/A',
    recordTypes: 'General manuscript or typescript',
    description: 'Handwritten letters, typescript pages, notes, or any non-tabular text. ' +
      'Transcribe as close to the original as possible in the original language and script; preserve details and layout cues.'
  }
};

// ---------------------------------------------------------------------------
// Template management functions
// ---------------------------------------------------------------------------

function getTemplateRegistry() {
  return TEMPLATES;
}

function getTemplateById(id) {
  return TEMPLATES[id] || null;
}

function getSelectedTemplateId() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var id = props.getProperty(TEMPLATE_ID_PROPERTY);
    if (!id) return DEFAULT_TEMPLATE_ID;
    // OOB template
    if (TEMPLATES[id]) return id;
    // Custom template — verify it exists
    if (id.indexOf(CUSTOM_ID_PREFIX) === 0) {
      if (resolveCustomTemplate(id)) return id;
      Logger.log('getSelectedTemplateId: custom template not found, using default. id=' + id);
    }
  } catch (e) {
    Logger.log('getSelectedTemplateId: error reading doc props, using default. ' + e.message);
  }
  return DEFAULT_TEMPLATE_ID;
}

function setSelectedTemplateId(id) {
  if (!TEMPLATES[id] && id.indexOf(CUSTOM_ID_PREFIX) !== 0) {
    throw new Error('Unknown template ID: ' + id);
  }
  PropertiesService.getDocumentProperties().setProperty(TEMPLATE_ID_PROPERTY, id);
}

function getPromptForTemplate(templateId) {
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom && custom.sections) return assemblePromptFromSections(custom.sections);
    Logger.log('getPromptForTemplate: custom template not found, falling back. id=' + templateId);
  }
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxPrompt();
    case 'generic_plain':
      return getGenericPlainPrompt();
    case 'galicia_gc':
    default:
      return getGaliciaGcPrompt();
  }
}

function getContextDefaultsForTemplate(templateId) {
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom && custom.contextDefaults) return custom.contextDefaults;
    Logger.log('getContextDefaultsForTemplate: custom not found, falling back. id=' + templateId);
  }
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxContextDefaults();
    case 'generic_plain':
      return getGenericPlainContextDefaults();
    case 'galicia_gc':
    default:
      return getGaliciaGcContextDefaults();
  }
}

/**
 * Returns template metadata for the client-side dialog.
 */
function getTemplateListForClient() {
  var selectedId = getSelectedTemplateId();
  var list = [];
  for (var key in TEMPLATES) {
    if (!TEMPLATES.hasOwnProperty(key)) continue;
    var tpl = TEMPLATES[key];
    var tid = tpl.id;
    list.push({
      id: tid,
      label: t('template.' + tid + '.label'),
      region: t('template.' + tid + '.region'),
      religion: t('template.' + tid + '.religion'),
      recordTypes: t('template.' + tid + '.recordTypes'),
      description: t('template.' + tid + '.description'),
      isSelected: tid === selectedId
    });
  }
  return list;
}

/**
 * Returns the label of the currently selected template (OOB or custom).
 * Used by the sidebar to display the active template name.
 */
function getSelectedTemplateLabelForClient() {
  var selectedId = getSelectedTemplateId();
  if (TEMPLATES[selectedId]) {
    return t('template.' + selectedId + '.label');
  }
  if (selectedId && selectedId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(selectedId);
    if (custom && custom.label) return custom.label;
  }
  return '';
}

/**
 * Returns the full prompt text for preview in the dialog.
 */
function getPromptPreviewForClient(templateId) {
  if (!TEMPLATES[templateId] && !(templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0 && resolveCustomTemplate(templateId))) {
    return t('template.preview_unknown');
  }
  return getPromptForTemplate(templateId);
}

/**
 * Returns the fully assembled prompt (template + document context) for clipboard copy.
 * Mirrors the exact text that buildPrompt() sends to the Gemini API.
 */
function getFullPromptForClient(templateId) {
  if (!TEMPLATES[templateId] && !(templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0 && resolveCustomTemplate(templateId))) return '';
  var template = getPromptForTemplate(templateId);
  var context = '';
  try {
    var doc = DocumentApp.getActiveDocument();
    if (doc) context = getContextFromDocument(doc) || '';
  } catch (e) {
    Logger.log('getFullPromptForClient: could not read doc context: ' + e.message);
  }
  return template.replace(/\{\{CONTEXT\}\}/g, context || '(No context provided.)');
}

/**
 * Returns structured preview sections for the tabbed preview panel.
 * Splits the prompt on #### headers and adds the context defaults tab.
 */
function getTemplateSectionsForClient(templateId) {
  // Custom template — read sections directly
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom) {
      var documentContext = '';
      try {
        var doc = DocumentApp.getActiveDocument();
        if (doc) documentContext = getContextFromDocument(doc) || '';
      } catch (e) {
        Logger.log('getTemplateSectionsForClient: could not read doc context: ' + e.message);
      }
      return {
        documentContext: documentContext,
        hasDocumentContext: documentContext.length > 0,
        contextDefaults: custom.contextDefaults || '',
        role: custom.sections.role || '',
        columns: custom.sections.inputStructure || '',
        outputFormat: custom.sections.outputFormat || '',
        instructions: custom.sections.instructions || ''
      };
    }
  }

  if (!TEMPLATES[templateId]) {
    return { documentContext: '', hasDocumentContext: false, contextDefaults: '', role: '', columns: '', outputFormat: '', instructions: '' };
  }
  var prompt = getPromptForTemplate(templateId);
  var contextDefaults = getContextDefaultsForTemplate(templateId);

  var documentContext = '';
  try {
    var doc = DocumentApp.getActiveDocument();
    if (doc) documentContext = getContextFromDocument(doc) || '';
  } catch (e) {
    Logger.log('getTemplateSectionsForClient: could not read doc context: ' + e.message);
  }

  var sections = { role: '', columns: '', outputFormat: '', instructions: '' };
  var parts = prompt.split(/^####\s+/m);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var firstNewline = part.indexOf('\n');
    var header = (firstNewline > 0 ? part.substring(0, firstNewline) : part).trim();
    var body = firstNewline > 0 ? part.substring(firstNewline + 1).trim() : '';
    if (header === 'Role') sections.role = body;
    else if (header === 'Input Template Description') sections.columns = body;
    else if (header === 'Output Format') sections.outputFormat = body;
    else if (header === 'Instructions') sections.instructions = body;
  }
  return {
    documentContext: documentContext,
    hasDocumentContext: documentContext.length > 0,
    contextDefaults: contextDefaults,
    role: sections.role,
    columns: sections.columns,
    outputFormat: sections.outputFormat,
    instructions: sections.instructions
  };
}

/**
 * Server function called from the Template Gallery dialog.
 * Saves template ID to Document Properties and optionally scaffolds the Context block.
 *
 * When updateContext is true:
 *   - If no Context block exists: creates one with template defaults.
 *   - If a Context block exists: merges missing field labels from template
 *     defaults without overwriting existing values.
 */
function applyTemplate(templateId, updateContext) {
  try {
    // Resolve template — OOB or custom
    var isCustom = templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0;
    var customTpl = isCustom ? resolveCustomTemplate(templateId) : null;
    if (!TEMPLATES[templateId] && !customTpl) {
      return { ok: false, message: t('template.unknown', { id: templateId }) };
    }
    setSelectedTemplateId(templateId);
    var locLabel = isCustom ? (customTpl.label || templateId) : t('template.' + templateId + '.label');
    var msg = t('template.applied', { name: locLabel });

    if (updateContext) {
      var doc = DocumentApp.getActiveDocument();
      if (doc) {
        var body = doc.getBody();
        var contextRange = getContextRange(body);
        if (!contextRange || contextRange.end <= contextRange.start) {
          ensureContextBlock(doc);
          msg += t('template.context_created');
        } else {
          var added = mergeTemplateLabelScaffold(body, contextRange, templateId);
          if (added.length > 0) {
            msg += t('template.fields_added', { fields: added.join(', ') });
          } else {
            msg += t('template.fields_none');
          }
        }
      }
    }

    Logger.log('applyTemplate: ' + templateId + ', updateContext=' + updateContext);
    return { ok: true, message: msg };
  } catch (e) {
    Logger.log('applyTemplate error: ' + e.message);
    return { ok: false, message: t('template.apply_error', { detail: e.message }) };
  }
}

/**
 * Adds missing field labels from template defaults to an existing context block.
 * Never overwrites existing values — only appends labels that are absent.
 * Returns array of label names that were added.
 */
function mergeTemplateLabelScaffold(body, range, templateId) {
  var defaults = getContextDefaultsForTemplate(templateId);
  var lines = defaults.split('\n');
  var templateLabels = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].replace(/^\*+/, '').replace(/\*+/g, '').trim();
    var colon = line.indexOf(':');
    if (colon > 0) {
      var key = line.substring(0, colon).trim().toUpperCase();
      if (key === 'ARCHIVE_NAME' || key === 'ARCHIVE_REFERENCE' ||
          key === 'DOCUMENT_DESCRIPTION' || key === 'DATE_RANGE' ||
          key === 'VILLAGES' || key === 'COMMON_SURNAMES') {
        templateLabels.push(key);
      }
    }
  }

  var existingLabels = {};
  for (var j = range.start + 1; j <= range.end; j++) {
    var el = body.getChild(j);
    if (el.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    var txt = el.asParagraph().getText().trim();
    var normalized = normalizeContextLabelPrefix(txt);
    if (normalized) existingLabels[normalized] = true;
  }

  var added = [];
  var insertAt = range.end + 1;
  for (var k = 0; k < templateLabels.length; k++) {
    var label = templateLabels[k];
    if (existingLabels[label]) continue;
    var para = body.insertParagraph(insertAt, label + ':');
    var paraText = para.editAsText();
    paraText.setBold(0, label.length - 1, true);
    insertAt++;
    range.end++;
    added.push(label);
  }
  return added;
}

// ---------------------------------------------------------------------------
// Galician Greek Catholic prompt
// ---------------------------------------------------------------------------

function getGaliciaGcPrompt() {
  return [
    '#### Role',
    '',
    'You are an expert archivist and paleographer specializing in 19th and early 20th-century Galician (Austrian/Polish/Ukrainian) vital records. Your task is to extract and transcribe handwritten text from the attached image of a metric book (birth, marriage, or death register).',
    '',
    '#### Context',
    '',
    '{{CONTEXT}}',
    '',
    '#### Input Template Description',
    '',
    'Metric Book may contain mix of different table formats for births, deaths, marriage records.',
    '',
    '**Linguistic hints:**',
    '- Primary language is Latin with Cyrillic (Ukrainian/Russian) equivalents in column headers.',
    '- Surnames follow Polish orthography (w instead of v, cz instead of ch, sz instead of sh).',
    '- Given names are Latinized: Joannes (Ivan), Nicolaus (Mykola), Eudocia (Yevdokiya), Parasceva (Paraskeva).',
    '- Common abbreviations: fil. (filius/filia = son/daughter of), ux. (uxor = wife), agr./agricolae (farmers), lab./laboriosus (laborer).',
    '- Parentage formula: "X fil. Y et Z" = X son/daughter of Y and Z.',
    '- Religion marks: r.g. or ritus graeci (Greek Catholic), cathol. (Roman Catholic), "/" or "." as check marks.',
    '- Social status: subditi (subjects), agricolae (farmers), laboriosus (laborer), militaris (military).',
    '',
    '**Births (Рожденъ / Natus):** Natus/Born (Мѣсяцъ/Mensis), Baptisatus/Baptized, Confirmatus/Confirmed, Numerus domus/House Number, Nomen/Name (Child), Religio: Cathol./Aut alia, Sexus: Puer/Puella, Thori: Legitimi/Illegitimi, Parentes/Parents: Nomen + Conditio, Patrini/Godparents: Nomen + Conditio.',
    '',
    '**Deaths (Число поряд. / Numerus posit.):** Record Number, Mortis/Date of Death (Mensis/Dies), Sepult./Date of Burial, Numerus domus/House Number, Nomen et cognomen mortui/Name of Deceased (with spouse or parentage), Religio catholica/Catholic, Sexus: Masculinus/Femininus, Anno vitae/Age, Morbus et qualitas mortis/Cause of Death.',
    '',
    '**Marriages (Число поряд. / Numerus posit.):** Record Number, Mensis/Date of Marriage, Numerus domus/House Number, Sponsus/Groom: Nomen + Religio + Aetas + Coelebs/Viduus, Sponsa/Bride: Nomen + Religio + Aetas + Coelebs/Vidua, Testes/Witnesses: Nomen + Conditio.',
    '',
    '#### Output Format',
    '',
    'Output must be formatted for readability in a document.',
    'Use **bold** for labels, names, and key attributes (e.g., **Name:**, **Parents:**).',
    'Do NOT use bullet points for the main record data. Use standard paragraphs.',
    'Use blank lines to separate records.',
    '',
    'Page Header: Extract metadata from top of page: year, page number (Pagina), archival signatures (Fond/Opis/Case), village names in header.',
    '',
    'Record Output: For EACH record provide the following as standard lines of text (NO bullets):',
    '**Address:** First line (village, house number).',
    '**Name:** Person (births/deaths) or groom and bride (marriages).',
    '**Parents:** (and their parents if available).',
    '**Godparents/Witnesses:** Godparents (births) or witnesses (marriages).',
    '**Notes:** Any marginal notes.',
    '',
    '**Quality Metrics:** Handwriting Quality (e.g., 3/5), Trust Score (e.g., 4/5).',
    '**Assessment:** Quality of Output (e.g., 2/5), Corrections Notes.',
    '',
    'Provide the language summaries formatted as a bulleted list below each record.',
    'IMPORTANT: Use these exact language labels verbatim — do not expand, abbreviate, or modify them:',
    '- **ru:** [Summary in Russian]',
    '- **uk:** [Summary in Ukrainian]',
    '- **latin:** [Original Latin transcription]',
    '- **en:** [Summary in English]',
    'For Russian and Ukrainian use appropriate modern Western Ukrainian surname equivalents. Only transcribed text.',
    '',
    'Repeat Quality Metrics and Assessment under each record, not once for the whole document.',
    '',
    '#### Instructions',
    '',
    'Step 1: Extract page header metadata (year, page number, Fond/Opis/Case if visible, village names).',
    '',
    'Step 2: For each record provide structured summary in Russian, Ukrainian, Latin, and English per the record output format above.',
    '',
    'Transcription accuracy: Transcribe exactly as written; preserve spelling and abbreviations. If unclear use [illegible] or [possibly X]. Village name may appear in header or under house number column.'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Russian Imperial Orthodox prompt
// ---------------------------------------------------------------------------

function getRussianOrthodoxPrompt() {
  return [
    '#### Role',
    '',
    'You are an expert archivist and paleographer specializing in 19th and early 20th-century Russian Imperial Orthodox vital records (Метрическая книга). Your task is to extract and transcribe handwritten text from the attached image of a metric book (birth, marriage, or death register) written in pre-reform Russian Cyrillic, often with Church Slavonic influence.',
    '',
    '#### Context',
    '',
    '{{CONTEXT}}',
    '',
    '#### Input Template Description',
    '',
    'Russian Imperial metric books are divided into three parts (три части): Part I — births (о родившихся), Part II — marriages (о бракосочетавшихся), Part III — deaths (об умерших).',
    '',
    '**Linguistic hints:**',
    '- Text is in pre-reform Russian with letters: Ѣ (yat), І (decimal i), Ѳ (fita), Ѵ (izhitsa), ъ (hard sign at end of words), ѧ (little yus in Church Slavonic passages).',
    '- Church Slavonic diacritics may appear: titlo (combining marks), stress marks (acute/grave accents over vowels).',
    '- Transcribe pre-reform spelling as-is in the original transcription; provide modern Russian/Ukrainian equivalents in summaries.',
    '- Patronymics are standard: Иванъ Петровичъ (Ivan son of Pyotr). Women use feminine forms: Мария Ивановна.',
    '- Social estates: крестьянинъ (peasant), мещанинъ (townsman), дворянинъ (nobleman), военный поселянинъ (military settler), купецъ (merchant), священникъ (priest), дьячокъ/дьякъ (deacon/clerk).',
    '- Common abbreviations: кр. (крестьянинъ), мещ. (мещанинъ), свящ. (священникъ).',
    '- Dates are Julian calendar (Old Style) — transcribe as written, do not convert.',
    '- "Кто совершалъ таинство" = who performed the sacrament (priest name and rank).',
    '- "Восприемники" = godparents (births), "Поручители" = guarantors/witnesses (marriages).',
    '',
    '**Births (Часть первая о родившихся):**',
    '- Счетъ родившихся (Record count): may be split Мужеска/Женска (Male/Female)',
    '- Мѣсяцъ и день рожденія (Month and day of birth)',
    '- Мѣсяцъ и день крещенія (Month and day of baptism)',
    '- Имена родившихся (Name of the newborn)',
    '- Званіе, имя, отчество и фамилія родителей и какого вѣроисповѣданія (Title, name, patronymic, surname of parents and their religion)',
    '- Званіе, имя, отчество и фамилія воспріемниковъ (Title, name, patronymic, surname of godparents)',
    '- Кто совершалъ таинство крещенія (Who performed the baptism sacrament)',
    '',
    '**Deaths (Часть третья объ умершихъ):**',
    '- Счетъ умершихъ: Мужеска/Женска (Record count: Male/Female)',
    '- Мѣсяцъ и день: Смерти/Погребенія (Month and day: Death/Burial)',
    '- Званіе, имя, отчество и фамилія умершаго (Title, name, patronymic, surname of deceased)',
    '- Лѣта умершаго: Мужеска/Женска (Age of deceased: Male/Female)',
    '- Отъ чего умеръ / Слабость и родъ смерти (Cause of death — often archaic medical terms)',
    '- Common causes: отъ чахотки (consumption/TB), отъ горячки (fever), отъ оспы (smallpox), отъ старости (old age), отъ родовъ (childbirth)',
    '',
    '**Marriages (Часть вторая о бракосочетавшихся):**',
    '- Счетъ браковъ (Record count)',
    '- Мѣсяцъ и день (Month and day of marriage)',
    '- Званіе, имя, отчество, фамилія и вѣроисповѣданіе жениха, и которымъ бракомъ (Title, name, patronymic, surname, religion of groom, and which marriage)',
    '- Лѣта жениха (Age of groom)',
    '- Званіе, имя, отчество, фамилія и вѣроисповѣданіе невѣсты, и которымъ бракомъ (Title, name, patronymic, surname, religion of bride, and which marriage)',
    '- Лѣта невѣсты (Age of bride)',
    '- Кто были поручители (Who were the guarantors/witnesses)',
    '- Кто совершалъ таинство (Who performed the sacrament)',
    '',
    '**Note on format variation across periods:**',
    '- 18th-century registers may use minimal columns (Номъ, Числа, narrative text, Лета).',
    '- 1840s registers use simplified pre-reform spelling without full Church Slavonic diacritics.',
    '- 1870–1919 registers use elaborate Church Slavonic diacritics and titlo marks.',
    '- The model should adapt to whichever format variant appears in the image.',
    '',
    '#### Output Format',
    '',
    'Output must be formatted for readability in a document.',
    'Use **bold** for labels, names, and key attributes (e.g., **Name:**, **Parents:**).',
    'Do NOT use bullet points for the main record data. Use standard paragraphs.',
    'Use blank lines to separate records.',
    '',
    'Page Header: Extract metadata from top of page: year, page number, archival signatures (Фонд/Опись/Дело if visible), village or parish names in header.',
    '',
    'Record Output: For EACH record provide the following as standard lines of text (NO bullets):',
    '**Address:** First line (village/settlement, house number if present).',
    '**Name:** Person (births/deaths) or groom and bride (marriages), with patronymic.',
    '**Parents:** (and their parents if available), with social estate.',
    '**Godparents/Witnesses:** Godparents/воспріемники (births) or witnesses/поручители (marriages).',
    '**Clergy:** Who performed the sacrament.',
    '**Notes:** Any marginal notes.',
    '',
    '**Quality Metrics:** Handwriting Quality (e.g., 3/5), Trust Score (e.g., 4/5).',
    '**Assessment:** Quality of Output (e.g., 2/5), Corrections Notes.',
    '',
    'Provide the language summaries formatted as a bulleted list below each record.',
    'IMPORTANT: Use these exact language labels verbatim — do not expand, abbreviate, or modify them:',
    '- **ru:** [Summary in modern Russian]',
    '- **uk:** [Summary in Ukrainian]',
    '- **original:** [Original transcription preserving pre-reform Cyrillic orthography exactly as written]',
    '- **en:** [Summary in English]',
    'For Russian and Ukrainian use appropriate modern surname equivalents. Only transcribed text.',
    '',
    'Repeat Quality Metrics and Assessment under each record, not once for the whole document.',
    '',
    '#### Instructions',
    '',
    'Step 1: Extract page header metadata (year, page number, Фонд/Опись/Дело if visible, village/parish names).',
    '',
    'Step 2: For each record provide structured summary in Russian, Ukrainian, original pre-reform transcription, and English per the record output format above.',
    '',
    'Transcription accuracy: Transcribe exactly as written; preserve pre-reform spelling, ъ endings, Ѣ, І, Ѳ, and all diacritics. If unclear use [illegible] or [possibly X]. Convert to modern equivalents only in the ru/uk/en summaries, not in the original transcription.'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Generic verbatim transcription (letters, typescript, non-metric documents)
// ---------------------------------------------------------------------------

function getGenericPlainPrompt() {
  return [
    '#### Role',
    '',
    'You are an expert transcriber of historical and modern handwritten and typewritten documents. ' +
      'Your task is to read the attached image and produce a faithful transcription. ' +
      'The source may be a personal letter, typescript, diary page, official memo, envelope, postcard, marginal notes, or any non-tabular text — not necessarily a metric register.',
    '',
    '#### Context',
    '',
    '{{CONTEXT}}',
    '',
    '#### Input Template Description',
    '',
    '**Goal:** Transcribe the visible text **as literally as possible**, staying close to the **original language(s)** and **original spelling/orthography** (including outdated spellings, dialect forms, and errors the author made).',
    '',
    '**Do:**',
    '- Preserve paragraph breaks where they are clear; use a single blank line between paragraphs.',
    '- If the page has distinct blocks (e.g. address block, date line, body, postscript), keep that order and separate blocks with a blank line.',
    '- For line breaks that matter in poetry, lists, or formal salutations, preserve them (you may use a line break within the paragraph).',
    '- Transcribe letterhead, stamps, and printed form labels if they contain readable text; mark clearly as [printed] when helpful.',
    '- For mixed languages on one page, transcribe each part in its original language and script.',
    '',
    '**Do not:**',
    '- Do not modernize spelling or grammar in the main transcription.',
    '- Do not translate the main body into another language (translation belongs only in the short summaries below).',
    '- Do not invent text; for unreadable portions use [illegible], [torn], [faded], or [possibly: guess] when you have a weak hypothesis.',
    '',
    '**Typewritten text:** Preserve spacing quirks, obvious typos, and strikeouts (e.g. ~~word~~ or "struck: word").',
    '',
    '**Handwriting:** When a word is ambiguous, prefer marking uncertainty over guessing.',
    '',
    '#### Output Format',
    '',
    'Output must be easy to read in a Google Doc.',
    '',
    'Use this structure:',
    '',
    '**Transcription (original language / script):**',
    '(The full verbatim transcription — this is the main deliverable. Use **bold** only for headings within the image such as printed form titles, not for every line.)',
    '',
    'Then provide the following bulleted lines **verbatim labels** (do not rename them):',
    '- **original:** One-line restatement: primary language(s) and script(s) used in the document (e.g. "Polish (Latin script)", "Russian pre-reform Cyrillic", "Mixed German and Ukrainian").',
    '- **en:** 2–4 sentences in English: what the document appears to be, approximate date or place if visible, and purpose if inferable. Do not repeat the full transcription here.',
    '- **ru:** If the document contains Russian: 1–3 sentences in modern Russian summarizing content; if none, write exactly: Not applicable (no Russian text).',
    '- **uk:** If the document contains Ukrainian (any stage/history): 1–3 sentences in modern Ukrainian summarizing content; if none, write exactly: Not applicable (no Ukrainian text).',
    '',
    '#### Instructions',
    '',
    'Step 1: Scan the entire image (margins, verso cues if visible, postmarks, seals with text).',
    '',
    'Step 2: Transcribe all readable text in original form in the **Transcription** section.',
    '',
    'Step 3: Add the four bullet lines **original**, **en**, **ru**, **uk** as specified.'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Context block defaults
// ---------------------------------------------------------------------------

function getGaliciaGcContextDefaults() {
  return [
    '**ARCHIVE_NAME**: ДАЙФО',
    '**ARCHIVE_REFERENCE**: Ф. 631, оп. 12, спр. 33',
    '**DOCUMENT_DESCRIPTION**: «Метрична книга церкви реєстрації народження, шлюбу та смерті» для с. Темирівці, с. Селище, с. Крилос, с. Козина',
    '**DATE_RANGE**: 11.01.1885–15.12.1942',
    '**VILLAGES**:',
    'Основные села прихода:',
    'Темеровці (Temerowce) - центр прихода, гміна',
    'Селище (Sieliska)',
    '',
    'Близлежащие села, которые могли относиться к приходу Темеровці или быть упомянуты в записях:',
    'Колодиев (Kołodziejów)',
    'Крылос (Kryłos)',
    'Козина (Kozyna)',
    'Нимшин (Nimszyn)',
    'Остров (Ostrów)',
    'Пукасовцы (Pukasowce)',
    'Сапогов (Sapohów)',
    'Слободка (Słobódka)',
    'Хоростков (Chorostków)',
    '',
    '**COMMON_SURNAMES**:',
    'Дубель (Dubel)',
    'Рега (Rega)',
    'Балащук (Balaszczuk)',
    'Шотурма (Szoturma)',
    'Гулик (Hulick)'
  ].join('\n');
}

function getRussianOrthodoxContextDefaults() {
  return [
    '**ARCHIVE_NAME**: ГАКО (Государственный архив)',
    '**ARCHIVE_REFERENCE**: Фонд ___, Опись ___, Дело ___',
    '**DOCUMENT_DESCRIPTION**: Метрическая книга ___ церкви, о родившихся, бракосочетавшихся и умерших',
    '**DATE_RANGE**: ___–___',
    '**VILLAGES**:',
    'Основные села/поселения прихода:',
    '(Укажите село или приход)',
    '',
    '**COMMON_SURNAMES**:',
    '(Укажите распространённые фамилии)'
  ].join('\n');
}

function getGenericPlainContextDefaults() {
  return [
    '**ARCHIVE_NAME**: (optional — repository or collection name if known)',
    '**ARCHIVE_REFERENCE**: (optional — call number, box/folder)',
    '**DOCUMENT_DESCRIPTION**: e.g. Personal letter, typescript memoir fragment, parish correspondence, field notes (describe what you are transcribing)',
    '**DATE_RANGE**: (approximate dates of the document or correspondence, if known)',
    '**VILLAGES**:',
    '(places, addresses, or geographic hints helpful for reading placenames)',
    '',
    '**COMMON_SURNAMES**:',
    '(family or institutional names that appear often in this file — helps disambiguate handwriting)'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function showTemplateGalleryDialog() {
  refreshAddonMenuForCurrentLocale();
  var html = getTemplateGalleryHtml();
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(620).setHeight(700),
    t('gallery.title')
  );
}

function getTemplateGalleryHtml() {
  var templates = getTemplateListForClient();
  var selectedId = getSelectedTemplateId();
  var giJson = stringifyForHtmlScript(getGalleryClientI18n());

  var cardsHtml = '';
  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];
    var checked = tpl.isSelected ? ' checked' : '';
    cardsHtml += '<label class="card' + (tpl.isSelected ? ' selected' : '') + '" data-id="' + esc(tpl.id) + '">' +
      '<input type="radio" name="template" value="' + esc(tpl.id) + '"' + checked + '>' +
      '<div class="card-body">' +
      '<div class="card-title">' + esc(tpl.label) + '</div>' +
      '<div class="card-meta">' + esc(tpl.region) + ' &middot; ' + esc(tpl.religion) + ' &middot; ' + esc(tpl.recordTypes) + '</div>' +
      '<div class="card-desc">' + esc(tpl.description) + '</div>' +
      '</div>' +
      '</label>';
  }

  var customTemplates = getCustomTemplateListForClient();
  var customCardsHtml = '';
  for (var ci = 0; ci < customTemplates.length; ci++) {
    var ct = customTemplates[ci];
    var cChecked = ct.id === selectedId ? ' checked' : '';
    var cSelected = ct.id === selectedId ? ' selected' : '';
    var badge = ct.isOwn ? '<span class="badge-custom">' + esc(t('gallery.badge_custom')) + '</span>'
                         : '<span class="badge-shared">' + esc(t('gallery.badge_shared')) + '</span>';
    var parentLine = ct.parentLabel ? '<div class="parent-link">' + esc(t('gallery.parent_link', { name: ct.parentLabel })) + '</div>' : '';
    var actionsHtml = '';
    if (ct.isOwn) {
      actionsHtml = '<div class="card-actions">' +
        '<button class="action-link" onclick="doEditCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_edit')) + '</button>' +
        '<button class="action-link" onclick="doDuplicateCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_duplicate')) + '</button>' +
        '<button class="action-link" onclick="doExportCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_export')) + '</button>' +
        '<button class="action-danger" onclick="doDeleteCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_delete')) + '</button>' +
        '</div>';
    } else {
      actionsHtml = '<div class="card-actions">' +
        '<button class="action-link" onclick="doDuplicateCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_duplicate')) + '</button>' +
        '</div>';
    }
    customCardsHtml += '<label class="card' + cSelected + '" data-id="' + esc(ct.id) + '">' +
      '<input type="radio" name="template" value="' + esc(ct.id) + '"' + cChecked + '>' +
      '<div class="card-body">' +
      '<div class="card-title-row"><span class="card-title">' + esc(ct.label) + '</span>' + badge + '</div>' +
      parentLine +
      '<div class="card-desc">' + esc(ct.description) + '</div>' +
      actionsHtml +
      '</div>' +
      '</label>';
  }

  var myTemplatesSectionHtml =
    '<div class="divider"></div>' +
    '<div class="section-header">' +
    '<span class="section-label" style="margin-bottom:0">' + esc(t('gallery.section_my')) + '</span>' +
    '<span class="section-counter">' + esc(t('gallery.my_counter', { count: customTemplates.length, max: MAX_CUSTOM_TEMPLATES })) + '</span>' +
    '</div>';

  if (customTemplates.length === 0) {
    myTemplatesSectionHtml +=
      '<div class="empty-state">' +
      '<p><b>' + esc(t('gallery.empty_title')) + '</b></p>' +
      '<p>' + esc(t('gallery.empty_hint')) + '</p>' +
      '</div>';
  } else {
    myTemplatesSectionHtml += '<div class="cards">' + customCardsHtml + '</div>';
  }

  myTemplatesSectionHtml +=
    '<div class="create-row">' +
    '<button class="create-btn" onclick="doCreateFromTemplate()">' + esc(t('gallery.create_from')) + '</button>' +
    '<button class="create-btn" onclick="doCreateBlank()">' + esc(t('gallery.create_blank')) + '</button>' +
    '</div>';

  var parts = [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; display: flex; flex-direction: column; height: calc(100vh - 32px); }',
    '',
    '.cards { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }',
    '.card { display: flex; align-items: flex-start; gap: 8px; border: 2px solid #dadce0; border-radius: 8px; padding: 12px; cursor: pointer; transition: border-color 0.15s; }',
    '.card:hover { border-color: #1a73e8; }',
    '.card.selected { border-color: #1a73e8; background: #e8f0fe; }',
    '.card input[type=radio] { margin-top: 3px; accent-color: #1a73e8; }',
    '.card-body { flex: 1; }',
    '.card-title { font-weight: bold; font-size: 14px; margin-bottom: 2px; }',
    '.card-meta { font-size: 11px; color: #5f6368; margin-bottom: 4px; }',
    '.card-desc { font-size: 12px; color: #444; line-height: 1.4; }',
    '.preview-toggle { background: none; border: none; color: #1a73e8; cursor: pointer; font-size: 12px; padding: 4px 0; margin-bottom: 4px; text-decoration: underline; }',
    '.preview-wrap { display: none; margin-bottom: 12px; border: 1px solid #dadce0; border-radius: 4px; overflow: hidden; }',
    '.preview-wrap.open { display: block; }',
    '.tab-bar { display: flex; border-bottom: 1px solid #dadce0; background: #f1f3f4; }',
    '.tab-btn { padding: 6px 10px; font-size: 11px; border: none; background: none; cursor: pointer; color: #5f6368; white-space: nowrap; border-bottom: 2px solid transparent; }',
    '.tab-btn:hover { color: #1a73e8; }',
    '.tab-btn.active { color: #1a73e8; border-bottom-color: #1a73e8; font-weight: bold; }',
    '.tab-content { max-height: 220px; overflow-y: auto; padding: 8px; font-family: "Roboto Mono", monospace; font-size: 11px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; background: #f8f9fa; }',
    '.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: auto; padding-top: 12px; border-top: 1px solid #eee; }',
    '.btn { padding: 8px 20px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.status { font-size: 12px; margin-top: 8px; padding: 8px; border-radius: 4px; display: none; }',
    '.status.success { display: block; background: #e6f4ea; color: #137333; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '',
    '.copy-icon-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #5f6368; transition: all 0.15s; }',
    '.copy-icon-btn:hover { border-color: #1a73e8; color: #1a73e8; background: #e8f0fe; }',
    '.copy-icon-btn svg { width: 16px; height: 16px; fill: currentColor; }',
    '.copy-bar { display: none; align-items: center; justify-content: space-between; padding: 6px 8px; background: #e8f0fe; border-bottom: 1px solid #c5d7f2; }',
    '.copy-bar.visible { display: flex; }',
    '.copy-bar-label { font-size: 11px; color: #3c4043; }',
    '.copy-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 4px; font-size: 11px; cursor: pointer; border: 1px solid #1a73e8; background: #1a73e8; color: #fff; font-weight: bold; }',
    '.copy-btn:hover { background: #1765cc; }',
    '.copy-btn svg { width: 14px; height: 14px; fill: currentColor; }',
    '.section-label { font-size: 11px; font-weight: bold; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }',
    '.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }',
    '.section-counter { font-size: 11px; color: #5f6368; }',
    '.divider { border-top: 1px solid #dadce0; margin: 16px 0; }',
    '.badge-custom { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: #e8f0fe; color: #1a73e8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; display: inline-block; margin-left: 6px; vertical-align: middle; }',
    '.badge-shared { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: #fef7e0; color: #e37400; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; display: inline-block; margin-left: 6px; vertical-align: middle; }',
    '.parent-link { font-size: 11px; color: #5f6368; margin-bottom: 4px; }',
    '.card-title-row { display: flex; align-items: center; margin-bottom: 2px; }',
    '.card-actions { display: flex; gap: 12px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee; }',
    '.card-actions button { font-size: 11px; background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; }',
    '.action-link { color: #1a73e8; }',
    '.action-danger { color: #c5221f; }',
    '.create-row { display: flex; gap: 8px; margin-top: 8px; }',
    '.create-btn { flex: 1; padding: 10px; border: 2px dashed #dadce0; border-radius: 8px; background: #f8f9fa; color: #1a73e8; font-size: 12px; cursor: pointer; font-weight: bold; transition: all 0.15s; text-align: center; }',
    '.create-btn:hover { border-color: #1a73e8; background: #e8f0fe; }',
    '.empty-state { text-align: center; padding: 16px; color: #5f6368; }',
    '.empty-state p { font-size: 12px; margin: 4px 0; line-height: 1.5; }',
    '.gallery-scroll { flex: 1; overflow-y: auto; min-height: 0; }',
    '.confirm-overlay { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.3); z-index: 100; align-items: center; justify-content: center; }',
    '.confirm-overlay.visible { display: flex; }',
    '.confirm-box { background: #fff; border-radius: 8px; padding: 20px; max-width: 340px; width: 90%; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }',
    '.confirm-box .confirm-msg { font-size: 13px; color: #333; margin-bottom: 16px; line-height: 1.5; }',
    '.confirm-box .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }',
    '.btn-danger { color: #fff; background: #c5221f; border-color: #c5221f; }',
    '.btn-danger:hover { background: #a81e1b; }',
    '</style>',
    '</head><body>',
    '<div class="gallery-scroll">',
    '<div style="text-align:right;margin-bottom:8px">',
    '  <button class="copy-icon-btn" id="cornerCopyBtn" onclick="doCopyPrompt()" title="' + esc(t('gallery.copy_prompt_hint')) + '">',
    '    <svg viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/></svg>',
    '    <span>' + esc(t('gallery.copy_prompt')) + '</span>',
    '  </button>',
    '</div>',
    '<div class="section-label">' + esc(t('gallery.section_official')) + '</div>',
    '<div class="cards" id="cards">' + cardsHtml + '</div>',
    '<button class="preview-toggle" id="previewToggle" onclick="togglePreview()">&#9654; ' + t('gallery.review') + '</button>',
    '<div class="preview-wrap" id="previewWrap">',
    '  <div class="tab-bar">',
    '    <button class="tab-btn active" data-tab="context" onclick="switchTab(this)">' + t('gallery.tab.context') + '</button>',
    '    <button class="tab-btn" data-tab="role" onclick="switchTab(this)">' + t('gallery.tab.role') + '</button>',
    '    <button class="tab-btn" data-tab="columns" onclick="switchTab(this)">' + t('gallery.tab.columns') + '</button>',
    '    <button class="tab-btn" data-tab="output" onclick="switchTab(this)">' + t('gallery.tab.output') + '</button>',
    '    <button class="tab-btn" data-tab="instructions" onclick="switchTab(this)">' + t('gallery.tab.instructions') + '</button>',
    '    <button class="tab-btn" data-tab="fullprompt" onclick="switchTab(this)">' + t('gallery.tab.full_prompt') + '</button>',
    '  </div>',
    '  <div class="copy-bar" id="copyBar">',
    '    <span class="copy-bar-label">' + esc(t('gallery.copy_prompt_hint')) + '</span>',
    '    <button class="copy-btn" onclick="doCopyPrompt()"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg> ' + esc(t('gallery.copy_to_clipboard')) + '</button>',
    '  </div>',
    '  <div class="tab-content" id="tabContent">' + t('gallery.select_tab') + '</div>',
    '</div>',
    myTemplatesSectionHtml,
    '<div id="statusMsg" class="status"></div>',
    '</div>',
    '<div class="actions">',
    '<button class="btn" onclick="google.script.host.close()">' + t('gallery.cancel') + '</button>',
    '<button class="btn btn-primary" id="applyBtn" onclick="doApply()">' + t('gallery.apply') + '</button>',
    '</div>',
    '<div class="confirm-overlay" id="confirmOverlay">',
    '  <div class="confirm-box">',
    '    <div class="confirm-msg" id="confirmMsg"></div>',
    '    <div class="confirm-actions">',
    '      <button class="btn" id="confirmNo" onclick="closeConfirm()">' + esc(t('gallery.cancel')) + '</button>',
    '      <button class="btn btn-danger" id="confirmYes"></button>',
    '    </div>',
    '  </div>',
    '</div>',
    '<script>',
    'var GI=', giJson, ';',
    'var CGI=', stringifyForHtmlScript(getCustomGalleryClientI18n()), ';',
    'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}',
    '',
    'var cards=document.querySelectorAll(".card");',
    'cards.forEach(function(c){',
    '  c.addEventListener("click",function(e){',
    '    if(e.target.closest(".card-actions")) return;',
    '    cards.forEach(function(x){x.classList.remove("selected");});',
    '    c.classList.add("selected");',
    '    c.querySelector("input[type=radio]").checked=true;',
    '    cachedFullPrompt=null;',
    '    if(document.getElementById("previewWrap").classList.contains("open")){loadSections(function(){showTab(currentTab);});}',
    '  });',
    '});',
    '',
    'function getSelectedId(){',
    '  var r=document.querySelector("input[name=template]:checked");',
    '  return r?r.value:"";',
    '}',
    '',
    'var cachedSections=null;',
    'var currentTab="context";',
    '',
    'function togglePreview(){',
    '  var w=document.getElementById("previewWrap");',
    '  var btn=document.getElementById("previewToggle");',
    '  if(w.classList.contains("open")){',
    '    w.classList.remove("open");',
    '    btn.innerHTML="&#9654; "+GI.review;',
    '  }else{',
    '    loadSections(function(){ showTab(currentTab); });',
    '    w.classList.add("open");',
    '    btn.innerHTML="&#9660; "+GI.hideReview;',
    '  }',
    '}',
    '',
    'function loadSections(cb){',
    '  var id=getSelectedId();',
    '  if(!id)return;',
    '  document.getElementById("tabContent").textContent=GI.loadingTab;',
    '  google.script.run.withSuccessHandler(function(s){',
    '    cachedSections=s;',
    '    if(cb)cb();',
    '  }).withFailureHandler(function(err){',
    '    document.getElementById("tabContent").textContent=GI.errorPrefix+" "+((err&&err.message)||GI.loadPreviewFailed);',
    '  }).getTemplateSectionsForClient(id);',
    '}',
    'loadSections();',
    '',
    'function switchTab(btn){',
    '  var tabs=document.querySelectorAll(".tab-btn");',
    '  tabs.forEach(function(t){t.classList.remove("active");});',
    '  btn.classList.add("active");',
    '  currentTab=btn.getAttribute("data-tab");',
    '  var bar=document.getElementById("copyBar");',
    '  if(currentTab==="fullprompt"){bar.classList.add("visible");}else{bar.classList.remove("visible");}',
    '  showTab(currentTab);',
    '}',
    '',
    'function showTab(tab){',
    '  var el=document.getElementById("tabContent");',
    '  if(!cachedSections){el.textContent=GI.loadingTab;return;}',
    '  var map={role:cachedSections.role,columns:cachedSections.columns,output:cachedSections.outputFormat,instructions:cachedSections.instructions};',
    '  if(tab==="context"){',
    '    el.innerHTML="";',
    '    var docCtx=cachedSections.documentContext;',
    '    var defCtx=cachedSections.contextDefaults;',
    '    if(docCtx){',
    '      var lbl1=document.createElement("div");lbl1.style.cssText="font-weight:bold;font-size:11px;color:#1a73e8;margin-bottom:4px";lbl1.textContent=GI.currentDocCtx;el.appendChild(lbl1);',
    '      var s1=document.createElement("span");s1.style.whiteSpace="pre-wrap";s1.textContent=docCtx;el.appendChild(s1);',
    '    }else{',
    '      var lbl2=document.createElement("div");lbl2.style.cssText="font-weight:bold;font-size:11px;color:#5f6368;margin-bottom:4px";lbl2.textContent=GI.defaultsNoCtx;el.appendChild(lbl2);',
    '      var s2=document.createElement("span");s2.style.whiteSpace="pre-wrap";s2.textContent=defCtx;el.appendChild(s2);',
    '    }',
    '    var sep=document.createElement("div");sep.style.cssText="margin-top:12px;border-top:1px solid #dadce0;padding-top:10px";el.appendChild(sep);',
    '    var btn=document.createElement("button");btn.className="btn";btn.style.cssText="width:100%";',
    '    btn.textContent=GI.extractCover;',
    '    btn.onclick=function(){google.script.run.openExtractContextDialog();google.script.host.close();};',
    '    sep.appendChild(btn);',
    '  }else if(tab==="fullprompt"){',
    '    el.textContent=GI.loadingTab;',
    '    var fid=getSelectedId();',
    '    if(!fid){el.textContent=GI.selectTemplate;return;}',
    '    if(cachedFullPrompt){el.textContent=cachedFullPrompt;return;}',
    '    google.script.run.withSuccessHandler(function(txt){',
    '      cachedFullPrompt=txt;',
    '      el.textContent=txt;',
    '    }).withFailureHandler(function(err){',
    '      el.textContent=GI.errorPrefix+" "+((err&&err.message)||GI.loadPreviewFailed);',
    '    }).getFullPromptForClient(fid);',
    '  }else{',
    '    el.textContent=map[tab]||GI.emptySection;',
    '  }',
    '}',
    '',
    'var cachedFullPrompt=null;',
    '',
    'function copyToClipboard(text){',
    '  try{',
    '    var ta=document.createElement("textarea");',
    '    ta.value=text;',
    '    ta.style.cssText="position:fixed;left:-9999px;top:-9999px";',
    '    document.body.appendChild(ta);',
    '    ta.select();',
    '    var ok=document.execCommand("copy");',
    '    document.body.removeChild(ta);',
    '    return ok;',
    '  }catch(e){return false;}',
    '}',
    '',
    'function doCopyPrompt(){',
    '  var id=getSelectedId();',
    '  if(!id){showStatus("error",GI.selectTemplate);return;}',
    '  if(cachedFullPrompt){finishCopy(cachedFullPrompt);return;}',
    '  google.script.run.withSuccessHandler(function(txt){',
    '    cachedFullPrompt=txt;',
    '    finishCopy(txt);',
    '  }).withFailureHandler(function(err){',
    '    showStatus("error",GI.errorPrefix+" "+((err&&err.message)||GI.loadPreviewFailed));',
    '  }).getFullPromptForClient(id);',
    '}',
    '',
    'function finishCopy(text){',
    '  var ok=copyToClipboard(text);',
    '  if(ok){',
    '    flashCopied(document.getElementById("cornerCopyBtn"));',
    '    showStatus("success",GI.copied);',
    '    setTimeout(function(){document.getElementById("statusMsg").className="status";},2000);',
    '  }else{',
    '    showStatus("error",GI.copyFailed);',
    '  }',
    '}',
    '',
    'function flashCopied(btn){',
    '  var origHTML=btn.innerHTML;',
    '  btn.innerHTML=\'<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg> <span>\'+GI.copied+\'</span>\';',
    '  btn.style.borderColor="#137333";btn.style.color="#137333";btn.style.background="#e6f4ea";',
    '  setTimeout(function(){btn.innerHTML=origHTML;btn.style.borderColor="";btn.style.color="";btn.style.background="";},2000);',
    '}',
    '',
    'function doApply(){',
    '  var id=getSelectedId();',
    '  if(!id){showStatus("error",GI.selectTemplate);return;}',
    '  document.getElementById("applyBtn").disabled=true;',
    '  document.getElementById("applyBtn").textContent=GI.applying;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){',
    '      showStatus("success",r.message);',
    '      setTimeout(function(){google.script.host.close();},1500);',
    '    }else{',
    '      showStatus("error",r.message);',
    '      document.getElementById("applyBtn").disabled=false;',
    '      document.getElementById("applyBtn").textContent=GI.apply;',
    '    }',
    '  }).withFailureHandler(function(err){',
    '    showStatus("error",GI.errorPrefix+" "+((err&&err.message)||GI.applyFailed));',
    '    document.getElementById("applyBtn").disabled=false;',
    '    document.getElementById("applyBtn").textContent=GI.apply;',
    '  }).applyTemplate(id,false);',
    '}',
    '',
    'function showStatus(type,msg){',
    '  var el=document.getElementById("statusMsg");',
    '  el.className="status "+type;',
    '  el.textContent=msg;',
    '}',
    'function showLoading(msg){showStatus("success",msg||GI.loadingTab);}',
    'function doEditCustom(id){',
    '  showLoading();',
    '  google.script.run.showCustomTemplateEditorDialog(id);',
    '}',
    'function doDuplicateCustom(id){',
    '  showLoading();',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showTemplateGalleryDialog(); }',
    '    else{ showStatus("error",r.message); }',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).duplicateCustomTemplate(id);',
    '}',
    'var confirmCallback=null;',
    'function showConfirm(msg,btnLabel,cb){',
    '  document.getElementById("confirmMsg").textContent=msg;',
    '  document.getElementById("confirmYes").textContent=btnLabel;',
    '  confirmCallback=cb;',
    '  document.getElementById("confirmYes").onclick=function(){closeConfirm();cb();};',
    '  document.getElementById("confirmOverlay").classList.add("visible");',
    '}',
    'function closeConfirm(){document.getElementById("confirmOverlay").classList.remove("visible");confirmCallback=null;}',
    'function doExportCustom(id){',
    '  showConfirm(CGI.confirmExport,CGI.actionExport,function(){',
    '    showLoading();',
    '    google.script.run.withSuccessHandler(function(r){',
    '      showStatus(r.ok?"success":"error",r.message);',
    '    }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).exportCustomTemplateToDocument(id);',
    '  });',
    '}',
    'function doDeleteCustom(id){',
    '  showConfirm(CGI.confirmDelete,CGI.actionDelete,function(){',
    '    showLoading();',
    '    google.script.run.withSuccessHandler(function(r){',
    '      if(r.ok){ google.script.run.showTemplateGalleryDialog(); }',
    '      else{ showStatus("error",r.message); }',
    '    }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).deleteCustomTemplateFromClient(id);',
    '  });',
    '}',
    'function doCreateFromTemplate(){',
    '  showLoading();',
    '  google.script.run.showCreateFromTemplatePickerDialog();',
    '}',
    'function doCreateBlank(){',
    '  showLoading();',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showCustomTemplateEditorDialog(r.template.id); }',
    '    else{ showStatus("error",r.message); }',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).createBlankCustomTemplate();',
    '}',
    '</script>',
    '</body></html>'
  ];

  return parts.join('\n');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
