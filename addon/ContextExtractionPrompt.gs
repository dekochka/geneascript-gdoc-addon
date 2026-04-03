/**
 * Returns the prompt template for extracting Context metadata from
 * a metric-book cover/title page image.
 */
function getContextExtractionPromptTemplate() {
  return [
    'You are extracting metadata from a metric book cover/title page image.',
    'Return ONLY valid JSON. No markdown, no prose, no code fences.',
    '',
    'Identify as many fields as possible from the image.',
    'If a field is not present, use an empty string or empty array.',
    '',
    'Expected JSON schema:',
    '{',
    '  "archiveName": "string",',
    '  "archiveReference": "string",',
    '  "documentDescription": "string",',
    '  "dateRange": "string",',
    '  "villages": ["string"],',
    '  "commonSurnames": ["string"],',
    '  "notes": "string"',
    '}',
    '',
    'Extraction guidelines:',
    '- archiveName: archive institution short/long name.',
    '- archiveReference: fond/opys/sprava references as written.',
    '- documentDescription: metric book title/type and optional location details.',
    '- dateRange: date span if visible.',
    '- villages: village/locality names present on the page.',
    '- commonSurnames: surnames listed or strongly implied by cover context.',
    '- notes: extra contextual details helpful for transcription context.',
    '',
    'Output strictly one JSON object matching the schema.'
  ].join('\n');
}
