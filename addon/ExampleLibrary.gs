/**
 * Example Library — few-shot examples for prompt augmentation.
 *
 * Each example is a text-description-only pair (no image bytes); the example
 * shows the model what kind of input to expect and what JSON output to
 * produce. The PromptCompiler serializes referenced examples into the prompt.
 *
 * Templates reference examples by ID (in the `examples: [...]` array of the
 * template). See the design doc, section 8.
 */

var EXAMPLE_LIBRARY = {
  galicia_gc_birth_001: {
    id: 'galicia_gc_birth_001',
    templateId: 'galicia_gc_birth',
    description: 'Single birth record from 1886, typical Galician GC structure.',
    input: 'Row 1 — Numerus Prolis: 1; Dies/Mensis nati: 2 Januarii 1886; Baptismi: 6 Januarii 1886; Numerus Domus: 2; Nomen: Basilius; Sexus: Puer; Thori: Legitimi; Pater: Elias Kozij, agricola; Mater: Anna, filia Nicolai Burkun et Tatiannae Symkow; Patrini: Gregorius Mieczkowski, agricola; Pelagia, uxor Ignatii Iwanicki; Baptizans: J. Wicherhowski.',
    expectedOutput: {
      pageHeader: { year: '1886', pageNumber: '3', parish: 'Siedliska, fil. Temeriwci' },
      records: [
        {
          recordNumber: 1,
          birthDate: '1886-01-02',
          baptismDate: '1886-01-06',
          sex: 'M',
          legitimacy: 'leg.',
          houseNumber: '2',
          location: 'Temeriwci',
          officiant: 'J. Wicherhowski',
          names: [
            { fullName: 'Basilius Kozij', role: 'child', details: '' },
            { fullName: 'Elias Kozij',    role: 'father',     details: 'agricola' },
            { fullName: 'Anna',           role: 'mother',     details: 'filia Nicolai Burkun et Tatiannae Symkow' },
            { fullName: 'Gregorius Mieczkowski', role: 'godfather', details: 'agricola' },
            { fullName: 'Pelagia',        role: 'godmother',  details: 'uxor Ignatii Iwanicki' }
          ],
          original: '1 | 2 Jan 1886 | Btt. 6 Jan 1886 | dom. 2 | Basilius | Puer | leg. | Elias Kozij agr. | Anna fil. Nicolai Burkun et Tatiannae Symkow | Gregorius Mieczkowski agr.; Pelagia ux. Ignatii Iwanicki | J. Wicherhowski',
          notes: ''
        }
      ]
    }
  },

  galicia_gc_birth_002: {
    id: 'galicia_gc_birth_002',
    templateId: 'galicia_gc_birth',
    description: 'Birth record with illegitimacy and note about adoption — illustrates marginal-note handling.',
    input: 'Row 5 — N.P.: 5; nati: 14 Marti 1887; Btt: 16 Marti 1887; Domus: 17; Nomen: Maria; Puella; illeg.; Mater: Catharina Dudak; Pater ignotus; Patrini: Joannes Bilas et Eudocia Reha; Baptizans: A. Sokolewicz; nota margine: legitimata per matrimonium parentum 12 Aug 1888.',
    expectedOutput: {
      pageHeader: { year: '1887', pageNumber: '12', parish: 'Temeriwci' },
      records: [
        {
          recordNumber: 5,
          birthDate: '1887-03-14',
          baptismDate: '1887-03-16',
          sex: 'F',
          legitimacy: 'illeg.',
          houseNumber: '17',
          location: 'Temeriwci',
          officiant: 'A. Sokolewicz',
          names: [
            { fullName: 'Maria',            role: 'child',     details: '' },
            { fullName: 'Catharina Dudak',  role: 'mother',    details: '' },
            { fullName: 'Joannes Bilas',    role: 'godfather', details: '' },
            { fullName: 'Eudocia Reha',     role: 'godmother', details: '' }
          ],
          original: '5 | 14 Mar 1887 | Btt. 16 Mar 1887 | dom. 17 | Maria | Puella | illeg. | Pater ignotus | Catharina Dudak | Joannes Bilas et Eudocia Reha | A. Sokolewicz',
          notes: 'Marginal note: legitimated by parents\' marriage on 12 Aug 1888 (legitimata per matrimonium parentum)'
        }
      ]
    }
  }
};

/**
 * Returns the example objects referenced by a template.
 * Unknown IDs are skipped with a log warning.
 */
function getExamplesForTemplate(exampleIds) {
  if (!exampleIds || !exampleIds.length) return [];
  var out = [];
  for (var i = 0; i < exampleIds.length; i++) {
    var ex = EXAMPLE_LIBRARY[exampleIds[i]];
    if (ex) {
      out.push(ex);
    } else {
      Logger.log('getExamplesForTemplate: unknown example ID "' + exampleIds[i] + '"');
    }
  }
  return out;
}

/**
 * Serializes example objects into the prompt format.
 * Returns the empty string when no examples are provided so the compiler can
 * skip the entire "Examples" section.
 */
function serializeExamplesForPrompt(examples) {
  if (!examples || !examples.length) return '';
  var parts = [];
  for (var i = 0; i < examples.length; i++) {
    var ex = examples[i];
    parts.push('Example ' + (i + 1) + ' — ' + (ex.description || ''));
    parts.push('');
    parts.push('Input description:');
    parts.push(ex.input);
    parts.push('');
    parts.push('Expected JSON output:');
    parts.push(JSON.stringify(ex.expectedOutput, null, 2));
  }
  return parts.join('\n');
}
