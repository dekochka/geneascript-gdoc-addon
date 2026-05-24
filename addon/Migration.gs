/**
 * Migration — v1 → v2 schema transitions.
 *
 * Three migrations live here:
 *   1. SELECTED_TEMPLATE_ID  — maps legacy IDs (galicia_gc, russian_orthodox)
 *      to v2 variant IDs (galicia_gc_birth, russian_orth_birth). Generic stays.
 *   2. Custom templates      — converts the legacy { sections: {...} } shape
 *      to v2 layered shape, using legacyPromptOverride for cases that can't
 *      be safely re-compiled. Backs up originals to CUSTOM_TEMPLATES_V1_BACKUP.
 *   3. Document Context body → DOC_CONTEXT property. Implemented in
 *      V2Pipeline.gs (migrateContextBodyToProperties_) and triggered lazily
 *      on first read of getDocContext().
 *
 * All migrations are idempotent. Run them at the top of menu / sidebar entry
 * points so users never see a v1/v2 mismatch.
 */

var MIGRATION_FLAG_PROPERTY = 'V2_MIGRATION_DONE';
var CUSTOM_TEMPLATES_V1_BACKUP_PROPERTY = 'CUSTOM_TEMPLATES_V1_BACKUP';

/** Maps legacy template IDs to their v2 successor. */
var LEGACY_TO_V2_TEMPLATE_ID_MAP = {
  galicia_gc: 'galicia_gc_birth',
  russian_orthodox: 'russian_orth_birth',
  generic_plain: 'generic_plain' // identity — already a v2 variant ID
};

/**
 * Runs all v2 migrations once per (user, document). Safe to call repeatedly.
 * Returns a summary object for logging.
 */
function runV2MigrationsIfNeeded() {
  var summary = {
    selectedIdMigrated: false,
    customTemplatesMigrated: 0,
    customTemplatesBackedUp: false
  };

  // (1) SELECTED_TEMPLATE_ID — per-document
  try {
    var docProps = PropertiesService.getDocumentProperties();
    var docDoneFlag = docProps.getProperty(MIGRATION_FLAG_PROPERTY);
    if (docDoneFlag !== 'true') {
      var currentSelectedId = docProps.getProperty(TEMPLATE_ID_PROPERTY);
      if (currentSelectedId && LEGACY_TO_V2_TEMPLATE_ID_MAP[currentSelectedId]) {
        var newId = LEGACY_TO_V2_TEMPLATE_ID_MAP[currentSelectedId];
        if (newId !== currentSelectedId) {
          docProps.setProperty(TEMPLATE_ID_PROPERTY, newId);
          summary.selectedIdMigrated = true;
          Logger.log('runV2MigrationsIfNeeded: SELECTED_TEMPLATE_ID ' + currentSelectedId + ' -> ' + newId);
        }
      }
      docProps.setProperty(MIGRATION_FLAG_PROPERTY, 'true');
    }
  } catch (e) {
    Logger.log('runV2MigrationsIfNeeded: doc-level migration error: ' + e.message);
  }

  // (2) Custom templates — per-user
  try {
    var userProps = PropertiesService.getUserProperties();
    var userDoneFlag = userProps.getProperty(MIGRATION_FLAG_PROPERTY);
    if (userDoneFlag !== 'true') {
      var migrationResult = migrateCustomTemplatesV1ToV2_();
      summary.customTemplatesMigrated = migrationResult.migratedCount;
      summary.customTemplatesBackedUp = migrationResult.backedUp;
      userProps.setProperty(MIGRATION_FLAG_PROPERTY, 'true');
    }
  } catch (e) {
    Logger.log('runV2MigrationsIfNeeded: user-level migration error: ' + e.message);
  }

  return summary;
}

/**
 * Reads CUSTOM_TEMPLATES from User Properties and rewrites entries to v2
 * shape in place. Backs up the v1 raw JSON under CUSTOM_TEMPLATES_V1_BACKUP
 * before mutating, so a future downgrade or import can restore.
 *
 * Conversion strategy:
 *   - Entries that already have schemaVersion: 2 are left alone.
 *   - Entries with the v1 `sections` object are converted to a v2 entry
 *     whose parent matches the v1 parentTemplateId (galicia_gc → galicia_gc_birth, etc.).
 *     The v1 prompt sections are stored verbatim under `legacyPromptOverride`
 *     so the prompt compiler can opt to use the user's hand-tuned wording
 *     instead of compiling from the layered config. This preserves user intent
 *     without lossy text→token conversion.
 *
 * The legacyPromptOverride field is honored at runtime by the future
 * compileCustomTemplatePrompt_ path in PromptCompiler.gs / V2Pipeline.gs.
 */
