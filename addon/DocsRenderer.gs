/**
 * DocsRenderer — renders a Gemini JSON response into Google Docs paragraphs.
 *
 * Input:
 *   - jsonResponse: parsed object matching the template's outputSchema
 *   - templateId:   v2 template ID (used to drive role-label mapping)
 *   - body:         DocumentApp Body
 *   - startIndex:   index in body where rendering begins
 *
 * Output:
 *   - Number of body children inserted (so callers can advance their cursor).
 *
 * Schema branches:
 *   - records[]            → metric_book / census_revision tabular output
 *   - transcription.original → base / personal_correspondence / official_document
 *
 * Formatting conventions (see design section 6.3):
 *   - Page header / pageDescription:  italic gray summary line
 *   - Per-record block:               bold "Record #N", labeled lines, italic
 *                                     verbatim original, then translation bullets
 *   - Translations:                   bullet list at the end of the block
 *
 * Returns the count of body elements inserted (matches insertFormattedText
 * convention so cursor management in Code.gs keeps working).
 */

var DOCS_RENDERER_HEADER_COLOR = '#5f6368'; // gray for page summary lines
var DOCS_RENDERER_ORIGINAL_COLOR = '#3c4043'; // softer gray for verbatim line
var DOCS_RENDERER_NOTE_COLOR = '#b06000'; // amber for "⚠" notes
var DOCS_RENDERER_RECORD_HEADING_COLOR = '#1a73e8'; // blue for "Record #N"

/** Maps `names[].role` to display labels. Per-template overrides via getRoleLabelMap_. */
var DEFAULT_ROLE_LABELS = {
  child:     { single: 'Name',        plural: 'Names' },
  father:    { single: 'Father',      plural: 'Father' },
  mother:    { single: 'Mother',      plural: 'Mother' },
  spouse:    { single: 'Spouse',      plural: 'Spouses' },
  groom:     { single: 'Groom',       plural: 'Groom' },
  bride:     { single: 'Bride',       plural: 'Bride' },
  deceased:  { single: 'Deceased',    plural: 'Deceased' },
  godfather: { single: 'Godfather',   plural: 'Godparents' },
  godmother: { single: 'Godmother',   plural: 'Godparents' },
  witness:   { single: 'Witness',     plural: 'Witnesses' },
  officiant: { single: 'Officiant',   plural: 'Officiants' },
  head:      { single: 'Head',        plural: 'Head of household' },
  wife:      { single: 'Wife',        plural: 'Wife' },
  son:       { single: 'Son',         plural: 'Sons' },
  daughter:  { single: 'Daughter',    plural: 'Daughters' },
  relative:  { single: 'Relative',    plural: 'Relatives' },
  servant:   { single: 'Servant',     plural: 'Servants' }
};

/** Russian Orthodox templates use a more period-faithful label set in the Cyrillic. */
var RUSSIAN_ORTH_ROLE_LABELS = {
  godfather: { single: 'Восприемник',  plural: 'Восприемники' },
  godmother: { single: 'Восприемница', plural: 'Восприемники' },
  witness:   { single: 'Поручитель',   plural: 'Поручители' },
  officiant: { single: 'Священник',    plural: 'Священники' }
};

function getRoleLabelMap_(templateId) {
  // Russian variants get a partially overridden map merged with defaults.
  if (templateId && templateId.indexOf('russian_orth_') === 0) {
    var merged = {};
    for (var k in DEFAULT_ROLE_LABELS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_ROLE_LABELS, k)) merged[k] = DEFAULT_ROLE_LABELS[k];
    }
    for (var ok in RUSSIAN_ORTH_ROLE_LABELS) {
      if (Object.prototype.hasOwnProperty.call(RUSSIAN_ORTH_ROLE_LABELS, ok)) merged[ok] = RUSSIAN_ORTH_ROLE_LABELS[ok];
    }
    return merged;
  }
  return DEFAULT_ROLE_LABELS;
}

/**
 * Public entry point. Renders the JSON response into the body and returns
 * the number of inserted body children (compatible with insertFormattedText's
 * return-counter for caller cursor management).
 */
