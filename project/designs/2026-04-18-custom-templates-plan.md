# Custom Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-created custom templates to the Template Gallery — users can clone OOB templates or create blank ones, customize prompt sections, and share with document collaborators.

**Architecture:** New `addon/CustomTemplate.gs` handles CRUD, storage (User Properties), export (Document Properties), and editor dialog HTML. Existing `addon/TemplateGallery.gs` is extended to resolve custom template IDs and render the "My Templates" gallery section. ~40 new i18n keys in EN/UK/RU.

**Tech Stack:** Google Apps Script, inline HTML dialogs, PropertiesService (User + Document Properties), JSON serialization.

**Design doc:** `project/designs/2026-04-18-custom-templates-design.md`
**Mocks:** `project/mocks/v1.4-custom-template-*.html`

---

### Task 1: I18n Keys (EN/UK/RU)

**Files:**
- Modify: `addon/I18n.gs`

Add all new i18n keys before any UI work so dialogs can reference them immediately. Every key needs EN, UK, and RU translations.

- [ ] **Step 1: Add gallery section keys to EN locale**

In `addon/I18n.gs`, inside `I18N_STRINGS.en`, add after the existing `'gallery.copy_prompt_hint'` key:

```javascript
    'gallery.section_official': 'Official Templates',
    'gallery.section_my': 'My Templates',
    'gallery.my_counter': '{count} of {max}',
    'gallery.badge_custom': 'Custom',
    'gallery.badge_shared': 'Shared',
    'gallery.parent_link': 'Based on: {name}',
    'gallery.create_from': '+ Create from Template',
    'gallery.create_blank': '+ Create Blank',
    'gallery.empty_title': 'No custom templates yet.',
    'gallery.empty_hint': 'Create one by cloning an official template or starting from scratch.',
    'gallery.action_edit': 'Edit',
    'gallery.action_duplicate': 'Duplicate',
    'gallery.action_export': 'Export to Doc',
    'gallery.action_delete': 'Delete',
    'gallery.confirm_delete': 'Delete this custom template? This cannot be undone.',
    'gallery.confirm_export': 'Share this template with document collaborators?',
    'gallery.exported_ok': 'Template shared with document.',
    'gallery.limit_reached': 'Maximum {max} custom templates. Delete one to create a new one.',
```

- [ ] **Step 2: Add picker and editor keys to EN locale**

Continuing in `I18N_STRINGS.en`, add after the gallery keys:

```javascript
    'picker.create_title': 'Create from Template',
    'picker.create_hint': 'Choose a template to use as a starting point. All sections will be copied and can be customized.',
    'picker.create_go': 'Create & Edit',
    'editor.title_new': 'New Custom Template',
    'editor.title_edit': 'Edit Custom Template',
    'editor.subtitle': 'Changes are saved to your personal template library.',
    'editor.parent_info': 'Based on: {name} \u2014 use Reset buttons to restore individual sections',
    'editor.field_name': 'Template Name',
    'editor.field_desc': 'Description',
    'editor.tab_role': 'Role',
    'editor.tab_input': 'Input Structure',
    'editor.tab_output': 'Output Format',
    'editor.tab_instructions': 'Instructions',
    'editor.tab_context': 'Context Defaults',
    'editor.reset_btn': 'Reset to inherited',
    'editor.reset_confirm': 'Reset this section to the inherited value? Your changes will be lost.',
    'editor.modified': 'Modified',
    'editor.save': 'Save',
    'editor.cancel': 'Cancel',
    'editor.delete': 'Delete Template',
    'editor.saving': 'Saving\u2026',
    'editor.saved': 'Template saved.',
    'editor.save_failed': 'Failed to save template.',
    'editor.name_required': 'Template name is required.',
    'editor.desc_required': 'Description is required.',
    'editor.too_large': 'Template content is too large. Shorten some sections.',
    'editor.section_empty_hint': 'This section will be omitted from the prompt.',
```

- [ ] **Step 3: Add UK locale translations**

In `I18N_STRINGS.uk`, add after existing `'gallery.copy_prompt_hint'`:

```javascript
    'gallery.section_official': 'Офіційні шаблони',
    'gallery.section_my': 'Мої шаблони',
    'gallery.my_counter': '{count} з {max}',
    'gallery.badge_custom': 'Власний',
    'gallery.badge_shared': 'Спільний',
    'gallery.parent_link': 'На основі: {name}',
    'gallery.create_from': '+ Створити з шаблону',
    'gallery.create_blank': '+ Створити порожній',
    'gallery.empty_title': 'Власних шаблонів поки немає.',
    'gallery.empty_hint': 'Створіть один, клонувавши офіційний шаблон або з нуля.',
    'gallery.action_edit': 'Редагувати',
    'gallery.action_duplicate': 'Дублювати',
    'gallery.action_export': 'Експорт у документ',
    'gallery.action_delete': 'Видалити',
    'gallery.confirm_delete': 'Видалити цей шаблон? Цю дію не можна скасувати.',
    'gallery.confirm_export': 'Поділитися цим шаблоном із співавторами документа?',
    'gallery.exported_ok': 'Шаблон додано до документа.',
    'gallery.limit_reached': 'Максимум {max} власних шаблонів. Видаліть один, щоб створити новий.',
    'picker.create_title': 'Створити з шаблону',
    'picker.create_hint': 'Оберіть шаблон як основу. Усі секції будуть скопійовані та доступні для редагування.',
    'picker.create_go': 'Створити й редагувати',
    'editor.title_new': 'Новий власний шаблон',
    'editor.title_edit': 'Редагування шаблону',
    'editor.subtitle': 'Зміни зберігаються у вашій особистій бібліотеці шаблонів.',
    'editor.parent_info': 'На основі: {name} \u2014 кнопки «Скинути» відновлюють окремі секції',
    'editor.field_name': 'Назва шаблону',
    'editor.field_desc': 'Опис',
    'editor.tab_role': 'Роль',
    'editor.tab_input': 'Структура введення',
    'editor.tab_output': 'Формат виводу',
    'editor.tab_instructions': 'Інструкції',
    'editor.tab_context': 'Контекст за замовчуванням',
    'editor.reset_btn': 'Скинути до успадкованого',
    'editor.reset_confirm': 'Скинути цю секцію до успадкованого значення? Ваші зміни буде втрачено.',
    'editor.modified': 'Змінено',
    'editor.save': 'Зберегти',
    'editor.cancel': 'Скасувати',
    'editor.delete': 'Видалити шаблон',
    'editor.saving': 'Збереження\u2026',
    'editor.saved': 'Шаблон збережено.',
    'editor.save_failed': 'Не вдалося зберегти шаблон.',
    'editor.name_required': 'Назва шаблону обов\u2019язкова.',
    'editor.desc_required': 'Опис обов\u2019язковий.',
    'editor.too_large': 'Вміст шаблону занадто великий. Скоротіть деякі секції.',
    'editor.section_empty_hint': 'Ця секція буде пропущена у промпті.',
```

- [ ] **Step 4: Add RU locale translations**

In `I18N_STRINGS.ru`, add after existing `'gallery.copy_prompt_hint'`:

