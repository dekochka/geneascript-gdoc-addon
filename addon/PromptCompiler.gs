/**
 * Prompt Compiler — assembles the Gemini API request from a v2 template.
 *
 * Responsibilities:
 *   1. Resolve the template through its inheritance chain.
 *   2. Build the prompt text (role, context, input, output, examples,
 *      instructions sections) by concatenating layer-derived paragraphs.
 *   3. Build the JSON Schema sent as Gemini's responseSchema.
 *   4. Honor the document-level translation toggle (override per call).
 *
 * Public entry point:
 *   compilePrompt(templateId, contextValues, opts) → {
 *     promptText, responseSchema, translationConfig, resolvedTemplate
 *   }
 *
 * Backward compat note: legacy v1 templates and "legacyPromptOverride" custom
 * templates bypass this compiler and use their stored prompt string directly
 * (see Code.gs migration path).
 */

/**
 * Compiles the prompt + response schema for a Gemini call.
 *
 * @param templateId    Template ID (v2 variant, extension, or base).
 * @param contextValues Object of user-provided context values keyed by field key.
 * @param opts          Optional overrides:
 *                        - translationEnabled: bool — overrides template default
 *                        - locale: 'en' | 'uk' | 'ru' — for context labels
 * @return {{promptText: string, responseSchema: Object, translationConfig: Object, resolvedTemplate: Object}}
 */
function compilePrompt(templateId, contextValues, opts) {
  opts = opts || {};
  var resolved = resolveTemplateV2(templateId);
  if (!resolved) {
    throw new Error('compilePrompt: unknown template "' + templateId + '"');
  }

  var translationEnabled = (typeof opts.translationEnabled === 'boolean')
    ? opts.translationEnabled
    : !!(resolved.translation && resolved.translation.enabled);
  var translationConfig = getResolvedTranslationConfig(templateId, translationEnabled);

  var responseSchema = getResolvedOutputSchema(templateId, {
    translationEnabled: translationEnabled,
    translationLanguages: translationConfig.languages
  });

  var sections = [];
  sections.push(buildRoleSection_(resolved));
  sections.push(buildContextSection_(resolved, contextValues || {}, opts.locale || 'en'));
  sections.push(buildInputSection_(resolved));
  sections.push(buildOutputSection_(resolved, translationEnabled, translationConfig));
  var instructionsBlock = buildInstructionsSection_(resolved);
  if (instructionsBlock) sections.push(instructionsBlock);
  var examplesBlock = buildExamplesSection_(resolved);
  if (examplesBlock) sections.push(examplesBlock);

  var promptText = sections.join('\n\n');

  return {
    promptText: promptText,
    responseSchema: responseSchema,
    translationConfig: translationConfig,
    resolvedTemplate: resolved
  };
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildRoleSection_(resolved) {
  var role = resolved.role || {};
  var personaText = humanizePersona_(role.persona);
  var expertiseList = role.expertise || [];

  var lines = ['#### Role', ''];
  lines.push('You are an expert ' + personaText + '.');
  if (expertiseList.length > 0) {
    lines.push('');
    lines.push('Your areas of expertise:');
    for (var i = 0; i < expertiseList.length; i++) {
      lines.push('- ' + humanizeExpertise_(expertiseList[i]));
    }
  }
  lines.push('');
  lines.push('Your task is to read the attached image and produce a faithful, structured transcription according to the JSON schema below.');
  return lines.join('\n');
}

function buildContextSection_(resolved, contextValues, locale) {
  var fields = (resolved.context && resolved.context.fields) || [];
  var lines = ['#### Document Context', ''];
  if (fields.length === 0) {
    lines.push('(No context fields defined for this template.)');
    return lines.join('\n');
  }
  var any = false;
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    var raw = contextValues[f.key];
    var value = formatContextValueForPrompt_(raw);
    if (!value) continue;
    var label = getLocalizedContextLabel(f, locale);
    lines.push('**' + label + ':** ' + value);
    any = true;
  }
  if (!any) {
    lines.push('(No context provided.)');
  }
  return lines.join('\n');
}

function formatContextValueForPrompt_(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    var items = [];
    for (var i = 0; i < value.length; i++) {
      var v = String(value[i] || '').trim();
      if (v) items.push(v);
    }
    return items.join(', ');
  }
  return String(value).trim();
}

function buildInputSection_(resolved) {
  var input = resolved.inputSchema || { type: 'freeform' };
  var lines = ['#### Input Document Structure', ''];

  if (input.type === 'tabular') {
    lines.push('The source is a tabular record (one record per row).');
    if (input.columns && input.columns.length > 0) {
      lines.push('');
      lines.push('Expected columns:');
      for (var i = 0; i < input.columns.length; i++) {
        var c = input.columns[i];
        var label = c.label || c.key;
        var line = '- **' + c.key + '** — ' + label;
        if (c.note) line += ' (' + c.note + ')';
        lines.push(line);
      }
    }
  } else if (input.type === 'structured_form') {
    lines.push('The source is a pre-printed form with handwritten or typed entries in specific fields.');
  } else {
    lines.push('The source is freeform text (letter, diary, notes, etc.) without a fixed tabular structure.');
  }

  if (input.hints && input.hints.length > 0) {
    lines.push('');
    lines.push('**Reading hints for this document type:**');
    for (var h = 0; h < input.hints.length; h++) {
      lines.push('- ' + input.hints[h]);
    }
  }
  return lines.join('\n');
}

