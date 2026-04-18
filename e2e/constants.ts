/**
 * Default "GeneaScript Demo" doc with addon_dry_run (latest test deployment).
 * Override with GENEASCRIPT_TEST_DOC_URL when you use another doc or token.
 */
export const DEFAULT_TEST_DOC_URL =
  'https://drive.google.com/open?id=1fPALk9wQPJlEuEae2gLmj5wre_WLexVIcLZAdbAKODg&addon_dry_run=AAnXSK9GaLGlrrLUqJkarWJEgMLsG62SvXJx_kC3Nv-dNg50CyHxxGA6tvO-5qkdKnFl6tfbbn0M5jhMpL4zNsCXYOJyHbEFnGI4lsKFjEwiIPxrxPXiC0a98LCWazpzFP5cB6yeDsSx';

export function testDocUrl(): string {
  return process.env.GENEASCRIPT_TEST_DOC_URL || DEFAULT_TEST_DOC_URL;
}

/** Folder name to search in Google Picker during import test. */
export const IMPORT_FOLDER_SEARCH =
  'ДАТО ф487о1с545 1894 Турильче Вербівки народж - приклад';

/** Number of images to select from the import folder (cover + 5 pages). */
export const IMPORT_IMAGE_COUNT = 6;