```javascript
    'gallery.section_official': 'Официальные шаблоны',
    'gallery.section_my': 'Мои шаблоны',
    'gallery.my_counter': '{count} из {max}',
    'gallery.badge_custom': 'Свой',
    'gallery.badge_shared': 'Общий',
    'gallery.parent_link': 'На основе: {name}',
    'gallery.create_from': '+ Создать из шаблона',
    'gallery.create_blank': '+ Создать пустой',
    'gallery.empty_title': 'Своих шаблонов пока нет.',
    'gallery.empty_hint': 'Создайте один, клонировав официальный шаблон или с нуля.',
    'gallery.action_edit': 'Редактировать',
    'gallery.action_duplicate': 'Дублировать',
    'gallery.action_export': 'Экспорт в документ',
    'gallery.action_delete': 'Удалить',
    'gallery.confirm_delete': 'Удалить этот шаблон? Это действие нельзя отменить.',
    'gallery.confirm_export': 'Поделиться этим шаблоном с соавторами документа?',
    'gallery.exported_ok': 'Шаблон добавлен в документ.',
    'gallery.limit_reached': 'Максимум {max} своих шаблонов. Удалите один, чтобы создать новый.',
    'picker.create_title': 'Создать из шаблона',
    'picker.create_hint': 'Выберите шаблон как основу. Все секции будут скопированы и доступны для редактирования.',
    'picker.create_go': 'Создать и редактировать',
    'editor.title_new': 'Новый свой шаблон',
    'editor.title_edit': 'Редактирование шаблона',
    'editor.subtitle': 'Изменения сохраняются в вашей личной библиотеке шаблонов.',
    'editor.parent_info': 'На основе: {name} \u2014 кнопки «Сбросить» восстанавливают отдельные секции',
    'editor.field_name': 'Название шаблона',
    'editor.field_desc': 'Описание',
    'editor.tab_role': 'Роль',
    'editor.tab_input': 'Структура ввода',
    'editor.tab_output': 'Формат вывода',
    'editor.tab_instructions': 'Инструкции',
    'editor.tab_context': 'Контекст по умолчанию',
    'editor.reset_btn': 'Сбросить к унаследованному',
    'editor.reset_confirm': 'Сбросить эту секцию к унаследованному значению? Ваши изменения будут потеряны.',
    'editor.modified': 'Изменено',
    'editor.save': 'Сохранить',
    'editor.cancel': 'Отмена',
    'editor.delete': 'Удалить шаблон',
    'editor.saving': 'Сохранение\u2026',
    'editor.saved': 'Шаблон сохранён.',
    'editor.save_failed': 'Не удалось сохранить шаблон.',
    'editor.name_required': 'Название шаблона обязательно.',
    'editor.desc_required': 'Описание обязательно.',
    'editor.too_large': 'Содержимое шаблона слишком большое. Сократите некоторые секции.',
    'editor.section_empty_hint': 'Эта секция будет пропущена в промпте.',
```

- [ ] **Step 5: Add editor client i18n bundle function**

At the end of `addon/I18n.gs`, before the closing of the file, add a new client i18n bundle function (following the pattern of `getGalleryClientI18n()`):

```javascript
function getEditorClientI18n() {
  return {
    titleNew: t('editor.title_new'),
    titleEdit: t('editor.title_edit'),
    subtitle: t('editor.subtitle'),
    parentInfo: t('editor.parent_info'),
    fieldName: t('editor.field_name'),
    fieldDesc: t('editor.field_desc'),
    tabRole: t('editor.tab_role'),
    tabInput: t('editor.tab_input'),
    tabOutput: t('editor.tab_output'),
    tabInstructions: t('editor.tab_instructions'),
    tabContext: t('editor.tab_context'),
    resetBtn: t('editor.reset_btn'),
    resetConfirm: t('editor.reset_confirm'),
    modified: t('editor.modified'),
    save: t('editor.save'),
    cancel: t('editor.cancel'),
    deleteBtn: t('editor.delete'),
    saving: t('editor.saving'),
    saved: t('editor.saved'),
    saveFailed: t('editor.save_failed'),
    nameRequired: t('editor.name_required'),
    descRequired: t('editor.desc_required'),
    tooLarge: t('editor.too_large'),
    sectionEmptyHint: t('editor.section_empty_hint')
  };
}

function getCustomGalleryClientI18n() {
  return {
    sectionOfficial: t('gallery.section_official'),
    sectionMy: t('gallery.section_my'),
    myCounter: t('gallery.my_counter'),
    badgeCustom: t('gallery.badge_custom'),
    badgeShared: t('gallery.badge_shared'),
    parentLink: t('gallery.parent_link'),
    createFrom: t('gallery.create_from'),
    createBlank: t('gallery.create_blank'),
    emptyTitle: t('gallery.empty_title'),
    emptyHint: t('gallery.empty_hint'),
    actionEdit: t('gallery.action_edit'),
    actionDuplicate: t('gallery.action_duplicate'),
    actionExport: t('gallery.action_export'),
    actionDelete: t('gallery.action_delete'),
    confirmDelete: t('gallery.confirm_delete'),
    confirmExport: t('gallery.confirm_export'),
    exportedOk: t('gallery.exported_ok'),
    limitReached: t('gallery.limit_reached'),
    pickerTitle: t('picker.create_title'),
    pickerHint: t('picker.create_hint'),
    pickerGo: t('picker.create_go')
  };
}
```

- [ ] **Step 6: Verify no syntax errors**

Open the add-on in a test Google Doc (Extensions → GeneaScript → Open Sidebar). If the sidebar loads, i18n parsing is fine. If it fails, check for missing commas or quote issues in the new keys.

- [ ] **Step 7: Commit**

```bash
git add addon/I18n.gs
git commit -m "feat: add i18n keys for custom template gallery and editor (EN/UK/RU)"
```

---

### Task 2: Custom Template CRUD & Storage (`CustomTemplate.gs`)

**Files:**
- Create: `addon/CustomTemplate.gs`

Build the core data layer: reading/writing custom templates in User Properties, assembling prompts from sections, creating from parent, creating blank with scaffold.

- [ ] **Step 1: Create `CustomTemplate.gs` with constants and storage helpers**

Create `addon/CustomTemplate.gs`:

```javascript
/**
 * Custom Template CRUD, storage, and editor dialog.
 * Custom templates are stored in User Properties (personal library)
 * and can be exported to Document Properties (collaborator sharing).
 * See: project/designs/2026-04-18-custom-templates-design.md
 */

var CUSTOM_TEMPLATES_PROPERTY = 'CUSTOM_TEMPLATES';
var EXPORTED_TEMPLATES_PROPERTY = 'EXPORTED_CUSTOM_TEMPLATES';
var MAX_CUSTOM_TEMPLATES = 5;
var MAX_TEMPLATE_NAME_LENGTH = 80;
var MAX_TEMPLATE_DESC_LENGTH = 300;
var CUSTOM_ID_PREFIX = 'custom_';

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function getCustomTemplates() {
  try {
    var json = PropertiesService.getUserProperties().getProperty(CUSTOM_TEMPLATES_PROPERTY);
    if (!json) return [];
    var arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.log('getCustomTemplates: parse error, returning empty. ' + e.message);
    return [];
  }
}

function saveCustomTemplatesArray(arr) {
  var json = JSON.stringify(arr);
  if (json.length > 9000) {
    return { ok: false, message: t('editor.too_large') };
  }
  PropertiesService.getUserProperties().setProperty(CUSTOM_TEMPLATES_PROPERTY, json);
  return { ok: true };
}

function getCustomTemplateById(id) {
  var templates = getCustomTemplates();
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === id) return templates[i];
  }
  return null;
}

function getExportedCustomTemplates() {
  try {
    var json = PropertiesService.getDocumentProperties().getProperty(EXPORTED_TEMPLATES_PROPERTY);
    if (!json) return [];
    var arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    Logger.log('getExportedCustomTemplates: parse error. ' + e.message);
    return [];
  }
}

function getExportedCustomTemplateById(id) {
  var exported = getExportedCustomTemplates();
  for (var i = 0; i < exported.length; i++) {
    if (exported[i].id === id) return exported[i];
  }
  return null;
}
```

- [ ] **Step 2: Add `resolveCustomTemplate` and `assemblePromptFromSections`**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// Resolution: find custom template by ID (User Props → Document Props)
// ---------------------------------------------------------------------------