function buildOutputSection_(resolved, translationEnabled, translationConfig) {
  var lines = ['#### Output Format', ''];
  lines.push('Return a single valid JSON object that matches this schema (the schema is also enforced by the API):');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(simplifySchemaForPrompt_(resolved.outputSchema || {}), null, 2));
  lines.push('```');
  lines.push('');
  lines.push('Output rules:');
  lines.push('- Return JSON only — no markdown fencing, no commentary outside the JSON.');
  lines.push('- Every record\'s `original` field must contain the verbatim source text as written.');
  lines.push('- Use `[illegible]`, `[torn]`, `[faded]`, or `[possibly: X]` for unreadable portions.');
  if (translationEnabled && translationConfig.languages && translationConfig.languages.length > 0) {
    lines.push('- For each record, populate the `translation` object with summaries in: ' + translationConfig.languages.join(', ') + '.');
    lines.push('- Translations should use modern orthography for the target language; do not preserve archaic forms in translations.');
  }
  return lines.join('\n');
}

function buildInstructionsSection_(resolved) {
  var ins = resolved.instructions || { general: [], domain: [] };
  var allTokens = (ins.general || []).concat(ins.domain || []);
  if (!allTokens.length) return '';
  var body = resolveInstructions(allTokens);
  if (!body) return '';
  return ['#### Instructions', '', body].join('\n');
}

function buildExamplesSection_(resolved) {
  var exampleIds = resolved.examples || [];
  if (!exampleIds.length) return '';
  var examples = getExamplesForTemplate(exampleIds);
  if (!examples.length) return '';
  var body = serializeExamplesForPrompt(examples);
  if (!body) return '';
  return ['#### Examples', '', body].join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var PERSONA_TEXT = {
  historical_document_transcriber: 'transcriber of historical handwritten and typewritten documents',
  archival_paleographer: 'archivist and paleographer specializing in historical vital and census records',
  historical_letters_transcriber: 'transcriber of historical correspondence and personal documents',
  official_records_transcriber: 'transcriber of official administrative documents (passports, court records, repression files)'
};

function humanizePersona_(persona) {
  if (!persona) return 'transcriber of historical documents';
  return PERSONA_TEXT[persona] || persona.replace(/_/g, ' ');
}

var EXPERTISE_TEXT = {
  // metric book
  church_registers: 'church registers (births, marriages, deaths) across Christian denominations and time periods',
  slavic_onomastics: 'Slavic personal naming systems, patronymics, and surname etymology',
  historical_dating: 'Julian / Gregorian calendar conventions and ecclesiastical date formats',
  // Galician
  latin_cursive: 'Latin cursive scripts of 18th–19th century Central Europe',
  polish_latin_names: 'Latinized Polish names (Joannes/Ivan, Nicolaus/Mykola) and Polish orthography (cz, sz, w)',
  ukrainian_cyrillic_names: 'mapping between Latin and Cyrillic forms of Ukrainian personal names',
  // Russian
  pre_reform_cyrillic: 'pre-1918 Russian Cyrillic orthography (Ѣ, І, Ѳ, Ѵ, terminal ъ)',
  church_slavonic: 'Church Slavonic conventions, titlo marks, and stress accents',
  russian_patronymics: 'Russian patronymic naming conventions',
  cyrillic_numerals_18c: '18th-century Cyrillic alphabetic numerals (А=1, КА=21, ҂АѰНД=1754)',
  // Census
  census_records: 'Russian Imperial census and revision-list structures',
  household_structure: 'pre-modern household composition (head, wife, sons, relatives, servants)',
  // Correspondence
  cursive_handwriting: 'historical cursive handwriting in Cyrillic, Latin, and German scripts',
  period_orthography: 'period-specific orthography (pre-reform, dialect, regional variants)',
  // Other
  typescript: 'typewritten documents, including faded ribbons, strikeouts, and overtype corrections',
  mixed_languages: 'documents with multiple languages or scripts on a single page',
  administrative_documents: 'historical administrative documents — passports, certificates, court records',
  official_terminology: 'period-specific bureaucratic and legal terminology'
};

function humanizeExpertise_(token) {
  return EXPERTISE_TEXT[token] || token.replace(/_/g, ' ');
}

/**
 * Strips JSON-Schema fields that aren't meaningful in a prompt rendering
 * (description we keep; the rest is structural and adds clutter without
 * teaching the model anything new).
 */
function simplifySchemaForPrompt_(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) {
    var arr = [];
    for (var i = 0; i < schema.length; i++) arr.push(simplifySchemaForPrompt_(schema[i]));
    return arr;
  }
  var out = {};
  for (var k in schema) {
    if (!Object.prototype.hasOwnProperty.call(schema, k)) continue;
    out[k] = simplifySchemaForPrompt_(schema[k]);
  }
  return out;
}