function renderJsonToDocs(jsonResponse, templateId, body, startIndex) {
  if (!jsonResponse || typeof jsonResponse !== 'object') {
    Logger.log('renderJsonToDocs: empty or invalid response');
    return 0;
  }
  var ctx = {
    body: body,
    index: startIndex,
    inserted: 0,
    roleLabels: getRoleLabelMap_(templateId),
    templateId: templateId
  };

  if (jsonResponse.pageDescription) {
    insertGrayItalic_(ctx, String(jsonResponse.pageDescription));
  }

  if (jsonResponse.pageHeader && typeof jsonResponse.pageHeader === 'object') {
    var summary = composePageHeaderLine_(jsonResponse.pageHeader);
    if (summary) insertGrayItalic_(ctx, summary);
  }

  // Branch: tabular template (records[]) vs. base/letter (transcription.original)
  if (Array.isArray(jsonResponse.records) && jsonResponse.records.length > 0) {
    for (var ri = 0; ri < jsonResponse.records.length; ri++) {
      renderRecord_(ctx, jsonResponse.records[ri]);
    }
  } else {
    renderFlatTranscription_(ctx, jsonResponse);
  }

  // Trailing blank paragraph (matches insertFormattedText behavior).
  insertBlank_(ctx);
  return ctx.inserted;
}

// ---------------------------------------------------------------------------
// Per-record rendering (metric_book / census_revision)
// ---------------------------------------------------------------------------

function renderRecord_(ctx, rec) {
  if (!rec || typeof rec !== 'object') return;

  // Record heading
  var headerLabel = 'Record';
  if (rec.recordNumber !== undefined && rec.recordNumber !== null && rec.recordNumber !== '') {
    headerLabel += ' #' + rec.recordNumber;
  }
  insertColoredBoldHeading_(ctx, headerLabel, DOCS_RENDERER_RECORD_HEADING_COLOR);

  // Address: location + houseNumber
  var addressParts = [];
  if (rec.location) addressParts.push(String(rec.location));
  if (rec.houseNumber) addressParts.push('house ' + rec.houseNumber);
  if (rec.householdNumber) addressParts.push('household ' + rec.householdNumber);
  if (addressParts.length > 0) {
    insertLabeledLine_(ctx, 'Address', addressParts.join(', '));
  }

  // Date fields
  if (rec.birthDate)    insertLabeledLine_(ctx, 'Born',     formatDate_(rec.birthDate));
  if (rec.baptismDate)  insertLabeledLine_(ctx, 'Baptized', formatDate_(rec.baptismDate));
  if (rec.marriageDate) insertLabeledLine_(ctx, 'Married',  formatDate_(rec.marriageDate));
  if (rec.deathDate)    insertLabeledLine_(ctx, 'Died',     formatDate_(rec.deathDate));
  if (rec.burialDate)   insertLabeledLine_(ctx, 'Buried',   formatDate_(rec.burialDate));
  if (rec.date && !rec.birthDate && !rec.marriageDate && !rec.deathDate) {
    insertLabeledLine_(ctx, 'Date', formatDate_(rec.date));
  }

  // Per-record demographics
  if (rec.sex)         insertLabeledLine_(ctx, 'Sex', rec.sex);
  if (rec.age)         insertLabeledLine_(ctx, 'Age', String(rec.age));
  if (rec.legitimacy)  insertLabeledLine_(ctx, 'Legitimacy', rec.legitimacy);
  if (rec.religion)    insertLabeledLine_(ctx, 'Religion', rec.religion);
  if (rec.cause)       insertLabeledLine_(ctx, 'Cause of death', rec.cause);

  // Marriage party fields
  if (rec.groomAge)    insertLabeledLine_(ctx, 'Groom age', rec.groomAge);
  if (rec.brideAge)    insertLabeledLine_(ctx, 'Bride age', rec.brideAge);
  if (rec.groomStatus) insertLabeledLine_(ctx, 'Groom status', rec.groomStatus);
  if (rec.brideStatus) insertLabeledLine_(ctx, 'Bride status', rec.brideStatus);

  // Names by role (grouped)
  if (Array.isArray(rec.names) && rec.names.length > 0) {
    var groups = groupNamesByRole_(rec.names);
    for (var gi = 0; gi < groups.length; gi++) {
      var g = groups[gi];
      var label = labelForRoleGroup_(ctx.roleLabels, g.role, g.entries.length);
      var value = formatNameGroup_(g.entries);
      insertLabeledLine_(ctx, label, value);
    }
  }

  // Officiant (if present as a flat field, not in names[])
  if (rec.officiant && !hasRoleInNames_(rec.names, 'officiant')) {
    insertLabeledLine_(ctx, ctx.roleLabels.officiant.single, rec.officiant);
  }

  // Original verbatim line (per-record, italic gray)
  if (rec.original) {
    insertOriginalLine_(ctx, String(rec.original));
  }

  // Notes
  if (rec.notes) {
    insertNoteLine_(ctx, String(rec.notes));
  }

  // Translation bullets
  if (rec.translation && typeof rec.translation === 'object') {
    insertTranslationBullets_(ctx, rec.translation);
  }

  // Blank separator between records
  insertBlank_(ctx);
}