function resolveCustomTemplate(id) {
  var tpl = getCustomTemplateById(id);
  if (tpl) return tpl;
  return getExportedCustomTemplateById(id);
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

function assemblePromptFromSections(sections) {
  var parts = [];
  if (sections.role) {
    parts.push('#### Role\n\n' + sections.role);
  }
  parts.push('#### Context\n\n{{CONTEXT}}');
  if (sections.inputStructure) {
    parts.push('#### Input Template Description\n\n' + sections.inputStructure);
  }
  if (sections.outputFormat) {
    parts.push('#### Output Format\n\n' + sections.outputFormat);
  }
  if (sections.instructions) {
    parts.push('#### Instructions\n\n' + sections.instructions);
  }
  return parts.join('\n\n');
}
```

- [ ] **Step 3: Add CRUD functions (save, delete, duplicate)**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

function saveCustomTemplate(template) {
  var templates = getCustomTemplates();
  var existingIdx = -1;
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id === template.id) { existingIdx = i; break; }
  }
  if (existingIdx === -1 && templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  template.updatedAt = new Date().toISOString();
  if (existingIdx >= 0) {
    templates[existingIdx] = template;
  } else {
    templates.push(template);
  }
  var result = saveCustomTemplatesArray(templates);
  if (!result.ok) return result;
  return { ok: true, message: t('editor.saved') };
}

function deleteCustomTemplate(id) {
  var templates = getCustomTemplates();
  var filtered = [];
  for (var i = 0; i < templates.length; i++) {
    if (templates[i].id !== id) filtered.push(templates[i]);
  }
  if (filtered.length === templates.length) {
    return { ok: false, message: 'Template not found.' };
  }
  var result = saveCustomTemplatesArray(filtered);
  if (!result.ok) return result;

  // If deleted template was selected on this doc, revert to default
  try {
    var selectedId = PropertiesService.getDocumentProperties().getProperty(TEMPLATE_ID_PROPERTY);
    if (selectedId === id) {
      PropertiesService.getDocumentProperties().setProperty(TEMPLATE_ID_PROPERTY, DEFAULT_TEMPLATE_ID);
    }
  } catch (e) {
    Logger.log('deleteCustomTemplate: could not check selected ID. ' + e.message);
  }
  return { ok: true, message: 'Template deleted.' };
}
```

- [ ] **Step 4: Add create-from-parent and create-blank functions**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// Template creation
// ---------------------------------------------------------------------------

function createCustomTemplateFromParent(parentId) {
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var parentMeta = getTemplateById(parentId);
  if (!parentMeta) {
    return { ok: false, message: t('template.unknown', { id: parentId }) };
  }
  var prompt = getPromptForTemplate(parentId);
  var sections = parseSectionsFromPrompt(prompt);
  var now = new Date().toISOString();
  var tpl = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: '',
    description: '',
    parentTemplateId: parentId,
    sections: sections,
    contextDefaults: getContextDefaultsForTemplate(parentId),
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, template: tpl };
}

function createBlankCustomTemplate() {
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var now = new Date().toISOString();
  var tpl = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: '',
    description: '',
    parentTemplateId: null,
    sections: {
      role: '',
      inputStructure: '',
      outputFormat: getBlankOutputFormatScaffold(),
      instructions: getBlankInstructionsScaffold()
    },
    contextDefaults: getBlankContextDefaultsScaffold(),
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, template: tpl };
}

function parseSectionsFromPrompt(prompt) {
  var sections = { role: '', inputStructure: '', outputFormat: '', instructions: '' };
  var parts = prompt.split(/^####\s+/m);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i].trim();
    if (!part) continue;
    var firstNewline = part.indexOf('\n');
    var header = (firstNewline > 0 ? part.substring(0, firstNewline) : part).trim();
    var body = firstNewline > 0 ? part.substring(firstNewline + 1).trim() : '';
    if (header === 'Role') sections.role = body;
    else if (header === 'Input Template Description') sections.inputStructure = body;
    else if (header === 'Output Format') sections.outputFormat = body;
    else if (header === 'Instructions') sections.instructions = body;
  }
  return sections;
}

function getBlankOutputFormatScaffold() {
  return [
    'Output must be formatted for readability in a document.',
    'Use **bold** for labels, names, and key attributes (e.g., **Name:**, **Parents:**).',
    'Do NOT use bullet points for the main record data. Use standard paragraphs.',
    'Use blank lines to separate records.',
    '',
    '**Quality Metrics:** Handwriting Quality (e.g., 3/5), Trust Score (e.g., 4/5).',
    '**Assessment:** Quality of Output (e.g., 2/5), Corrections Notes.',
    '',
    'Provide the language summaries formatted as a bulleted list below each record.',
    'IMPORTANT: Use these exact language labels verbatim:',
    '- **ru:** [Summary in Russian]',
    '- **uk:** [Summary in Ukrainian]',
    '- **original:** [Original transcription]',
    '- **en:** [Summary in English]',
    '',
    'Repeat Quality Metrics and Assessment under each record, not once for the whole document.'
  ].join('\n');
}

function getBlankInstructionsScaffold() {
  return [
    'Step 1: Extract page header metadata (year, page number, archival signatures if visible, village/parish names).',
    '',
    'Step 2: For each record provide structured summary per the record output format above.',
    '',
    'Transcription accuracy: Transcribe exactly as written; preserve original spelling and abbreviations. If unclear use [illegible] or [possibly X].'
  ].join('\n');
}

function getBlankContextDefaultsScaffold() {
  return [
    '**ARCHIVE_NAME**:',
    '**ARCHIVE_REFERENCE**:',
    '**DOCUMENT_DESCRIPTION**:',
    '**DATE_RANGE**:',
    '**VILLAGES**:',
    '',
    '**COMMON_SURNAMES**:'
  ].join('\n');
}
```

- [ ] **Step 5: Add client-facing functions and export**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// Client-facing functions (called from dialogs via google.script.run)
// ---------------------------------------------------------------------------

function getCustomTemplateListForClient() {
  var own = getCustomTemplates();
  var exported = getExportedCustomTemplates();
  var ownIds = {};
  var list = [];

  for (var i = 0; i < own.length; i++) {
    var tpl = own[i];
    ownIds[tpl.id] = true;
    var parentLabel = '';
    if (tpl.parentTemplateId) {
      var pm = getTemplateById(tpl.parentTemplateId);
      parentLabel = pm ? t('template.' + tpl.parentTemplateId + '.label') : '';
    }
    list.push({
      id: tpl.id,
      label: tpl.label,
      description: tpl.description,
      parentTemplateId: tpl.parentTemplateId,
      parentLabel: parentLabel,
      isOwn: true
    });
  }

  for (var j = 0; j < exported.length; j++) {
    var ex = exported[j];
    if (ownIds[ex.id]) continue; // skip if user owns the same template
    var exParentLabel = '';
    if (ex.parentTemplateId) {
      var epm = getTemplateById(ex.parentTemplateId);
      exParentLabel = epm ? t('template.' + ex.parentTemplateId + '.label') : '';
    }
    list.push({
      id: ex.id,
      label: ex.label,
      description: ex.description,
      parentTemplateId: ex.parentTemplateId,
      parentLabel: exParentLabel,
      isOwn: false
    });
  }

  return list;
}

function saveCustomTemplateFromClient(templateJson) {
  try {
    var tpl = JSON.parse(templateJson);
    if (!tpl.label || !tpl.label.trim()) {
      return { ok: false, message: t('editor.name_required') };
    }
    if (!tpl.description || !tpl.description.trim()) {
      return { ok: false, message: t('editor.desc_required') };
    }
    tpl.label = tpl.label.trim().substring(0, MAX_TEMPLATE_NAME_LENGTH);
    tpl.description = tpl.description.trim().substring(0, MAX_TEMPLATE_DESC_LENGTH);
    return saveCustomTemplate(tpl);
  } catch (e) {
    Logger.log('saveCustomTemplateFromClient error: ' + e.message);
    return { ok: false, message: t('editor.save_failed') };
  }
}

function deleteCustomTemplateFromClient(id) {
  try {
    return deleteCustomTemplate(id);
  } catch (e) {
    Logger.log('deleteCustomTemplateFromClient error: ' + e.message);
    return { ok: false, message: 'Delete failed: ' + e.message };
  }
}

function duplicateCustomTemplate(sourceId) {
  var source = getCustomTemplateById(sourceId);
  if (!source) {
    source = getExportedCustomTemplateById(sourceId);
  }
  if (!source) {
    return { ok: false, message: 'Source template not found.' };
  }
  var templates = getCustomTemplates();
  if (templates.length >= MAX_CUSTOM_TEMPLATES) {
    return { ok: false, message: t('gallery.limit_reached', { max: MAX_CUSTOM_TEMPLATES }) };
  }
  var now = new Date().toISOString();
  var copy = {
    id: CUSTOM_ID_PREFIX + Date.now(),
    label: source.label + ' (copy)',
    description: source.description,
    parentTemplateId: source.parentTemplateId,
    sections: {
      role: source.sections.role,
      inputStructure: source.sections.inputStructure,
      outputFormat: source.sections.outputFormat,
      instructions: source.sections.instructions
    },
    contextDefaults: source.contextDefaults,
    createdAt: now,
    updatedAt: now
  };
  return { ok: true, template: copy };
}

function exportCustomTemplateToDocument(id) {
  try {
    var tpl = getCustomTemplateById(id);
    if (!tpl) return { ok: false, message: 'Template not found.' };

    var exported = getExportedCustomTemplates();
    // Replace if same ID already exported, otherwise append
    var found = false;
    for (var i = 0; i < exported.length; i++) {
      if (exported[i].id === tpl.id) {
        exported[i] = tpl;
        found = true;
        break;
      }
    }
    if (!found) exported.push(tpl);

    var json = JSON.stringify(exported);
    PropertiesService.getDocumentProperties().setProperty(EXPORTED_TEMPLATES_PROPERTY, json);
    return { ok: true, message: t('gallery.exported_ok') };
  } catch (e) {
    Logger.log('exportCustomTemplateToDocument error: ' + e.message);
    return { ok: false, message: 'Export failed: ' + e.message };
  }
}

function getParentSectionsForReset(parentId) {
  if (!parentId || !getTemplateById(parentId)) return null;
  var prompt = getPromptForTemplate(parentId);
  var sections = parseSectionsFromPrompt(prompt);
  sections.contextDefaults = getContextDefaultsForTemplate(parentId);
  return sections;
}
```

