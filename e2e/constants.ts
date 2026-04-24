/**
 * Default "GeneaScript Demo" doc with addon_dry_run (latest test deployment).
 * Override with GENEASCRIPT_TEST_DOC_URL when you use another doc or token.
 */
export const DEFAULT_TEST_DOC_URL =
  'https://docs.google.com/document/d/1fPALk9wQPJlEuEae2gLmj5wre_WLexVIcLZAdbAKODg/edit?addon_dry_run=AAnXSK-0HLM4EAIqiZmgX6yJKiBK1nlTZQpX-9rDCq7J4aT5J1o_NtZiSYccwDhDj-1f_AOAj-m1w7ScgHPl9mh_bIm8_Bv8qHxDTpy0Zl5NMbf7N8Ij800Z0LPfBzoel6nc59VBCPKl&tab=t.0#heading=h.2mkonfxtxgq';

export function testDocUrl(): string {
  return process.env.GENEASCRIPT_TEST_DOC_URL || DEFAULT_TEST_DOC_URL;
}

/** Folder name to search in Google Picker during import test. */
export const IMPORT_FOLDER_SEARCH =
  'ДАТО ф487о1с545 1894 Турильче Вербівки народж - приклад';

/** Number of images to select from the import folder (cover + 5 pages). */
export const IMPORT_IMAGE_COUNT = 6;