function migrateCustomTemplatesV1ToV2_() {
  var userProps = PropertiesService.getUserProperties();
  var raw = userProps.getProperty(CUSTOM_TEMPLATES_PROPERTY);
  if (!raw) return { migratedCount: 0, backedUp: false };

  // Back up before mutating (one-time).
  var existingBackup = userProps.getProperty(CUSTOM_TEMPLATES_V1_BACKUP_PROPERTY);
  if (!existingBackup) {
    userProps.setProperty(CUSTOM_TEMPLATES_V1_BACKUP_PROPERTY, raw);
  }

  var list;
  try {
    list = JSON.parse(raw);
  } catch (e) {
    Logger.log('migrateCustomTemplatesV1ToV2_: parse error: ' + e.message);
    return { migratedCount: 0, backedUp: !!existingBackup };
  }
  if (!Array.isArray(list)) {
    Logger.log('migrateCustomTemplatesV1ToV2_: stored value is not an array');
    return { migratedCount: 0, backedUp: !!existingBackup };
  }

  var migratedCount = 0;
  for (var i = 0; i < list.length; i++) {
    var t = list[i];
    if (!t || typeof t !== 'object') continue;
    if (t.schemaVersion === SCHEMA_VERSION_V2) continue;
    list[i] = convertCustomTemplateV1ToV2_(t);
    migratedCount++;
  }

  if (migratedCount > 0) {
    userProps.setProperty(CUSTOM_TEMPLATES_PROPERTY, JSON.stringify(list));
    Logger.log('migrateCustomTemplatesV1ToV2_: migrated ' + migratedCount + ' custom templates');
  }
  return { migratedCount: migratedCount, backedUp: true };
}

function convertCustomTemplateV1ToV2_(v1) {
  var parentV1 = v1.parentTemplateId || 'galicia_gc';
  var parentV2 = LEGACY_TO_V2_TEMPLATE_ID_MAP[parentV1] || 'galicia_gc_birth';

  var sections = v1.sections || {};
  var promptParts = [];
  if (sections.role) {
    promptParts.push('#### Role\n\n' + sections.role);
  }
  promptParts.push('#### Context\n\n{{CONTEXT}}');
  if (sections.inputStructure) {
    promptParts.push('#### Input Template Description\n\n' + sections.inputStructure);
  }
  if (sections.outputFormat) {
    promptParts.push('#### Output Format\n\n' + sections.outputFormat);
  }
  if (sections.instructions) {
    promptParts.push('#### Instructions\n\n' + sections.instructions);
  }
  var legacyPrompt = promptParts.length > 0 ? promptParts.join('\n\n') : null;

  var v2 = {
    id: v1.id,
    schemaVersion: SCHEMA_VERSION_V2,
    parent: parentV2,
    meta: {
      label: v1.label || v1.id,
      description: v1.description || '',
      icon: 'edit_note',
      category: 'custom'
    },
    role: { expertise: [] },
    context: { fields: [], defaults: {} },
    inputSchema: { hints: [] },
    outputSchema: {},
    translation: {},
    examples: [],
    instructions: { general: [], domain: [] },
    legacyPromptOverride: legacyPrompt,
    legacyContextDefaultsText: v1.contextDefaults || '',
    createdAt: v1.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return v2;
}

/**
 * Restores v1 custom templates from backup. Intended as a manual escape hatch.
 * Returns a status object; does not throw on failure.
 */
function restoreCustomTemplatesV1Backup_() {
  var userProps = PropertiesService.getUserProperties();
  var backup = userProps.getProperty(CUSTOM_TEMPLATES_V1_BACKUP_PROPERTY);
  if (!backup) return { ok: false, message: 'No v1 backup present.' };
  userProps.setProperty(CUSTOM_TEMPLATES_PROPERTY, backup);
  userProps.deleteProperty(MIGRATION_FLAG_PROPERTY);
  return { ok: true, message: 'v1 custom templates restored from backup.' };
}