- [ ] **Step 6: Verify file loads without errors**

Push with `clasp push` and open the sidebar in a test doc. If it loads, the new file parsed correctly.

- [ ] **Step 7: Commit**

```bash
git add addon/CustomTemplate.gs
git commit -m "feat: add CustomTemplate.gs with CRUD, storage, and prompt assembly"
```

---

### Task 3: Extend `TemplateGallery.gs` Resolution Logic

**Files:**
- Modify: `addon/TemplateGallery.gs:59-97` (resolution functions)

Update `getSelectedTemplateId`, `setSelectedTemplateId`, `getPromptForTemplate`, and `getContextDefaultsForTemplate` to handle `custom_*` IDs.

- [ ] **Step 1: Update `getSelectedTemplateId` to accept custom IDs**

In `addon/TemplateGallery.gs`, replace lines 59-68:

```javascript
function getSelectedTemplateId() {
  try {
    var props = PropertiesService.getDocumentProperties();
    var id = props.getProperty(TEMPLATE_ID_PROPERTY);
    if (!id) return DEFAULT_TEMPLATE_ID;
    // OOB template
    if (TEMPLATES[id]) return id;
    // Custom template — verify it exists
    if (id.indexOf(CUSTOM_ID_PREFIX) === 0) {
      if (resolveCustomTemplate(id)) return id;
      Logger.log('getSelectedTemplateId: custom template not found, using default. id=' + id);
    }
  } catch (e) {
    Logger.log('getSelectedTemplateId: error reading doc props, using default. ' + e.message);
  }
  return DEFAULT_TEMPLATE_ID;
}
```

- [ ] **Step 2: Update `setSelectedTemplateId` to accept custom IDs**

Replace lines 70-73:

```javascript
function setSelectedTemplateId(id) {
  if (!TEMPLATES[id] && id.indexOf(CUSTOM_ID_PREFIX) !== 0) {
    throw new Error('Unknown template ID: ' + id);
  }
  PropertiesService.getDocumentProperties().setProperty(TEMPLATE_ID_PROPERTY, id);
}
```

- [ ] **Step 3: Update `getPromptForTemplate` to delegate custom templates**

Replace lines 75-85:

```javascript
function getPromptForTemplate(templateId) {
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom && custom.sections) return assemblePromptFromSections(custom.sections);
    Logger.log('getPromptForTemplate: custom template not found, falling back. id=' + templateId);
  }
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxPrompt();
    case 'generic_plain':
      return getGenericPlainPrompt();
    case 'galicia_gc':
    default:
      return getGaliciaGcPrompt();
  }
}
```

- [ ] **Step 4: Update `getContextDefaultsForTemplate` for custom templates**

Replace lines 87-97:

```javascript
function getContextDefaultsForTemplate(templateId) {
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom && custom.contextDefaults) return custom.contextDefaults;
    Logger.log('getContextDefaultsForTemplate: custom not found, falling back. id=' + templateId);
  }
  switch (templateId) {
    case 'russian_orthodox':
      return getRussianOrthodoxContextDefaults();
    case 'generic_plain':
      return getGenericPlainContextDefaults();
    case 'galicia_gc':
    default:
      return getGaliciaGcContextDefaults();
  }
}
```

- [ ] **Step 5: Update `getTemplateSectionsForClient` for custom templates**

In `addon/TemplateGallery.gs`, find `function getTemplateSectionsForClient(templateId)` (around line 151). Replace the opening guard:

```javascript
function getTemplateSectionsForClient(templateId) {
  // Custom template — read sections directly
  if (templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0) {
    var custom = resolveCustomTemplate(templateId);
    if (custom) {
      var documentContext = '';
      try {
        var doc = DocumentApp.getActiveDocument();
        if (doc) documentContext = getContextFromDocument(doc) || '';
      } catch (e) {
        Logger.log('getTemplateSectionsForClient: could not read doc context: ' + e.message);
      }
      return {
        documentContext: documentContext,
        hasDocumentContext: documentContext.length > 0,
        contextDefaults: custom.contextDefaults || '',
        role: custom.sections.role || '',
        columns: custom.sections.inputStructure || '',
        outputFormat: custom.sections.outputFormat || '',
        instructions: custom.sections.instructions || ''
      };
    }
  }

  if (!TEMPLATES[templateId]) {
    return { documentContext: '', contextDefaults: '', role: '', columns: '', outputFormat: '', instructions: '' };
  }
```

Keep the rest of the existing function unchanged (the OOB prompt-parsing logic).

- [ ] **Step 6: Update `getFullPromptForClient` for custom templates**

Find `function getFullPromptForClient(templateId)` (around line 134). Replace the opening guard:

```javascript
function getFullPromptForClient(templateId) {
  if (!TEMPLATES[templateId] && !(templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0 && resolveCustomTemplate(templateId))) {
    return '';
  }
```

Keep the rest unchanged — `getPromptForTemplate` already handles custom IDs.

- [ ] **Step 7: Update `getPromptPreviewForClient` for custom templates**

Find `function getPromptPreviewForClient(templateId)` (around line 126). Replace:

```javascript
function getPromptPreviewForClient(templateId) {
  if (!TEMPLATES[templateId] && !(templateId && templateId.indexOf(CUSTOM_ID_PREFIX) === 0 && resolveCustomTemplate(templateId))) {
    return t('template.preview_unknown');
  }
  return getPromptForTemplate(templateId);
}
```

- [ ] **Step 8: Test manually**

Push with `clasp push`. In a test doc:
1. Open sidebar — should load normally (no custom templates yet)
2. Open Template Gallery — should show 3 OOB templates (unchanged behavior)
3. Apply a template — should work as before

- [ ] **Step 9: Commit**

```bash
git add addon/TemplateGallery.gs
git commit -m "feat: extend template resolution to handle custom template IDs"
```

---

### Task 4: Update Gallery Dialog HTML — "My Templates" Section

**Files:**
- Modify: `addon/TemplateGallery.gs` (function `getTemplateGalleryHtml`)

Add the "Official Templates" label, divider, "My Templates" section with custom cards, empty state, and create buttons to the gallery dialog.

- [ ] **Step 1: Update `getTemplateGalleryHtml` — add CSS for new elements**

In the `<style>` block of `getTemplateGalleryHtml()`, add after the existing `.copy-bar` styles:

```javascript
    '.section-label { font-size: 11px; font-weight: bold; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }',
    '.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }',
    '.section-counter { font-size: 11px; color: #5f6368; }',
    '.divider { border-top: 1px solid #dadce0; margin: 16px 0; }',
    '.badge-custom { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: #e8f0fe; color: #1a73e8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; display: inline-block; margin-left: 6px; vertical-align: middle; }',
    '.badge-shared { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: #fef7e0; color: #e37400; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; display: inline-block; margin-left: 6px; vertical-align: middle; }',
    '.parent-link { font-size: 11px; color: #5f6368; margin-bottom: 4px; }',
    '.card-title-row { display: flex; align-items: center; margin-bottom: 2px; }',
    '.card-actions { display: flex; gap: 12px; margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee; }',
    '.card-actions button { font-size: 11px; background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; }',
    '.action-link { color: #1a73e8; }',
    '.action-danger { color: #c5221f; }',
    '.create-row { display: flex; gap: 8px; margin-top: 8px; }',
    '.create-btn { flex: 1; padding: 10px; border: 2px dashed #dadce0; border-radius: 8px; background: #f8f9fa; color: #1a73e8; font-size: 12px; cursor: pointer; font-weight: bold; transition: all 0.15s; text-align: center; }',
    '.create-btn:hover { border-color: #1a73e8; background: #e8f0fe; }',
    '.empty-state { text-align: center; padding: 16px; color: #5f6368; }',
    '.empty-state p { font-size: 12px; margin: 4px 0; line-height: 1.5; }',
```

