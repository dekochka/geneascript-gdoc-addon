/**
 * V2SelfTest — manual sanity checks runnable from the Apps Script editor.
 *
 * These are not real unit tests; they're inspection helpers for verifying
 * the schema-v2 pipeline without making API calls. Run any of the v2*Selftest
 * functions from the Apps Script editor and check the Logger output.
 */

/**
 * Logs the full inheritance chain and resolved schema for each user-facing
 * v2 template. Useful as a smoke test after edits to TemplateSchemaV2.gs.
 */
function v2RegistrySelftest() {
  Logger.log('--- v2RegistrySelftest ---');
  var tids = USER_FACING_TEMPLATE_IDS;
  for (var i = 0; i < tids.length; i++) {
    var id = tids[i];
    var resolved = resolveTemplateV2(id);
    if (!resolved) {
      Logger.log('FAIL ' + id + ': resolveTemplateV2 returned null');
      continue;
    }
    var fields = (resolved.context && resolved.context.fields) || [];
    var schemaKeys = (resolved.outputSchema && resolved.outputSchema.properties)
      ? Object.keys(resolved.outputSchema.properties).join(',') : '(none)';
    var instructionTokens = ((resolved.instructions && resolved.instructions.general) || []).concat(
      (resolved.instructions && resolved.instructions.domain) || []);
    Logger.log('OK ' + id + ' parent=' + (resolved.parent || 'none')
      + ' fields=' + fields.length
      + ' schemaProps=' + schemaKeys
      + ' instructions=' + instructionTokens.length);
  }
  Logger.log('--- done ---');
}

/**
 * Compiles a sample prompt for galicia_gc_birth and logs prompt length +
 * schema size. Useful to spot accidental prompt bloat after instruction
 * library edits.
 */
function v2PromptCompilerSelftest() {
  Logger.log('--- v2PromptCompilerSelftest ---');
  var sampleContext = {
    description: 'Метрична книга, церква св. Миколая, с. Темерівці',
    period: '1885–1942',
    sourceLanguages: ['latin', 'polish', 'ukrainian'],
    archiveName: 'ДАЙФО',
    archiveReference: 'Ф. 631, оп. 12, спр. 33',
    villages: ['Темерівці', 'Сідліська'],
    commonSurnames: ['Козій', 'Барилов', 'Дурбак']
  };
  var compiled = compilePrompt('galicia_gc_birth', sampleContext, { translationEnabled: true, locale: 'en' });
  var schemaJson = JSON.stringify(compiled.responseSchema || {});
  Logger.log('promptLength=' + compiled.promptText.length);
  Logger.log('schemaLength=' + schemaJson.length);
  Logger.log('translationEnabled=' + compiled.translationConfig.enabled
    + ' languages=' + (compiled.translationConfig.languages || []).join(','));
  Logger.log('--- prompt preview (first 800 chars) ---');
  Logger.log(compiled.promptText.substring(0, 800) + (compiled.promptText.length > 800 ? '…' : ''));
  Logger.log('--- schema preview (first 800 chars) ---');
  Logger.log(schemaJson.substring(0, 800) + (schemaJson.length > 800 ? '…' : ''));
  Logger.log('--- done ---');
}

/**
 * Verifies the migration path runs without throwing on a doc that has no
 * v1 state. Intended to be run on a fresh test document.
 */
function v2MigrationDryRun() {
  Logger.log('--- v2MigrationDryRun ---');
  var summary = runV2MigrationsIfNeeded();
  Logger.log('migration summary: ' + JSON.stringify(summary));
  var savedTpl = getSelectedTemplateId();
  Logger.log('selectedTemplateId after migration: ' + savedTpl);
  var ctx = getDocContext();
  Logger.log('docContext keys: ' + Object.keys(ctx || {}).join(','));
  Logger.log('--- done ---');
}

/**
 * Verifies the legacy custom-template migration converts a fake v1 entry
 * correctly. Does NOT modify real user data — operates on an in-memory copy.
 */
function v2LegacyCustomConversionSelftest() {
  Logger.log('--- v2LegacyCustomConversionSelftest ---');
  var fakeV1 = {
    id: 'custom_test_' + Date.now(),
    label: 'My Galician Birth Custom',
    description: 'Tweaked Latin abbreviation handling',
    parentTemplateId: 'galicia_gc',
    sections: {
      role: 'You are a paleographer focused on rare Galician notation.',
      inputStructure: 'Records arranged with extra column for godparent occupation.',
      outputFormat: 'Same as parent, plus include godparent occupation in details.',
      instructions: 'Always preserve abbreviations; expand them only in translation.'
    },
    contextDefaults: '**ARCHIVE_NAME**: Test\\n**VILLAGES**:\\nTest village',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z'
  };
  var v2 = convertCustomTemplateV1ToV2_(fakeV1);
  Logger.log('converted id=' + v2.id + ' parent=' + v2.parent + ' schemaVersion=' + v2.schemaVersion);
  Logger.log('legacyPromptOverride length=' + (v2.legacyPromptOverride ? v2.legacyPromptOverride.length : 0));
  Logger.log('legacyPromptOverride preview: ' + (v2.legacyPromptOverride || '').substring(0, 300));

  // Resolve through the inheritance chain & compile a sample prompt.
  var resolved = resolveTemplateV2(v2);
  Logger.log('resolved.parent (chain leaf): ' + resolved.parent);
  Logger.log('resolved.legacyPromptOverride? ' + (resolved.legacyPromptOverride ? 'yes' : 'no'));
  var compiled = compilePrompt(v2, { description: 'sample doc', archiveName: 'Test', villages: ['VillA'] }, { locale: 'en' });
  Logger.log('compiled.legacy=' + !!compiled.legacy);
  Logger.log('compiled.responseSchema=' + (compiled.responseSchema ? 'present' : 'null (legacy path)'));
  Logger.log('--- done ---');
}

/**
 * Convenience: runs all selftests in order.
 */
function v2RunAllSelftests() {
  v2RegistrySelftest();
  v2PromptCompilerSelftest();
  v2MigrationDryRun();
  v2LegacyCustomConversionSelftest();
}
