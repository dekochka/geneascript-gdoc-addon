/**
 * Instruction Library — symbolic instruction tokens → prompt paragraph text.
 *
 * Templates reference instructions by token name (e.g., "preserve_abbreviations").
 * The PromptCompiler resolves tokens to natural-language paragraphs and
 * concatenates them into the Instructions section of the prompt.
 *
 * Adding a new instruction:
 *   1. Add a key to INSTRUCTION_LIBRARY with a clear, self-contained paragraph.
 *   2. Reference the key from one or more templates' instructions.{general|domain}
 *      arrays in TemplateSchemaV2.gs.
 *
 * Why tokens, not raw text?
 *   - Templates stay compact and structured.
 *   - Improving prompt wording is a single change here, not N edits across
 *     templates.
 *   - Future visual composer can render tokens as toggles with descriptions.
 */

var INSTRUCTION_LIBRARY = {
  // ── General instructions (applied to all templates by default) ──
  preserve_original_spelling: 'Preserve all original spelling exactly as written, including archaic forms, regional variants, and obvious author errors. Do not modernize or correct spelling in the original transcription.',

  mark_illegible_with_brackets: 'For text that cannot be read with confidence, use these conventions: [illegible] for completely unreadable, [torn] for damaged paper, [faded] for ink fading, [possibly: X] when you have a weak hypothesis. Never invent text.',

  preserve_abbreviations: 'Preserve all abbreviations exactly as written (e.g., fil., ux., agr., ст., св.). Do not expand abbreviations in the original transcription.',

  preserve_paragraph_breaks: 'Preserve paragraph breaks where clear. Use a single blank line between paragraphs. Maintain block order: address block, date line, body, postscript.',

  // ── Metric-book domain instructions ──
  extract_one_record_per_row: 'Each row in the tabular source represents one record (birth, marriage, death, etc.). Extract them individually as items in the records array, in the order they appear on the page.',

  include_page_header_metadata: 'Extract page-level metadata (year, page number, parish/village, archive reference) into the pageHeader object. Page headers may repeat column names across openings; do not transcribe column headers as records.',

  preserve_original_column_text: 'For each record, the "original" field must contain the verbatim row text as written, including abbreviations, diacritics, and column separators (use " | " between columns). This field preserves the source for verification.',

  // ── Galician Greek Catholic instructions ──
  decode_latin_abbreviations: 'Common Latin abbreviations to recognize: fil. = filius/filia (son/daughter of), ux. = uxor (wife), agr./agricolae = farmers, lab./laboriosus = laborer, mil./militaris = military, subd./subditi = subjects, viduus/vidua = widower/widow, coelebs = unmarried.',

  normalize_polish_diacritics: 'Polish diacritics that may appear: ą, ę, ł, ó, ś, ź, ż. Preserve them where clearly written. If unclear (e.g., aged paper), choose the most contextually plausible form.',

  preserve_latin_in_original_field: 'The "original" field for each record must keep Latin (and Polish/Ukrainian transliteration) exactly as written. Translation fields (uk/ru/en) may use modern equivalents and decoded names (e.g., Ivan instead of Joannes).',

  // ── Russian Imperial Orthodox instructions ──
  preserve_pre_reform_orthography_in_original: 'The "original" field must preserve pre-reform Cyrillic orthography exactly: Ѣ (yat), І (decimal i), Ѳ (fita), Ѵ (izhitsa), terminal ъ (hard sign), Church Slavonic titlo and stress marks. Do not modernize in the original field.',

  modernize_in_translations_only: 'In the translation fields (uk/ru/en), use modern orthography and modern spelling of names. Pre-reform forms belong only in the "original" field.',

  decode_cyrillic_numerals: 'Cyrillic alphabetic numerals appear in 18th-century records: А=1, В=2, Г=3, Д=4, Е=5, Ѕ=6, З=7, И=8, Ѳ/Θ=9, І=10, АІ=11, ВІ=12, КА=21, etc. Thousands marker ҂ (e.g., ҂АѰНД = 1754). In structured numeric fields use Arabic digits; in the "original" field preserve the Cyrillic numerals as written.',

  // ── Census / revision list instructions ──
  extract_one_record_per_household: 'Records are organized by household (семья / двор). One record = one household. Each household has multiple persons in the names array, each with a role (head, wife, son, daughter, relative, servant) and age fields where applicable.',

  extract_age_pairs: 'Revision lists pair "age at previous revision" with "age now". Extract both into ageAtPrev and ageNow fields per person. If a person is new since the previous revision, ageAtPrev may be empty.',

  // ── Personal correspondence instructions ──
  extract_named_entities: 'List all named entities (people, places, organizations) mentioned in the letter into the namedEntities array, with kind = person | place | organization.',

  // ── Official document instructions ──
  extract_form_fields_as_pairs: 'For pre-printed forms, extract each printed label and its handwritten/typed value as a {label, value} pair into extractedFields. Maintain the visual order (top-to-bottom, left-to-right within columns).',

  note_stamps_and_seals: 'Note any stamps, seals, or signatures in the transcription.notes field with format: "Stamp: [text on stamp]", "Seal: [description]", "Signature: [name if legible, else illegible].".'
};

/**
 * Resolves a list of instruction tokens to formatted prompt text.
 * Unknown tokens are skipped with a log warning.
 *
 * @param tokens Array of token keys (e.g., ["preserve_abbreviations", ...])
 * @return Concatenated paragraphs joined with double newlines.
 */
function resolveInstructions(tokens) {
  if (!tokens || !tokens.length) return '';
  var parts = [];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    var text = INSTRUCTION_LIBRARY[token];
    if (text) {
      parts.push(text);
    } else {
      Logger.log('resolveInstructions: unknown token "' + token + '"');
    }
  }
  return parts.join('\n\n');
}

/**
 * Returns the human-readable text for a single instruction token.
 * Useful for visual composers / preview UIs that show toggles.
 */
function getInstructionText(token) {
  return INSTRUCTION_LIBRARY[token] || null;
}