- [ ] **Step 2: Add "Official Templates" section label**

In the HTML body, before the `<div class="cards" id="cards">` line, insert:

```javascript
    '<div class="section-label">' + esc(t('gallery.section_official')) + '</div>',
```

- [ ] **Step 3: Build "My Templates" section HTML**

After the closing `</div>` of `<div class="cards" id="cards">`, and before the preview toggle button, insert the My Templates section. This requires fetching custom template data server-side and rendering it.

Add a new helper to build the custom cards HTML. In `getTemplateGalleryHtml()`, before the `var parts = [` line, add:

```javascript
  var customTemplates = getCustomTemplateListForClient();
  var selectedId = getSelectedTemplateId();
  var customCardsHtml = '';
  for (var ci = 0; ci < customTemplates.length; ci++) {
    var ct = customTemplates[ci];
    var cChecked = ct.id === selectedId ? ' checked' : '';
    var cSelected = ct.id === selectedId ? ' selected' : '';
    var badge = ct.isOwn ? '<span class="badge-custom">' + esc(t('gallery.badge_custom')) + '</span>'
                         : '<span class="badge-shared">' + esc(t('gallery.badge_shared')) + '</span>';
    var parentLine = ct.parentLabel ? '<div class="parent-link">' + esc(t('gallery.parent_link', { name: ct.parentLabel })) + '</div>' : '';
    var actionsHtml = '';
    if (ct.isOwn) {
      actionsHtml = '<div class="card-actions">' +
        '<button class="action-link" onclick="doEditCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_edit')) + '</button>' +
        '<button class="action-link" onclick="doDuplicateCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_duplicate')) + '</button>' +
        '<button class="action-link" onclick="doExportCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_export')) + '</button>' +
        '<button class="action-danger" onclick="doDeleteCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_delete')) + '</button>' +
        '</div>';
    } else {
      actionsHtml = '<div class="card-actions">' +
        '<button class="action-link" onclick="doDuplicateCustom(\'' + esc(ct.id) + '\')">' + esc(t('gallery.action_duplicate')) + '</button>' +
        '</div>';
    }
    customCardsHtml += '<label class="card' + cSelected + '" data-id="' + esc(ct.id) + '">' +
      '<input type="radio" name="template" value="' + esc(ct.id) + '"' + cChecked + '>' +
      '<div class="card-body">' +
      '<div class="card-title-row"><span class="card-title">' + esc(ct.label) + '</span>' + badge + '</div>' +
      parentLine +
      '<div class="card-desc">' + esc(ct.description) + '</div>' +
      actionsHtml +
      '</div>' +
      '</label>';
  }

  var myTemplatesSectionHtml =
    '<div class="divider"></div>' +
    '<div class="section-header">' +
    '<span class="section-label">' + esc(t('gallery.section_my')) + '</span>' +
    '<span class="section-counter">' + esc(t('gallery.my_counter', { count: customTemplates.length, max: MAX_CUSTOM_TEMPLATES })) + '</span>' +
    '</div>';

  if (customTemplates.length === 0) {
    myTemplatesSectionHtml +=
      '<div class="empty-state">' +
      '<p><b>' + esc(t('gallery.empty_title')) + '</b></p>' +
      '<p>' + esc(t('gallery.empty_hint')) + '</p>' +
      '</div>';
  } else {
    myTemplatesSectionHtml += '<div class="cards">' + customCardsHtml + '</div>';
  }

  myTemplatesSectionHtml +=
    '<div class="create-row">' +
    '<button class="create-btn" onclick="doCreateFromTemplate()">' + esc(t('gallery.create_from')) + '</button>' +
    '<button class="create-btn" onclick="doCreateBlank()">' + esc(t('gallery.create_blank')) + '</button>' +
    '</div>';
```

Then in the HTML template `parts` array, after the line with `'<div class="cards" id="cards">' + cardsHtml + '</div>'`, add:

```javascript
    myTemplatesSectionHtml,
```

- [ ] **Step 4: Add custom gallery i18n to client JS**

In the `<script>` section of the gallery HTML, add the custom gallery i18n bundle. After the existing `var GI=...;` line, add:

```javascript
    'var CGI=', stringifyForHtmlScript(getCustomGalleryClientI18n()), ';',
```

- [ ] **Step 5: Add client-side action handlers**

In the `<script>` section, before the closing `</script>`, add:

```javascript
    'function doEditCustom(id){',
    '  google.script.run.showCustomTemplateEditorDialog(id);',
    '  google.script.host.close();',
    '}',
    'function doDuplicateCustom(id){',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){',
    '      google.script.run.withSuccessHandler(function(r2){',
    '        if(r2.ok){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }',
    '        else{ showStatus("error",r2.message); }',
    '      }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).saveCustomTemplateFromClient(JSON.stringify(r.template));',
    '    }else{ showStatus("error",r.message); }',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).duplicateCustomTemplate(id);',
    '}',
    'function doExportCustom(id){',
    '  if(!confirm(CGI.confirmExport)) return;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    showStatus(r.ok?"success":"error",r.message);',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).exportCustomTemplateToDocument(id);',
    '}',
    'function doDeleteCustom(id){',
    '  if(!confirm(CGI.confirmDelete)) return;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }',
    '    else{ showStatus("error",r.message); }',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).deleteCustomTemplateFromClient(id);',
    '}',
    'function doCreateFromTemplate(){',
    '  google.script.run.showCreateFromTemplatePickerDialog();',
    '  google.script.host.close();',
    '}',
    'function doCreateBlank(){',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showCustomTemplateEditorDialog(r.template.id); google.script.host.close(); }',
    '    else{ showStatus("error",r.message); }',
    '  }).withFailureHandler(function(e){ showStatus("error",GI.errorPrefix+" "+(e.message||"")); }).createBlankCustomTemplate();',
    '}',
```

- [ ] **Step 6: Update the card click handler to include custom cards**

The existing `cards.forEach` at the top of the script only attaches listeners to OOB cards. Update to re-query after the full DOM is built. Replace the existing card-click block:

```javascript
    'var cards=document.querySelectorAll(".card");',
    'cards.forEach(function(c){',
    '  c.addEventListener("click",function(e){',
    '    if(e.target.closest(".card-actions")) return;',
    '    cards.forEach(function(x){x.classList.remove("selected");});',
    '    c.classList.add("selected");',
    '    c.querySelector("input[type=radio]").checked=true;',
    '    cachedFullPrompt=null;',
    '    if(document.getElementById("previewWrap").classList.contains("open")){loadSections(function(){showTab(currentTab);});}',
    '  });',
    '});',
```

Note the added `if(e.target.closest(".card-actions")) return;` to prevent card selection when clicking action buttons.

- [ ] **Step 7: Test manually**

Push with `clasp push`. In a test doc:
1. Open Template Gallery — should show "Official Templates" label, 3 OOB cards, divider, "My Templates" section with empty state and create buttons
2. Existing OOB selection/apply should still work
3. Create buttons should be visible (they won't work yet — editor dialog is Task 5)

- [ ] **Step 8: Commit**

```bash
git add addon/TemplateGallery.gs
git commit -m "feat: add My Templates section to gallery dialog with custom card rendering"
```

---

### Task 5: Create-from-Template Picker Dialog

**Files:**
- Modify: `addon/CustomTemplate.gs` (add `showCreateFromTemplatePickerDialog` and `getCreateFromTemplatePickerHtml`)

- [ ] **Step 1: Add picker dialog functions**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// Create-from-Template Picker Dialog
// ---------------------------------------------------------------------------

function showCreateFromTemplatePickerDialog() {
  var html = getCreateFromTemplatePickerHtml();
  var ui = DocumentApp.getUi();
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(420).setHeight(340),
    t('picker.create_title')
  );
}

