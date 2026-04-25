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

/**
 * Drive file IDs for the six test images used by test #6 (Import from Drive).
 * These are the files in the IMPORT_FOLDER_SEARCH folder, sorted by natural name.
 *
 * Override with GENEASCRIPT_IMPORT_FILE_IDS=id1,id2,... if you want to use a
 * different set. Leave empty to force the full-picker flow instead.
 *
 * IMPORTANT: The test account must have granted drive.file scope to each of
 * these IDs (easiest way: open the demo doc, click Import, step through the
 * picker manually once — Google remembers the grant).
 */
export const IMPORT_TEST_FILE_IDS: string[] = [
  '1yu2Giu7xJBRY9u6aADngZzSgT-jpv3RL', // cover-title-page.jpg
  '1QeJv7Rph0POsa7TYSBcxEQhJ5plKAayK', // image00001.jpg
  '1ywFjWaM0UhfqprDdHZIkPl13ovOeudMM', // image00002.jpg
  '1QMLrr6ZRxbo42Gw_eRWKaXUiiMcgi4Qw', // image00003.jpg
  '1GPlYv9lfrcVhSIO4gK7oPe82q1LlVh7t', // image00004.jpg
  '11_zZycpDIlDeW0D5Gp24_rh6uOEWqOvE', // image00005.jpg
];
