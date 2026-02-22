/**
 * Returns the prompt template for metric book transcription.
 * Placeholder {{CONTEXT}} is replaced with the document's Context section.
 * Content aligned with project/SPEC.md.
 */
function getPromptTemplate() {
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
    'Metric Book may contain mix of different table formats for births, deaths, marriage records. Expected columns:',
    '',
    '**Births:** Natus/Born, Baptized, Confirmed, House Number, Name (Child), Catholic/Or Other, Boy/Girl, Legitimate/Illegitimate, Name (Parents), Status (Parents), Name (Godparents), Status (Godparents).',
    '',
    '**Deaths:** Record Number, Date of Death, Date of Burial, House Number, Name of Deceased, Catholic, Male/Female, Age, Cause of Death.',
    '',
    '**Marriages:** Record Number, Date of Marriage, House Number, Name (Groom), Catholic/Or Other (Groom), Age (Groom), Single/Widower (Groom), Name (Bride), Catholic/Or Other (Bride), Age (Bride), Single/Widow (Bride), Name (Witnesses), Status (Witnesses).',
    '',
    '#### Output Format',
    '',
    '**Page Header:** Extract metadata from top of page: year, page number (Pagina), archival signatures (Fond/Opis/Case), village names in header.',
    '',
    '**Record Output:** For each record provide:',
    '- Address first line (village, house number).',
    '- Then name of person (births/deaths) or groom and bride (marriages) on new lines.',
    '- Parents (and their parents if available) on separate lines.',
    '- Godparents (births) or witnesses (marriages) on separate line.',
    '- Notes on separate line.',
    'Provide summary in: (1) Russian, (2) Ukrainian, (3) Original Latin transcription, (4) English. For Russian and Ukrainian use appropriate modern Western Ukrainian surname equivalents. Only transcribed text.',
    '',
    'Also include:',
    'Quality Metrics:',
    '- Handwriting Quality: e.g. 3/5 (5 highest)',
    '- Trust Score: e.g. 4/5 (5 highest, confidence that transcription matches image)',
    'Assessment:',
    '- Quality of Output: e.g. 2/5 (User fills after verification)',
    '- Corrections Notes: (User notes on errors)',
    '',
    '#### Instructions',
    '',
    'Step 1: Extract page header metadata (year, page number, Fond/Opis/Case if visible, village names).',
    '',
    'Step 2: For each record provide structured summary in Russian, Ukrainian, and Latin per the record output format above.',
    '',
    'Transcription accuracy: Transcribe exactly as written; preserve spelling and abbreviations. If unclear use [illegible] or [possibly X]. Village name may appear in header or under house number column.'
  ].join('\n');
}