function getCreateFromTemplatePickerHtml() {
  var templates = getTemplateListForClient();
  var itemsHtml = '';
  for (var i = 0; i < templates.length; i++) {
    var tpl = templates[i];
    var checked = i === 0 ? ' checked' : '';
    var sel = i === 0 ? ' selected' : '';
    itemsHtml += '<label class="tpl-item' + sel + '" onclick="selItem(this)">' +
      '<input type="radio" name="parent" value="' + esc(tpl.id) + '"' + checked + '>' +
      '<div class="tpl-item-body">' +
      '<div class="tpl-item-title">' + esc(tpl.label) + '</div>' +
      '<div class="tpl-item-desc">' + esc(tpl.region) + ' &middot; ' + esc(tpl.religion) + ' &middot; ' + esc(tpl.recordTypes) + '</div>' +
      '</div>' +
      '</label>';
  }

  return [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; }',
    '.subtitle { font-size: 12px; color: #5f6368; margin-bottom: 16px; }',
    '.tpl-list { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }',
    '.tpl-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.15s; }',
    '.tpl-item:hover { border-color: #1a73e8; }',
    '.tpl-item.selected { border-color: #1a73e8; background: #e8f0fe; }',
    '.tpl-item input[type=radio] { accent-color: #1a73e8; margin: 0; }',
    '.tpl-item-body { flex: 1; }',
    '.tpl-item-title { font-weight: bold; font-size: 13px; margin-bottom: 1px; }',
    '.tpl-item-desc { font-size: 11px; color: #5f6368; }',
    '.actions { display: flex; gap: 8px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid #eee; }',
    '.btn { padding: 8px 20px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.status { font-size: 12px; margin-top: 8px; padding: 8px; border-radius: 4px; display: none; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '</style>',
    '</head><body>',
    '<p class="subtitle">' + esc(t('picker.create_hint')) + '</p>',
    '<div class="tpl-list">' + itemsHtml + '</div>',
    '<div id="statusMsg" class="status"></div>',
    '<div class="actions">',
    '<button class="btn" onclick="google.script.host.close()">' + esc(t('editor.cancel')) + '</button>',
    '<button class="btn btn-primary" id="goBtn" onclick="doCreate()">' + esc(t('picker.create_go')) + '</button>',
    '</div>',
    '<script>',
    'function selItem(el){',
    '  document.querySelectorAll(".tpl-item").forEach(function(x){x.classList.remove("selected");});',
    '  el.classList.add("selected");',
    '  el.querySelector("input[type=radio]").checked=true;',
    '}',
    'function doCreate(){',
    '  var r=document.querySelector("input[name=parent]:checked");',
    '  if(!r) return;',
    '  document.getElementById("goBtn").disabled=true;',
    '  document.getElementById("goBtn").textContent="Creating\\u2026";',
    '  google.script.run.withSuccessHandler(function(res){',
    '    if(res.ok){',
    '      google.script.run.showCustomTemplateEditorDialog(res.template.id);',
    '      google.script.host.close();',
    '    }else{',
    '      document.getElementById("statusMsg").className="status error";',
    '      document.getElementById("statusMsg").textContent=res.message;',
    '      document.getElementById("goBtn").disabled=false;',
    '      document.getElementById("goBtn").textContent="' + esc(t('picker.create_go')) + '";',
    '    }',
    '  }).withFailureHandler(function(e){',
    '    document.getElementById("statusMsg").className="status error";',
    '    document.getElementById("statusMsg").textContent=e.message||"Error";',
    '    document.getElementById("goBtn").disabled=false;',
    '    document.getElementById("goBtn").textContent="' + esc(t('picker.create_go')) + '";',
    '  }).createCustomTemplateFromParent(r.value);',
    '}',
    '</script>',
    '</body></html>'
  ].join('\n');
}
```

- [ ] **Step 2: Test manually**

Push with `clasp push`. In test doc:
1. Open Template Gallery → click "+ Create from Template"
2. Picker dialog should open with 3 OOB templates
3. Select one, click "Create & Edit" → should attempt to open editor (will fail gracefully since editor dialog is Task 6)

- [ ] **Step 3: Commit**

```bash
git add addon/CustomTemplate.gs
git commit -m "feat: add Create from Template picker dialog"
```

---

### Task 6: Custom Template Editor Dialog

**Files:**
- Modify: `addon/CustomTemplate.gs` (add `showCustomTemplateEditorDialog` and `getCustomTemplateEditorHtml`)

This is the largest UI piece — the tabbed editor with metadata fields, section textareas, and reset-to-inherited functionality.

- [ ] **Step 1: Add `showCustomTemplateEditorDialog`**

Append to `addon/CustomTemplate.gs`:

```javascript
// ---------------------------------------------------------------------------
// Editor Dialog
// ---------------------------------------------------------------------------

