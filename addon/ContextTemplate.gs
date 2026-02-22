/**
 * Context block template for the Metric Book Transcriber Doc Builder.
 * Sample values and formatting (e.g. ARCHIVE_NAME, ARCHIVE_REFERENCE in bold)
 * as in SPEC-2-GDRIVE-to-GDOC.md "Context Template" section.
 */

/**
 * Returns the full Context section body as a single string.
 * Labels such as ARCHIVE_NAME, ARCHIVE_REFERENCE are wrapped in ** for bold
 * when rendered by insertFormattedText() in Code.gs.
 */
function getContextTemplateText() {
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
