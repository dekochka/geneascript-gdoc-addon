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
    if (id && TEMPLATES[id]) return id;
  } catch (e) {
    Logger.log('getSelectedTemplateId: error reading doc props, using default. ' + e.message);
  }
  return DEFAULT_TEMPLATE_ID;
}

function setSelectedTemplateId(id) {
  if (!TEMPLATES[id]) throw new Error('Unknown template ID: ' + id);
  PropertiesService.getDocumentProperties().setProperty(TEMPLATE_ID_PROPERTY, id);
}

function getPromptForTemplate(templateId) {
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxPrompt();
    case 'galicia_gc':
    default:
      return getGaliciaGcPrompt();
  }
}

function getContextDefaultsForTemplate(templateId) {
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxContextDefaults();
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
    var t = TEMPLATES[key];
    list.push({
      id: t.id,
      label: t.label,
      region: t.region,
      religion: t.religion,
      recordTypes: t.recordTypes,
      description: t.description,
      isSelected: t.id === selectedId
    });
  }
  return list;
}

/**
 * Returns the full prompt text for preview in the dialog.
 */
function getPromptPreviewForClient(templateId) {
  if (!TEMPLATES[templateId]) return '(Unknown template)';
  return getPromptForTemplate(templateId);
}

/**
 * Returns structured preview sections for the tabbed preview panel.
 * Splits the prompt on #### headers and adds the context defaults tab.
 */