function showCustomTemplateEditorDialog(templateId) {
  var html = getCustomTemplateEditorHtml(templateId);
  var ui = DocumentApp.getUi();
  var isNew = !templateId || !getCustomTemplateById(templateId);
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(640).setHeight(700),
    isNew ? t('editor.title_new') : t('editor.title_edit')
  );
}
```

- [ ] **Step 2: Add `getCustomTemplateEditorHtml`**

This is a large function. Append to `addon/CustomTemplate.gs`:

```javascript
function getCustomTemplateEditorHtml(templateId) {
  var tpl = null;
  if (templateId) {
    tpl = getCustomTemplateById(templateId);
  }
  var isNew = !tpl;
  // For newly created templates (from createCustomTemplateFromParent or createBlankCustomTemplate),
  // the template exists only in the client's memory — pass it via a hidden field.
  // We look it up from User Properties; if not found, look in the URL param (client-side).

  // If template was just created but not yet saved, it won't be in User Properties.
  // The create flow passes the template ID, and the create function returns the template object.
  // We need a different approach: the create function returns the template, the picker dialog
  // serializes it and passes to the editor. But Apps Script dialogs can't pass data between
  // modals directly. So instead: createCustomTemplateFromParent saves to User Properties immediately
  // as a draft, then editor loads it.

  // Actually simpler: create functions should save immediately, editor loads by ID.
  // Let's adjust: createCustomTemplateFromParent and createBlankCustomTemplate save the template
  // to User Properties immediately (with empty label/description as draft).
  // The editor loads it, user fills in metadata, saves again.

  // For now, if tpl is null (new blank), create a default in-memory template for the form.
  var tplJson = '{}';
  if (tpl) {
    tplJson = JSON.stringify(tpl);
  }

  var parentLabel = '';
  var hasParent = false;
  if (tpl && tpl.parentTemplateId) {
    var pm = getTemplateById(tpl.parentTemplateId);
    if (pm) {
      parentLabel = t('template.' + tpl.parentTemplateId + '.label');
      hasParent = true;
    }
  }

  var eiJson = stringifyForHtmlScript(getEditorClientI18n());

  var tabs = [
    { key: 'role', label: t('editor.tab_role') },
    { key: 'inputStructure', label: t('editor.tab_input') },
    { key: 'outputFormat', label: t('editor.tab_output') },
    { key: 'instructions', label: t('editor.tab_instructions') },
    { key: 'contextDefaults', label: t('editor.tab_context') }
  ];

  var tabBtnsHtml = '';
  for (var ti = 0; ti < tabs.length; ti++) {
    var cls = ti === 0 ? ' active' : '';
    tabBtnsHtml += '<button class="tab-btn' + cls + '" data-tab="' + tabs[ti].key + '" onclick="switchTab(this)">' + esc(tabs[ti].label) + '</button>';
  }

  return [
    '<!DOCTYPE html><html><head><base target="_top">',
    '<style>',
    'body { font-family: Arial, sans-serif; font-size: 13px; margin: 0; padding: 16px; color: #333; display: flex; flex-direction: column; height: calc(100vh - 32px); }',
    '.editor-header { margin-bottom: 12px; }',
    '.editor-header .subtitle { font-size: 12px; color: #5f6368; }',
    '.parent-info { font-size: 11px; color: #5f6368; margin-top: 4px; padding: 6px 10px; background: #f1f3f4; border-radius: 4px; display: inline-block; }',
    '.parent-info strong { color: #1a73e8; }',
    '.field-group { margin-bottom: 10px; }',
    '.field-group label { display: block; font-size: 12px; font-weight: bold; color: #333; margin-bottom: 3px; }',
    '.field-group .req { color: #c5221f; }',
    '.field-group input[type=text], .field-group textarea { width: 100%; box-sizing: border-box; padding: 7px 10px; border: 1px solid #dadce0; border-radius: 4px; font-family: Arial, sans-serif; font-size: 13px; color: #333; }',
    '.field-group input:focus, .field-group textarea:focus { outline: none; border-color: #1a73e8; box-shadow: 0 0 0 2px rgba(26,115,232,0.15); }',
    '.char-count { font-size: 10px; color: #999; text-align: right; margin-top: 2px; }',
    '.tab-bar { display: flex; border-bottom: 1px solid #dadce0; background: #f1f3f4; border-radius: 4px 4px 0 0; margin-top: 4px; }',
    '.tab-btn { padding: 7px 10px; font-size: 11px; border: none; background: none; cursor: pointer; color: #5f6368; white-space: nowrap; border-bottom: 2px solid transparent; }',
    '.tab-btn:hover { color: #1a73e8; }',
    '.tab-btn.active { color: #1a73e8; border-bottom-color: #1a73e8; font-weight: bold; }',
    '.tab-panel { border: 1px solid #dadce0; border-top: none; border-radius: 0 0 4px 4px; flex: 1; display: flex; flex-direction: column; min-height: 0; }',
    '.tab-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }',
    '.tab-panel-header .sec-label { font-size: 11px; font-weight: bold; color: #5f6368; }',
    '.modified-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #f9ab00; margin-left: 4px; vertical-align: middle; }',
    '.reset-btn { font-size: 11px; padding: 3px 8px; border: 1px solid #dadce0; border-radius: 4px; background: #fff; color: #5f6368; cursor: pointer; display: flex; align-items: center; gap: 3px; }',
    '.reset-btn:hover { border-color: #f9ab00; color: #e37400; background: #fef7e0; }',
    '.section-editor { flex: 1; display: flex; }',
    '.section-editor textarea { width: 100%; box-sizing: border-box; min-height: 180px; padding: 8px 10px; border: none; font-family: "Roboto Mono", "Courier New", monospace; font-size: 11px; line-height: 1.5; color: #333; resize: vertical; flex: 1; }',
    '.section-editor textarea:focus { outline: none; background: #fafbff; }',
    '.empty-hint { font-size: 10px; color: #f9ab00; padding: 4px 10px; background: #fef7e0; border-top: 1px solid #fce8b2; }',
    '.scroll-body { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }',
    '.actions { display: flex; gap: 8px; justify-content: space-between; margin-top: auto; padding-top: 10px; border-top: 1px solid #eee; }',
    '.actions-left { display: flex; gap: 8px; }',
    '.actions-right { display: flex; gap: 8px; }',
    '.btn { padding: 7px 18px; border-radius: 4px; font-size: 13px; cursor: pointer; border: 1px solid #dadce0; background: #fff; color: #333; }',
    '.btn:hover { background: #f1f3f4; }',
    '.btn-primary { background: #1a73e8; color: #fff; border-color: #1a73e8; }',
    '.btn-primary:hover { background: #1765cc; }',
    '.btn-danger { color: #c5221f; border-color: #c5221f; }',
    '.btn-danger:hover { background: #fce8e6; }',
    '.status { font-size: 12px; margin-top: 6px; padding: 6px; border-radius: 4px; display: none; }',
    '.status.success { display: block; background: #e6f4ea; color: #137333; }',
    '.status.error { display: block; background: #fce8e6; color: #c5221f; }',
    '</style>',
    '</head><body>',
    '<div class="editor-header">',
    '  <div class="subtitle">' + esc(t('editor.subtitle')) + '</div>',
    hasParent ? '  <div class="parent-info">' + esc(t('editor.parent_info', { name: parentLabel })) + '</div>' : '',
    '</div>',
    '<div class="scroll-body">',
    '<div class="field-group">',
    '  <label>' + esc(t('editor.field_name')) + ' <span class="req">*</span></label>',
    '  <input type="text" id="tplName" maxlength="80" value="">',
    '</div>',
    '<div class="field-group">',
    '  <label>' + esc(t('editor.field_desc')) + ' <span class="req">*</span></label>',
    '  <textarea id="tplDesc" rows="2" maxlength="300"></textarea>',
    '  <div class="char-count"><span id="descCount">0</span> / 300</div>',
    '</div>',
    '<div class="tab-bar">' + tabBtnsHtml + '</div>',
    '<div class="tab-panel">',
    '  <div class="tab-panel-header">',
    '    <span class="sec-label" id="secLabel"></span>',
    hasParent ? '    <button class="reset-btn" id="resetBtn" onclick="doReset()">&#8635; ' + esc(t('editor.reset_btn')) + '</button>' : '',
    '  </div>',
    '  <div class="section-editor"><textarea id="secTextarea"></textarea></div>',
    '  <div class="empty-hint" id="emptyHint" style="display:none">' + esc(t('editor.section_empty_hint')) + '</div>',
    '</div>',
    '</div>',
    '<div id="statusMsg" class="status"></div>',
    '<div class="actions">',
    '  <div class="actions-left">',
    isNew ? '' : '    <button class="btn btn-danger" onclick="doDelete()">' + esc(t('editor.delete')) + '</button>',
    '  </div>',
    '  <div class="actions-right">',
    '    <button class="btn" onclick="google.script.host.close()">' + esc(t('editor.cancel')) + '</button>',
    '    <button class="btn btn-primary" id="saveBtn" onclick="doSave()">' + esc(t('editor.save')) + '</button>',
    '  </div>',
    '</div>',
    '<script>',
    'var EI=' + eiJson + ';',
    'var tpl=' + stringifyForHtmlScript(tpl || {}) + ';',
    'var parentId=' + stringifyForHtmlScript(hasParent ? tpl.parentTemplateId : null) + ';',
    'var parentSections=null;',
    'var currentTab="role";',
    'var sectionData={',
    '  role: tpl.sections ? tpl.sections.role || "" : "",',
    '  inputStructure: tpl.sections ? tpl.sections.inputStructure || "" : "",',
    '  outputFormat: tpl.sections ? tpl.sections.outputFormat || "" : "",',
    '  instructions: tpl.sections ? tpl.sections.instructions || "" : "",',
    '  contextDefaults: tpl.contextDefaults || ""',
    '};',
    '',
    'document.getElementById("tplName").value = tpl.label || "";',
    'document.getElementById("tplDesc").value = tpl.description || "";',
    'document.getElementById("descCount").textContent = (tpl.description || "").length;',
    'document.getElementById("tplDesc").addEventListener("input", function(){ document.getElementById("descCount").textContent = this.value.length; });',
    '',
    'showSection("role");',
    '',
    'function switchTab(btn){',
    '  document.querySelectorAll(".tab-btn").forEach(function(b){b.classList.remove("active");});',
    '  btn.classList.add("active");',
    '  saveCurrent();',
    '  currentTab = btn.getAttribute("data-tab");',
    '  showSection(currentTab);',
    '}',
    '',
    'function saveCurrent(){',
    '  sectionData[currentTab] = document.getElementById("secTextarea").value;',
    '}',
    '',
    'var tabLabels = { role: EI.tabRole, inputStructure: EI.tabInput, outputFormat: EI.tabOutput, instructions: EI.tabInstructions, contextDefaults: EI.tabContext };',
    '',
    'function showSection(key){',
    '  document.getElementById("secLabel").textContent = tabLabels[key] || key;',
    '  document.getElementById("secTextarea").value = sectionData[key] || "";',
    '  var hint = document.getElementById("emptyHint");',
    '  hint.style.display = (!sectionData[key] || !sectionData[key].trim()) ? "block" : "none";',
    '  document.getElementById("secTextarea").oninput = function(){ hint.style.display = this.value.trim() ? "none" : "block"; };',
    '}',
    '',
    'function doReset(){',
    '  if(!parentId) return;',
    '  if(!confirm(EI.resetConfirm)) return;',
    '  if(parentSections){',
    '    applyReset();',
    '  } else {',
    '    google.script.run.withSuccessHandler(function(ps){',
    '      parentSections = ps;',
    '      applyReset();',
    '    }).withFailureHandler(function(e){',
    '      showStatus("error", e.message || "Reset failed");',
    '    }).getParentSectionsForReset(parentId);',
    '  }',
    '}',
    '',
    'function applyReset(){',
    '  if(!parentSections) return;',
    '  sectionData[currentTab] = parentSections[currentTab] || "";',
    '  showSection(currentTab);',
    '}',
    '',
    'function doSave(){',
    '  saveCurrent();',
    '  var name = document.getElementById("tplName").value.trim();',
    '  var desc = document.getElementById("tplDesc").value.trim();',
    '  if(!name){ showStatus("error", EI.nameRequired); return; }',
    '  if(!desc){ showStatus("error", EI.descRequired); return; }',
    '  var obj = {',
    '    id: tpl.id || "",',
    '    label: name,',
    '    description: desc,',
    '    parentTemplateId: tpl.parentTemplateId || null,',
    '    sections: {',
    '      role: sectionData.role,',
    '      inputStructure: sectionData.inputStructure,',
    '      outputFormat: sectionData.outputFormat,',
    '      instructions: sectionData.instructions',
    '    },',
    '    contextDefaults: sectionData.contextDefaults,',
    '    createdAt: tpl.createdAt || new Date().toISOString(),',
    '    updatedAt: new Date().toISOString()',
    '  };',
    '  document.getElementById("saveBtn").disabled = true;',
    '  document.getElementById("saveBtn").textContent = EI.saving;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){',
    '      showStatus("success", EI.saved);',
    '      setTimeout(function(){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }, 1000);',
    '    } else {',
    '      showStatus("error", r.message);',
    '      document.getElementById("saveBtn").disabled = false;',
    '      document.getElementById("saveBtn").textContent = EI.save;',
    '    }',
    '  }).withFailureHandler(function(e){',
    '    showStatus("error", EI.saveFailed + " " + (e.message || ""));',
    '    document.getElementById("saveBtn").disabled = false;',
    '    document.getElementById("saveBtn").textContent = EI.save;',
    '  }).saveCustomTemplateFromClient(JSON.stringify(obj));',
    '}',
    '',
    'function doDelete(){',
    '  if(!tpl.id) return;',
    '  if(!confirm("' + esc(t('gallery.confirm_delete')) + '")) return;',
    '  google.script.run.withSuccessHandler(function(r){',
    '    if(r.ok){ google.script.run.showTemplateGalleryDialog(); google.script.host.close(); }',
    '    else{ showStatus("error", r.message); }',
    '  }).withFailureHandler(function(e){',
    '    showStatus("error", e.message || "Delete failed");',
    '  }).deleteCustomTemplateFromClient(tpl.id);',
    '}',
    '',
    'function showStatus(type, msg){',
    '  var el = document.getElementById("statusMsg");',
    '  el.className = "status " + type;',
    '  el.textContent = msg;',
    '}',
    '</script>',
    '</body></html>'
  ].join('\n');
}
```

- [ ] **Step 2: Fix create flows to save template before opening editor**

The create functions (`createCustomTemplateFromParent`, `createBlankCustomTemplate`) return the template object to the client, but the editor dialog loads from User Properties by ID. We need to save immediately.

In `addon/CustomTemplate.gs`, update `createCustomTemplateFromParent` — replace the return at the end:

```javascript
  // Save immediately so editor can load by ID
  var saveResult = saveCustomTemplate(tpl);
  if (!saveResult.ok) return saveResult;
  return { ok: true, template: tpl };