function groupNamesByRole_(names) {
  // Stable order: child/deceased first, then father/mother/spouse, then groom/bride,
  // then godparents (collapsed to one group), then witnesses, then others.
  var ROLE_ORDER = ['child', 'deceased', 'head', 'father', 'mother', 'wife',
                    'spouse', 'groom', 'bride', 'son', 'daughter',
                    'godfather', 'godmother', 'witness', 'officiant',
                    'relative', 'servant'];
  var byRole = {};
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (!n || !n.fullName) continue;
    var role = String(n.role || 'other');
    // Collapse god-* into a single group for display.
    var displayRole = (role === 'godmother' || role === 'godfather') ? 'godparents' : role;
    if (!byRole[displayRole]) byRole[displayRole] = { role: displayRole, entries: [] };
    byRole[displayRole].entries.push(n);
  }

  var result = [];
  var seen = {};
  for (var oi = 0; oi < ROLE_ORDER.length; oi++) {
    var r = ROLE_ORDER[oi];
    var displayR = (r === 'godfather' || r === 'godmother') ? 'godparents' : r;
    if (byRole[displayR] && !seen[displayR]) {
      result.push(byRole[displayR]);
      seen[displayR] = true;
    }
  }
  // Append any roles we didn't enumerate.
  for (var k in byRole) {
    if (!Object.prototype.hasOwnProperty.call(byRole, k)) continue;
    if (!seen[k]) result.push(byRole[k]);
  }
  return result;
}

function labelForRoleGroup_(roleLabels, role, count) {
  if (role === 'godparents') {
    var labels = roleLabels.godparents || roleLabels.godfather || { plural: 'Godparents' };
    return labels.plural || 'Godparents';
  }
  var entry = roleLabels[role];
  if (!entry) return capitalize_(role);
  return count > 1 ? (entry.plural || entry.single) : entry.single;
}

function formatNameGroup_(entries) {
  var parts = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    var name = String(e.fullName || '').trim();
    if (!name) continue;
    if (e.details) {
      name += ' (' + String(e.details).trim() + ')';
    }
    if (e.ageNow) {
      name += ' [age ' + e.ageNow + ']';
    }
    parts.push(name);
  }
  return parts.join('; ');
}