function getTemplateSectionsForClient(templateId) {
  if (!TEMPLATES[templateId]) {
    return { documentContext: '', contextDefaults: '', role: '', columns: '', outputFormat: '', instructions: '' };
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
    if (!TEMPLATES[templateId]) {
      return { ok: false, message: 'Unknown template: ' + templateId };
    }
    setSelectedTemplateId(templateId);
    var label = TEMPLATES[templateId].label;
    var msg = "Template '" + label + "' applied.";

    if (updateContext) {
      var doc = DocumentApp.getActiveDocument();
      if (doc) {
        var body = doc.getBody();
        var contextRange = getContextRange(body);
        if (!contextRange || contextRange.end <= contextRange.start) {
          ensureContextBlock(doc);
          msg += ' Context block created with template defaults.';
        } else {
          var added = mergeTemplateLabelScaffold(body, contextRange, templateId);
          if (added.length > 0) {
            msg += ' Added missing fields: ' + added.join(', ') + '.';
          } else {
            msg += ' Context already has all template fields.';
          }
        }
      }
    }

    Logger.log('applyTemplate: ' + templateId + ', updateContext=' + updateContext);
    return { ok: true, message: msg };
  } catch (e) {
    Logger.log('applyTemplate error: ' + e.message);
    return { ok: false, message: 'Error applying template: ' + e.message };
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

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function showTemplateGalleryDialog() {
  var html = getTemplateGalleryHtml();
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(620).setHeight(700),
    'Template Gallery'
  );
}

function getTemplateGalleryHtml() {
  var templates = getTemplateListForClient();
  var selectedId = getSelectedTemplateId();

  var cardsHtml = '';
  for (var i = 0; i < templates.length; i++) {
    var t = templates[i];
    var checked = t.isSelected ? ' checked' : '';
    cardsHtml += '<label class="card' + (t.isSelected ? ' selected' : '') + '" data-id="' + esc(t.id) + '">' +
      '<input type="radio" name="template" value="' + esc(t.id) + '"' + checked + '>' +
      '<div class="card-body">' +
      '<div class="card-title">' + esc(t.label) + '</div>' +
      '<div class="card-meta">' + esc(t.region) + ' &middot; ' + esc(t.religion) + ' &middot; ' + esc(t.recordTypes) + '</div>' +
      '<div class="card-desc">' + esc(t.description) + '</div>' +
      '</div>' +
      '</label>';
  }

  var parts = [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; display: flex; flex-direction: column; height: calc(100vh - 32px); }',
    '.current { font-size: 12px; color: #666; margin-bottom: 12px; }',
    '.current span { font-weight: bold; color: #1a73e8; }',
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
    '.options { margin-bottom: 12px; }',
    '.options label { font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 6px; }',
    '.options .hint { font-size: 11px; color: #5f6368; margin-left: 22px; margin-top: 2px; }',
    '.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: auto; padding-top: 12px; border-top: 1px solid #eee; }',
    '.btn { padding: 8px 20px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.status { font-size: 12px; margin-top: 8px; padding: 8px; border-radius: 4px; display: none; }',
    '.status.success { display: block; background: #e6f4ea; color: #137333; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '</style>',
    '</head><body>',
    '<div class="current">Currently using: <span id="currentLabel">' + esc(TEMPLATES[selectedId].label) + '</span></div>',
    '<div class="cards" id="cards">' + cardsHtml + '</div>',
    '<button class="preview-toggle" id="previewToggle" onclick="togglePreview()">&#9654; Review Template</button>',
    '<div class="preview-wrap" id="previewWrap">',
    '  <div class="tab-bar">',
    '    <button class="tab-btn active" data-tab="context" onclick="switchTab(this)">Context</button>',
    '    <button class="tab-btn" data-tab="role" onclick="switchTab(this)">Role</button>',
    '    <button class="tab-btn" data-tab="columns" onclick="switchTab(this)">Columns</button>',
    '    <button class="tab-btn" data-tab="output" onclick="switchTab(this)">Output Format</button>',
    '    <button class="tab-btn" data-tab="instructions" onclick="switchTab(this)">Instructions</button>',
    '  </div>',
    '  <div class="tab-content" id="tabContent">Select a tab to preview...</div>',
    '</div>',
    '<div class="options">',
    '  <label><input type="checkbox" id="updateContext"> Scaffold missing Context fields from template</label>',
    '  <div class="hint" id="contextHint"></div>',
    '</div>',
    '<div id="statusMsg" class="status"></div>',
    '<div class="actions">',
    '<button class="btn" onclick="google.script.host.close()">Cancel</button>',
    '<button class="btn btn-primary" id="applyBtn" onclick="doApply()">Apply</button>',
    '</div>',
    '<script>',
    'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}',
    '',
    'var cards=document.querySelectorAll(".card");',
    'cards.forEach(function(c){',
    '  c.addEventListener("click",function(){',
    '    cards.forEach(function(x){x.classList.remove("selected");});',
    '    c.classList.add("selected");',
    '    c.querySelector("input[type=radio]").checked=true;',
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
    '    btn.innerHTML="&#9654; Review Template";',
    '  }else{',
    '    loadSections(function(){ showTab(currentTab); });',
    '    w.classList.add("open");',
    '    btn.innerHTML="&#9660; Hide Template Review";',
    '  }',
    '}',
    '',
    'var contextCheckboxInitialized=false;',
    'function loadSections(cb){',
    '  var id=getSelectedId();',
    '  if(!id)return;',
    '  document.getElementById("tabContent").textContent="Loading...";',
    '  google.script.run.withSuccessHandler(function(s){',
    '    cachedSections=s;',
    '    if(!contextCheckboxInitialized){initContextCheckbox(s.hasDocumentContext);contextCheckboxInitialized=true;}',
    '    if(cb)cb();',
    '  }).withFailureHandler(function(err){',
    '    document.getElementById("tabContent").textContent="Error: "+err.message;',
    '  }).getTemplateSectionsForClient(id);',
    '}',
    'loadSections();',
    '',
    'function switchTab(btn){',
    '  var tabs=document.querySelectorAll(".tab-btn");',
    '  tabs.forEach(function(t){t.classList.remove("active");});',
    '  btn.classList.add("active");',
    '  currentTab=btn.getAttribute("data-tab");',
    '  showTab(currentTab);',
    '}',
    '',
    'function showTab(tab){',
    '  var el=document.getElementById("tabContent");',
    '  if(!cachedSections){el.textContent="Loading...";return;}',
    '  var map={role:cachedSections.role,columns:cachedSections.columns,output:cachedSections.outputFormat,instructions:cachedSections.instructions};',
    '  if(tab==="context"){',
    '    el.innerHTML="";',
    '    var docCtx=cachedSections.documentContext;',
    '    var defCtx=cachedSections.contextDefaults;',
    '    if(docCtx){',
    '      var lbl1=document.createElement("div");lbl1.style.cssText="font-weight:bold;font-size:11px;color:#1a73e8;margin-bottom:4px";lbl1.textContent="Current document context:";el.appendChild(lbl1);',
    '      var s1=document.createElement("span");s1.style.whiteSpace="pre-wrap";s1.textContent=docCtx;el.appendChild(s1);',
    '    }else{',
    '      var lbl2=document.createElement("div");lbl2.style.cssText="font-weight:bold;font-size:11px;color:#5f6368;margin-bottom:4px";lbl2.textContent="Template defaults (no document context found):";el.appendChild(lbl2);',
    '      var s2=document.createElement("span");s2.style.whiteSpace="pre-wrap";s2.textContent=defCtx;el.appendChild(s2);',
    '    }',
    '    var sep=document.createElement("div");sep.style.cssText="margin-top:12px;border-top:1px solid #dadce0;padding-top:10px";el.appendChild(sep);',
    '    var btn=document.createElement("button");btn.className="btn";btn.style.cssText="width:100%";',
    '    btn.innerHTML="&#9998; Extract Context from Cover Image\\u2026";',
    '    btn.onclick=function(){google.script.run.openExtractContextDialog();google.script.host.close();};',
    '    sep.appendChild(btn);',
    '  }else{',
    '    el.textContent=map[tab]||"(empty)";',
    '  }',
    '}',
    '',
    'function initContextCheckbox(hasCtx){',
    '  var cb=document.getElementById("updateContext");',
    '  var hint=document.getElementById("contextHint");',
    '  if(hasCtx){',
    '    cb.checked=false;',
    '    hint.textContent="Adds any missing field labels (e.g. VILLAGES, COMMON_SURNAMES) without overwriting existing values.";',
    '  }else{',
    '    cb.checked=true;',
    '    hint.textContent="No context found in document. Will create Context block with template sample data.";',
    '  }',
    '}',
    '',
    'function doApply(){',
    '  var id=getSelectedId();',
    '  if(!id){showStatus("error","Please select a template.");return;}',
    '  var uc=document.getElementById("updateContext").checked;',
    '  document.getElementById("applyBtn").disabled=true;',
    '  document.getElementById("applyBtn").textContent="Applying...";',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){',
    '      showStatus("success",r.message);',
    '      setTimeout(function(){google.script.host.close();},1500);',
    '    }else{',
    '      showStatus("error",r.message);',
    '      document.getElementById("applyBtn").disabled=false;',
    '      document.getElementById("applyBtn").textContent="Apply";',
    '    }',
    '  }).withFailureHandler(function(err){',
    '    showStatus("error","Error: "+err.message);',
    '    document.getElementById("applyBtn").disabled=false;',
    '    document.getElementById("applyBtn").textContent="Apply";',
    '  }).applyTemplate(id,uc);',
    '}',
    '',
    'function showStatus(type,msg){',
    '  var el=document.getElementById("statusMsg");',
    '  el.className="status "+type;',
    '  el.textContent=msg;',
    '}',
    '</script>',
    '</body></html>'
  ];

  return parts.join('\n');
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