```

Similarly update `createBlankCustomTemplate` — replace the return:

```javascript
  var saveResult = saveCustomTemplate(tpl);
  if (!saveResult.ok) return saveResult;
  return { ok: true, template: tpl };
```

Note: `saveCustomTemplate` requires label to be non-empty for the final save, but we're saving a draft here. Update `saveCustomTemplate` to skip validation for drafts — actually, the validation is in `saveCustomTemplateFromClient`, not in `saveCustomTemplate`. So this already works.

- [ ] **Step 3: Test full create-from-template flow**

Push with `clasp push`. In test doc:
1. Open Template Gallery → click "+ Create from Template"
2. Select "Galician Greek Catholic" → "Create & Edit"
3. Editor should open with sections pre-filled from the Galician prompt
4. Enter a name and description, click Save
5. Gallery should reopen with the new custom template in "My Templates"

- [ ] **Step 4: Test create-blank flow**

1. Open Template Gallery → click "+ Create Blank"
2. Editor should open with empty name/description, scaffold in Output Format and Instructions
3. Fill in name and description, click Save
4. Gallery should show the new blank template

- [ ] **Step 5: Test edit, reset, and delete flows**

1. Click "Edit" on a custom template → editor opens with current values
2. Switch tabs — sections show correct content
3. If template has parent: click "Reset to inherited" → section resets to OOB content
4. Save → gallery refreshes
5. Click "Delete" on a custom template → confirm → template removed

- [ ] **Step 6: Test export and duplicate flows**

1. Click "Export to Doc" on a custom template → confirm → success message
2. In a different browser profile (or incognito with same doc access): open gallery → exported template appears with "Shared" badge, can be selected but not edited
3. Click "Duplicate" → creates a copy in "My Templates"

- [ ] **Step 7: Commit**

```bash
git add addon/CustomTemplate.gs
git commit -m "feat: add custom template editor dialog and complete CRUD flows"
```

---

### Task 7: Integration Verification & Version Bump

**Files:**
- Modify: `addon/Code.gs:2516` (sidebar footer version)

- [ ] **Step 1: Verify transcription pipeline works with custom template**

1. Create a custom template (clone from Galician GC)
2. Apply it to a test document
3. Select an image → Transcribe Image
4. Verify the transcription uses the custom template's prompt (check output format matches)

- [ ] **Step 2: Verify fallback behavior**

1. Apply a custom template to a document
2. Delete that custom template
3. Open sidebar — should fall back to Galician GC without errors
4. Transcribe an image — should use Galician GC prompt

- [ ] **Step 3: Verify collaborator scenario**

1. Export a custom template to a document
2. Open the document as a different user (if possible) or verify `EXPORTED_CUSTOM_TEMPLATES` is in Document Properties
3. The exported template should be selectable and usable

- [ ] **Step 4: Verify 5-template limit**

1. Create 5 custom templates
2. Attempt to create a 6th → should show limit error
3. Delete one → create succeeds

- [ ] **Step 5: Update sidebar footer version**

In `addon/Code.gs`, line 2516, update:

```javascript
    '<div class="footer">v1.4.0</div>',
```

- [ ] **Step 6: Commit**

```bash
git add addon/Code.gs
git commit -m "chore: bump sidebar footer version to v1.4.0"
```

---

### Task 8: Final Cleanup & CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Update CHANGELOG.md**

Add a new version section at the top (after the header, before the previous version):

```markdown
## [1.4.0] - YYYY-MM-DD

### Added
- Custom templates: create, edit, duplicate, and delete personal transcription templates
- Clone from official templates or create blank with starter scaffold
- Per-section "Reset to inherited" for templates based on official ones
- Export custom templates to document for collaborator access
- "My Templates" section in Template Gallery with Custom/Shared badges
- Dedicated template editor dialog with tabbed section editing
- Full EN/UK/RU localization for all custom template UI
```

Replace `YYYY-MM-DD` with the actual release date.

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: add v1.4.0 changelog entry for custom templates"
```

- [ ] **Step 3: Verify everything works end-to-end**

Full manual smoke test:
1. Open fresh test document
2. Open Template Gallery — 3 OOB templates, empty My Templates
3. Create from Template → edit → save → appears in gallery
4. Create Blank → fill in → save → appears in gallery
5. Select custom template → Apply → sidebar shows custom template name
6. Transcribe an image → output follows custom template format
7. Edit a custom template → modify a section → save
8. Duplicate a custom template → works
9. Export to Doc → success message
10. Delete a custom template → removed from gallery
11. Switch UI language (UK, RU) → all new strings display correctly
12. Close and reopen document → selected template persists

- [ ] **Step 4: Ask user about release tag**

Do not create a Git tag or GitHub release without explicit user confirmation. Ask: "Custom templates feature is complete. Should I create a v1.4.0 tag and GitHub release?"