function hasRoleInNames_(names, role) {
  if (!Array.isArray(names)) return false;
  for (var i = 0; i < names.length; i++) {
    if (names[i] && names[i].role === role) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Flat transcription (base / letters / official docs)
// ---------------------------------------------------------------------------

function renderFlatTranscription_(ctx, jsonResponse) {
  // Letter-specific metadata
  if (jsonResponse.letter && typeof jsonResponse.letter === 'object') {
    var letter = jsonResponse.letter;
    if (letter.sender)    insertLabeledLine_(ctx, 'From',     letter.sender);
    if (letter.recipient) insertLabeledLine_(ctx, 'To',       letter.recipient);
    if (letter.date)      insertLabeledLine_(ctx, 'Date',     letter.date);
    if (letter.location)  insertLabeledLine_(ctx, 'Location', letter.location);
    if (Array.isArray(letter.topics) && letter.topics.length > 0) {
      insertLabeledLine_(ctx, 'Topics', letter.topics.join(', '));
    }
    if (Array.isArray(letter.namedEntities) && letter.namedEntities.length > 0) {
      var ents = [];
      for (var ei = 0; ei < letter.namedEntities.length; ei++) {
        var en = letter.namedEntities[ei];
        if (en && en.name) ents.push(en.name + (en.kind ? ' (' + en.kind + ')' : ''));
      }
      if (ents.length > 0) insertLabeledLine_(ctx, 'Named entities', ents.join(', '));
    }
    insertBlank_(ctx);
  }

  // Document-info (official docs)
  if (jsonResponse.documentInfo && typeof jsonResponse.documentInfo === 'object') {
    var di = jsonResponse.documentInfo;
    if (di.documentType)     insertLabeledLine_(ctx, 'Document type',     di.documentType);
    if (di.issueDate)        insertLabeledLine_(ctx, 'Issue date',        di.issueDate);
    if (di.issuingAuthority) insertLabeledLine_(ctx, 'Issuing authority', di.issuingAuthority);
    if (di.documentNumber)   insertLabeledLine_(ctx, 'Document number',   di.documentNumber);
    insertBlank_(ctx);
  }
  if (jsonResponse.subject && typeof jsonResponse.subject === 'object') {
    var s = jsonResponse.subject;
    if (s.fullName)   insertLabeledLine_(ctx, 'Subject',     s.fullName);
    if (s.birthDate)  insertLabeledLine_(ctx, 'Born',        s.birthDate);
    if (s.birthPlace) insertLabeledLine_(ctx, 'Birth place', s.birthPlace);
    if (s.residence)  insertLabeledLine_(ctx, 'Residence',   s.residence);
    if (s.occupation) insertLabeledLine_(ctx, 'Occupation',  s.occupation);
    insertBlank_(ctx);
  }
  if (Array.isArray(jsonResponse.extractedFields) && jsonResponse.extractedFields.length > 0) {
    for (var fi = 0; fi < jsonResponse.extractedFields.length; fi++) {
      var fld = jsonResponse.extractedFields[fi];
      if (fld && fld.label) insertLabeledLine_(ctx, fld.label, fld.value || '');
    }
    insertBlank_(ctx);
  }

  // Transcription block
  if (jsonResponse.transcription && typeof jsonResponse.transcription === 'object') {
    var t = jsonResponse.transcription;
    if (t.original) {
      insertColoredBoldHeading_(ctx, 'Original Text', DOCS_RENDERER_RECORD_HEADING_COLOR);
      var paragraphs = String(t.original).split(/\n\s*\n/);
      for (var pi = 0; pi < paragraphs.length; pi++) {
        var para = paragraphs[pi];
        if (!para.trim()) {
          insertBlank_(ctx);
          continue;
        }
        insertParagraph_(ctx, para);
      }
    }
    if (t.notes) {
      insertNoteLine_(ctx, String(t.notes));
    }
    insertBlank_(ctx);
  }

  // Translation bullets at the bottom
  if (jsonResponse.translation && typeof jsonResponse.translation === 'object') {
    insertColoredBoldHeading_(ctx, 'Translation', DOCS_RENDERER_RECORD_HEADING_COLOR);
    insertTranslationBullets_(ctx, jsonResponse.translation);
  }
}

// ---------------------------------------------------------------------------
// Low-level insertion primitives
// ---------------------------------------------------------------------------

function insertParagraph_(ctx, text) {
  ctx.body.insertParagraph(ctx.index, text);
  ctx.index++;
  ctx.inserted++;
}

function insertBlank_(ctx) {
  ctx.body.insertParagraph(ctx.index, '');
  ctx.index++;
  ctx.inserted++;
}

function insertGrayItalic_(ctx, text) {
  var p = ctx.body.insertParagraph(ctx.index, text);
  var t = p.editAsText();
  if (text.length > 0) {
    t.setItalic(0, text.length - 1, true);
    t.setForegroundColor(0, text.length - 1, DOCS_RENDERER_HEADER_COLOR);
  }
  ctx.index++;
  ctx.inserted++;
}

function insertColoredBoldHeading_(ctx, text, color) {
  var p = ctx.body.insertParagraph(ctx.index, text);
  var t = p.editAsText();
  if (text.length > 0) {
    t.setBold(0, text.length - 1, true);
    t.setForegroundColor(0, text.length - 1, color);
  }
  ctx.index++;
  ctx.inserted++;
}

function insertLabeledLine_(ctx, label, value) {
  var prefix = label + ': ';
  var fullText = prefix + (value === undefined || value === null ? '' : String(value));
  var p = ctx.body.insertParagraph(ctx.index, fullText);
  var t = p.editAsText();
  // Bold the label (including the colon).
  var boldEnd = label.length; // index of the colon
  if (boldEnd >= 0) {
    t.setBold(0, boldEnd, true);
  }
  ctx.index++;
  ctx.inserted++;
}

function insertOriginalLine_(ctx, text) {
  var p = ctx.body.insertParagraph(ctx.index, text);
  var t = p.editAsText();
  if (text.length > 0) {
    t.setItalic(0, text.length - 1, true);
    t.setForegroundColor(0, text.length - 1, DOCS_RENDERER_ORIGINAL_COLOR);
  }
  ctx.index++;
  ctx.inserted++;
}

function insertNoteLine_(ctx, text) {
  var marked = '⚠ ' + text;
  var p = ctx.body.insertParagraph(ctx.index, marked);
  var t = p.editAsText();
  if (marked.length > 0) {
    t.setItalic(0, marked.length - 1, true);
    t.setForegroundColor(0, marked.length - 1, DOCS_RENDERER_NOTE_COLOR);
  }
  ctx.index++;
  ctx.inserted++;
}

function insertTranslationBullets_(ctx, translationObj) {
  // Stable language order: uk, en, ru, latin, original; then anything else.
  var preferredOrder = ['uk', 'en', 'ru', 'latin', 'original'];
  var keys = [];
  var seen = {};
  for (var i = 0; i < preferredOrder.length; i++) {
    var lang = preferredOrder[i];
    if (Object.prototype.hasOwnProperty.call(translationObj, lang) && translationObj[lang]) {
      keys.push(lang);
      seen[lang] = true;
    }
  }
  for (var k in translationObj) {
    if (!Object.prototype.hasOwnProperty.call(translationObj, k)) continue;
    if (seen[k]) continue;
    if (translationObj[k]) keys.push(k);
  }

  for (var ki = 0; ki < keys.length; ki++) {
    var key = keys[ki];
    var value = String(translationObj[key] || '').trim();
    if (!value) continue;
    var prefix = key + ': ';
    var lineText = prefix + value;
    var item = ctx.body.insertListItem(ctx.index, lineText);
    item.setGlyphType(DocumentApp.GlyphType.BULLET);
    var te = item.editAsText();
    // Bold the language key + colon.
    te.setBold(0, key.length, true);
    ctx.index++;
    ctx.inserted++;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function composePageHeaderLine_(pageHeader) {
  if (!pageHeader || typeof pageHeader !== 'object') return '';
  var parts = [];
  if (pageHeader.year)             parts.push('Year: ' + pageHeader.year);
  if (pageHeader.pageNumber)       parts.push('Page: ' + pageHeader.pageNumber);
  if (pageHeader.parish)           parts.push('Parish: ' + pageHeader.parish);
  if (pageHeader.settlement)       parts.push('Settlement: ' + pageHeader.settlement);
  if (pageHeader.archiveReference) parts.push('Ref: ' + pageHeader.archiveReference);
  return parts.join(' · ');
}

function formatDate_(value) {
  if (!value) return '';
  var s = String(value).trim();
  // ISO YYYY-MM-DD → "2 January 1886" if recognized; otherwise return as written.
  var iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    var mIdx = parseInt(iso[2], 10) - 1;
    var dNum = parseInt(iso[3], 10);
    if (mIdx >= 0 && mIdx < 12) {
      return dNum + ' ' + months[mIdx] + ' ' + iso[1];
    }
  }
  return s;
}

function capitalize_(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Response parsing — robust JSON extraction from Gemini responses
// ---------------------------------------------------------------------------

/**
 * Parses a Gemini text response into an object matching the template schema.
 * Even when responseSchema is set, Gemini may wrap output in markdown fences
 * or include trailing whitespace; this helper handles both.
 *
 * Throws if the response can't be parsed as JSON.
 */
function parseJsonResponse(responseText) {
  var raw = String(responseText || '').trim();
  if (!raw) throw new Error('Empty model response.');
  try { return JSON.parse(raw); } catch (_e1) {}

  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence && fence[1]) {
    try { return JSON.parse(fence[1].trim()); } catch (_e2) {}
  }

  var first = raw.indexOf('{');
  var last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(raw.substring(first, last + 1)); } catch (_e3) {}
  }
  throw new Error('Could not parse JSON from model response.');
}
