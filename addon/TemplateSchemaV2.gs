/**
 * Template Schema v2 — composable 3-tier hierarchy.
 *
 * Each template is a JSON config with 7 layers (role, context, inputSchema,
 * outputSchema, translation, examples, instructions). Templates inherit from
 * a parent via the `parent` field. Inheritance is resolved at runtime by
 * resolveTemplate(); stored templates contain only their own additions/overrides.
 *
 * Three tiers:
 *   1. Base: base_transcription
 *   2. Extensions: metric_book, census_revision, personal_correspondence,
 *                  official_document
 *   3. Variants (user-facing): galicia_gc_birth, galicia_gc_marriage,
 *      galicia_gc_death, russian_orth_birth, russian_orth_confession,
 *      russian_orth_revision, generic_plain, ...
 */

var SCHEMA_VERSION_V2 = 2;
var DOC_CONTEXT_PROPERTY = 'DOC_CONTEXT';
var DOC_TRANSLATION_ENABLED_PROPERTY = 'DOC_TRANSLATION_ENABLED';

// ---------------------------------------------------------------------------
// Tier 1: Base
// ---------------------------------------------------------------------------

var BASE_TRANSCRIPTION_TEMPLATE = {
  id: 'base_transcription',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: null,
  meta: {
    label: 'Generic — verbatim text',
    description: 'Transcribe any handwritten or printed historical document',
    icon: 'description',
    category: 'generic'
  },
  role: {
    persona: 'historical_document_transcriber',
    expertise: []
  },
  context: {
    fields: [
      {
        key: 'description',
        label: { en: 'Document description', uk: 'Опис документа', ru: 'Описание документа' },
        type: 'text',
        required: true,
        placeholder: { en: 'e.g. Handwritten letter from 1890s' }
      },
      {
        key: 'period',
        label: { en: 'Approximate period', uk: 'Приблизний період', ru: 'Примерный период' },
        type: 'string',
        required: false
      },
      {
        key: 'sourceLanguages',
        label: { en: 'Source languages', uk: 'Мови джерела', ru: 'Языки источника' },
        type: 'tags',
        options: ['latin', 'polish', 'ukrainian', 'russian', 'church_slavonic', 'german', 'yiddish', 'hungarian', 'romanian'],
        required: false
      },
      {
        key: 'notes',
        label: { en: 'Additional notes', uk: 'Додаткові примітки', ru: 'Дополнительные заметки' },
        type: 'text',
        required: false
      }
    ],
    defaults: {}
  },
  inputSchema: {
    type: 'freeform',
    columns: null,
    hints: []
  },
  outputSchema: {
    type: 'object',
    properties: {
      pageDescription: {
        type: 'string',
        description: 'Brief description of what appears on this page'
      },
      transcription: {
        type: 'object',
        properties: {
          original: {
            type: 'string',
            description: 'Faithful transcription in source language(s)'
          },
          notes: {
            type: 'string',
            description: 'Illegibility notes, damage, uncertain readings'
          }
        },
        required: ['original']
      }
    },
    required: ['pageDescription', 'transcription']
  },
  translation: {
    enabled: false,
    mode: 'inline',
    languages: [],
    fields: ['transcription.original']
  },
  examples: [],
  instructions: {
    general: ['preserve_original_spelling', 'mark_illegible_with_brackets', 'preserve_abbreviations'],
    domain: []
  }
};

// ---------------------------------------------------------------------------
// Tier 2: Document Type Extensions
// ---------------------------------------------------------------------------

var METRIC_BOOK_TEMPLATE = {
  id: 'metric_book',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'base_transcription',
  meta: {
    label: 'Metric Book (base)',
    description: 'Church register: births, marriages, deaths',
    icon: 'menu_book',
    category: 'metric_book'
  },
  role: {
    persona: 'archival_paleographer',
    expertise: ['church_registers', 'slavic_onomastics', 'historical_dating']
  },
  context: {
    fields: [
      { key: 'archiveName',      label: { en: 'Archive name', uk: 'Архів', ru: 'Архив' },                          type: 'string' },
      { key: 'archiveReference', label: { en: 'Fond / Opis / Case', uk: 'Фонд / Опис / Справа', ru: 'Фонд / Опись / Дело' }, type: 'string' },
      { key: 'villages',         label: { en: 'Villages / Parishes', uk: 'Села / Парафії', ru: 'Сёла / Приходы' }, type: 'tags', freeInput: true },
      { key: 'commonSurnames',   label: { en: 'Common surnames', uk: 'Поширені прізвища', ru: 'Распространённые фамилии' }, type: 'tags', freeInput: true }
    ],
    defaults: {}
  },
  inputSchema: {
    type: 'tabular',
    columns: [],
    hints: [
      'Records are arranged in rows, one per person or event',
      'Page headers may repeat column names'
    ]
  },
  outputSchema: {
    type: 'object',
    properties: {
      pageHeader: {
        type: 'object',
        properties: {
          year: { type: 'string' },
          pageNumber: { type: 'string' },
          parish: { type: 'string' },
          archiveReference: { type: 'string' }
        }
      },
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            recordNumber: { type: 'integer', description: 'Sequential record number from the source page' },
            date: { type: 'string', description: 'Primary event date (birth, marriage, death) in source format' },
            location: { type: 'string', description: 'Village / settlement name as written' },
            houseNumber: { type: 'string' },
            officiant: { type: 'string', description: 'Priest / clergy who performed the sacrament' },
            names: {
              type: 'array',
              description: 'All persons mentioned in the record',
              items: {
                type: 'object',
                properties: {
                  fullName: { type: 'string' },
                  role: {
                    type: 'string',
                    description: 'Role in the record: child, father, mother, spouse, groom, bride, deceased, godfather, godmother, witness, officiant'
                  },
                  details: { type: 'string', description: 'Additional info: occupation, parents, religion, etc.' }
                },
                required: ['fullName', 'role']
              }
            },
            original: { type: 'string', description: 'Verbatim row text as written in source' },
            notes: { type: 'string', description: 'Marginal notes, damage, or other observations' }
          },
          required: ['recordNumber', 'original']
        }
      }
    },
    required: ['records']
  },
  translation: {
    enabled: true,
    mode: 'inline',
    languages: ['uk', 'en', 'ru'],
    fields: ['records[].original', 'pageHeader']
  },
  examples: [],
  instructions: {
    general: [],
    domain: [
      'extract_one_record_per_row',
      'include_page_header_metadata',
      'preserve_original_column_text'
    ]
  }
};

var CENSUS_REVISION_TEMPLATE = {
  id: 'census_revision',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'base_transcription',
  meta: {
    label: 'Census / Revision List (base)',
    description: 'Confession books, revision lists, household registers',
    icon: 'list_alt',
    category: 'census_revision'
  },
  role: {
    persona: 'archival_paleographer',
    expertise: ['census_records', 'household_structure', 'cyrillic_numerals']
  },
  context: {
    fields: [
      { key: 'archiveName',      label: { en: 'Archive name', uk: 'Архів', ru: 'Архив' },                       type: 'string' },
      { key: 'archiveReference', label: { en: 'Fond / Opis / Case', uk: 'Фонд / Опис / Справа', ru: 'Фонд / Опись / Дело' }, type: 'string' },
      { key: 'revisionNumber',   label: { en: 'Revision number / year', uk: 'Номер ревізії / рік', ru: 'Номер ревизии / год' }, type: 'string' },
      { key: 'district',         label: { en: 'District / county', uk: 'Повіт / округ', ru: 'Уезд / округ' },   type: 'string' },
      { key: 'villages',         label: { en: 'Villages', uk: 'Села', ru: 'Сёла' }, type: 'tags', freeInput: true }
    ],
    defaults: {}
  },
  inputSchema: {
    type: 'tabular',
    columns: [],
    hints: [
      'Records are arranged by household; multiple persons per household',
      'Age columns may pair "age at previous revision" with "age now"'
    ]
  },
  outputSchema: {
    type: 'object',
    properties: {
      pageHeader: {
        type: 'object',
        properties: {
          year: { type: 'string' },
          pageNumber: { type: 'string' },
          settlement: { type: 'string' }
        }
      },
      records: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            recordNumber: { type: 'integer' },
            householdNumber: { type: 'string' },
            location: { type: 'string' },
            names: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  fullName: { type: 'string' },
                  role: { type: 'string', description: 'Role: head, wife, son, daughter, relative, servant' },
                  ageAtPrev: { type: 'string', description: 'Age at previous revision' },
                  ageNow: { type: 'string', description: 'Age at this revision' },
                  details: { type: 'string' }
                },
                required: ['fullName', 'role']
              }
            },
            original: { type: 'string' },
            notes: { type: 'string' }
          },
          required: ['recordNumber', 'original']
        }
      }
    },
    required: ['records']
  },
  translation: {
    enabled: true,
    mode: 'inline',
    languages: ['uk', 'en', 'ru'],
    fields: ['records[].original']
  },
  examples: [],
  instructions: {
    general: [],
    domain: [
      'extract_one_record_per_household',
      'include_page_header_metadata',
      'preserve_original_column_text'
    ]
  }
};

var PERSONAL_CORRESPONDENCE_TEMPLATE = {
  id: 'personal_correspondence',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'base_transcription',
  meta: {
    label: 'Personal Correspondence (base)',
    description: 'Letters, postcards, diary pages',
    icon: 'mail',
    category: 'correspondence'
  },
  role: {
    persona: 'historical_letters_transcriber',
    expertise: ['cursive_handwriting', 'period_orthography']
  },
  context: {
    fields: [
      { key: 'sender',       label: { en: 'Sender (if known)', uk: 'Відправник (якщо відомо)', ru: 'Отправитель (если известно)' }, type: 'string' },
      { key: 'recipient',    label: { en: 'Recipient (if known)', uk: 'Отримувач (якщо відомо)', ru: 'Получатель (если известно)' }, type: 'string' },
      { key: 'relationship', label: { en: 'Relationship between parties', uk: 'Стосунки між сторонами', ru: 'Отношения между сторонами' }, type: 'string' }
    ],
    defaults: {}
  },
  inputSchema: {
    type: 'freeform',
    hints: [
      'Letterhead, salutation, body, closing, postscript, address blocks may all appear'
    ]
  },
  outputSchema: {
    type: 'object',
    properties: {
      pageDescription: { type: 'string' },
      letter: {
        type: 'object',
        properties: {
          sender: { type: 'string' },
          recipient: { type: 'string' },
          date: { type: 'string' },
          location: { type: 'string' },
          topics: { type: 'array', items: { type: 'string' } },
          namedEntities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                kind: { type: 'string', description: 'person, place, organization' }
              }
            }
          }
        }
      },
      transcription: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['original']
      }
    },
    required: ['transcription']
  },
  translation: {
    enabled: true,
    mode: 'inline',
    languages: ['uk', 'en', 'ru'],
    fields: ['transcription.original']
  },
  examples: [],
  instructions: {
    general: [],
    domain: [
      'preserve_paragraph_breaks',
      'extract_named_entities'
    ]
  }
};

var OFFICIAL_DOCUMENT_TEMPLATE = {
  id: 'official_document',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'base_transcription',
  meta: {
    label: 'Official Document (base)',
    description: 'Passports, repression files, court records',
    icon: 'gavel',
    category: 'official_document'
  },
  role: {
    persona: 'official_records_transcriber',
    expertise: ['administrative_documents', 'official_terminology']
  },
  context: {
    fields: [
      { key: 'issuingAuthority', label: { en: 'Issuing authority', uk: 'Орган видачі', ru: 'Орган выдачи' }, type: 'string' },
      { key: 'documentNumber',   label: { en: 'Document number', uk: 'Номер документа', ru: 'Номер документа' }, type: 'string' },
      { key: 'caseReference',    label: { en: 'Case reference', uk: 'Справа / номер справи', ru: 'Дело / номер дела' }, type: 'string' },
      { key: 'subjectPerson',    label: { en: 'Subject person', uk: 'Особа документа', ru: 'Лицо документа' }, type: 'string' }
    ],
    defaults: {}
  },
  inputSchema: {
    type: 'structured_form',
    hints: [
      'Pre-printed form fields with handwritten or typed entries',
      'Stamps, seals, and signatures often present'
    ]
  },
  outputSchema: {
    type: 'object',
    properties: {
      pageDescription: { type: 'string' },
      documentInfo: {
        type: 'object',
        properties: {
          documentType: { type: 'string' },
          issueDate: { type: 'string' },
          issuingAuthority: { type: 'string' },
          documentNumber: { type: 'string' }
        }
      },
      subject: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          birthDate: { type: 'string' },
          birthPlace: { type: 'string' },
          residence: { type: 'string' },
          occupation: { type: 'string' }
        }
      },
      extractedFields: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            value: { type: 'string' }
          }
        }
      },
      transcription: {
        type: 'object',
        properties: {
          original: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['original']
      }
    },
    required: ['transcription']
  },
  translation: {
    enabled: true,
    mode: 'inline',
    languages: ['uk', 'en', 'ru'],
    fields: ['transcription.original']
  },
  examples: [],
  instructions: {
    general: [],
    domain: [
      'extract_form_fields_as_pairs',
      'note_stamps_and_seals'
    ]
  }
};

// ---------------------------------------------------------------------------
// Tier 3: Variants (user-facing templates)
// ---------------------------------------------------------------------------

var GALICIA_GC_BIRTH_TEMPLATE = {
  id: 'galicia_gc_birth',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'metric_book',
  meta: {
    label: 'Galician Greek Catholic — Births',
    description: '19th c. Latin-script birth registers, Austrian Galicia',
    icon: 'child_care',
    category: 'metric_book',
    region: 'galicia_austrian',
    religion: 'greek_catholic',
    recordType: 'birth',
    timePeriod: '1780-1918'
  },
  role: {
    expertise: ['latin_cursive', 'polish_latin_names', 'ukrainian_cyrillic_names']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['latin', 'polish', 'ukrainian']
    }
  },
  inputSchema: {
    columns: [
      { key: 'recordNumber', label: 'Numerus Prolis (N.P.)' },
      { key: 'birthDate',    label: 'Dies, Mensis nati (date of birth)' },
      { key: 'baptismDate',  label: 'Dies, Mensis baptismi (date of baptism)' },
      { key: 'childName',    label: 'Nomen (given name of child)' },
      { key: 'religion',     label: 'Religio: Cathol. / Aut alia' },
      { key: 'sex',          label: 'Sexus: Puer (M) / Puella (F)' },
      { key: 'legitimacy',   label: 'Thori: Legitimi / Illegitimi' },
      { key: 'fatherName',   label: "Parentes / Pater (father's name + occupation)" },
      { key: 'motherName',   label: "Parentes / Mater (mother's name + parents)" },
      { key: 'godparents',   label: 'Patrini (godfather and godmother + status)' },
      { key: 'officiant',    label: 'Baptizans (priest who performed baptism)' },
      { key: 'houseNumber',  label: 'Numerus Domus' }
    ],
    hints: [
      'Common Latin abbreviations: fil. = filius/filia, ux. = uxor, agr./agricolae = farmers, lab./laboriosus = laborer',
      'Parentage formula: "X fil. Y et Z" = X son/daughter of Y and Z',
      'Names may appear in Latin, Polish, or Ukrainian forms (Joannes/Ivan, Nicolaus/Mykola, Eudocia/Yevdokiya)',
      'Surnames follow Polish orthography (w instead of v, cz instead of ch, sz instead of sh)',
      'Religion marks: r.g. or ritus graeci (Greek Catholic), cathol. (Roman Catholic)',
      'Social status: subditi, agricolae, laboriosus, militaris'
    ]
  },
  outputSchema: {
    properties: {
      records: {
        items: {
          properties: {
            birthDate: { type: 'string', description: 'Date of birth, normalized to YYYY-MM-DD if possible; otherwise as written' },
            baptismDate: { type: 'string' },
            sex: { type: 'string', enum: ['M', 'F', 'unknown'] },
            legitimacy: { type: 'string', description: 'leg. (legitimate) or illeg. (illegitimate)' },
            religion: { type: 'string' }
          }
        }
      }
    }
  },
  translation: {
    languages: ['uk', 'en', 'ru', 'latin']
  },
  examples: ['galicia_gc_birth_001', 'galicia_gc_birth_002'],
  instructions: {
    domain: [
      'decode_latin_abbreviations',
      'normalize_polish_diacritics',
      'preserve_latin_in_original_field'
    ]
  }
};

var GALICIA_GC_MARRIAGE_TEMPLATE = {
  id: 'galicia_gc_marriage',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'metric_book',
  meta: {
    label: 'Galician Greek Catholic — Marriages',
    description: '19th c. Latin-script marriage registers, Austrian Galicia',
    icon: 'favorite',
    category: 'metric_book',
    region: 'galicia_austrian',
    religion: 'greek_catholic',
    recordType: 'marriage',
    timePeriod: '1780-1918'
  },
  role: {
    expertise: ['latin_cursive', 'polish_latin_names', 'ukrainian_cyrillic_names']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['latin', 'polish', 'ukrainian']
    }
  },
  inputSchema: {
    columns: [
      { key: 'recordNumber', label: 'Numerus posit. (record number)' },
      { key: 'marriageDate', label: 'Mensis (date of marriage)' },
      { key: 'houseNumber',  label: 'Numerus Domus' },
      { key: 'groom',        label: 'Sponsus: Nomen + Religio + Aetas + Coelebs/Viduus' },
      { key: 'bride',        label: 'Sponsa: Nomen + Religio + Aetas + Coelebs/Vidua' },
      { key: 'witnesses',    label: 'Testes (witnesses): Nomen + Conditio' }
    ],
    hints: [
      'Coelebs = unmarried, Viduus/Vidua = widower/widow',
      'Religio: Cathol. (Catholic), r.g. (Greek rite)',
      'Aetas = age in years'
    ]
  },
  outputSchema: {
    properties: {
      records: {
        items: {
          properties: {
            marriageDate: { type: 'string' },
            groomAge: { type: 'string' },
            brideAge: { type: 'string' },
            groomStatus: { type: 'string', description: 'coelebs / viduus (single / widower)' },
            brideStatus: { type: 'string', description: 'coelebs / vidua (single / widow)' }
          }
        }
      }
    }
  },
  translation: {
    languages: ['uk', 'en', 'ru', 'latin']
  },
  examples: [],
  instructions: {
    domain: [
      'decode_latin_abbreviations',
      'normalize_polish_diacritics',
      'preserve_latin_in_original_field'
    ]
  }
};

var GALICIA_GC_DEATH_TEMPLATE = {
  id: 'galicia_gc_death',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'metric_book',
  meta: {
    label: 'Galician Greek Catholic — Deaths',
    description: '19th c. Latin-script death registers, Austrian Galicia',
    icon: 'description',
    category: 'metric_book',
    region: 'galicia_austrian',
    religion: 'greek_catholic',
    recordType: 'death',
    timePeriod: '1780-1918'
  },
  role: {
    expertise: ['latin_cursive', 'polish_latin_names', 'ukrainian_cyrillic_names']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['latin', 'polish', 'ukrainian']
    }
  },
  inputSchema: {
    columns: [
      { key: 'recordNumber', label: 'Numerus posit. (record number)' },
      { key: 'deathDate',    label: 'Mortis (date of death) — Mensis/Dies' },
      { key: 'burialDate',   label: 'Sepult. (date of burial)' },
      { key: 'houseNumber',  label: 'Numerus Domus' },
      { key: 'deceasedName', label: 'Nomen et cognomen mortui (with spouse / parentage)' },
      { key: 'religion',     label: 'Religio catholica' },
      { key: 'sex',          label: 'Sexus: Masculinus / Femininus' },
      { key: 'age',          label: 'Anno vitae (age)' },
      { key: 'cause',        label: 'Morbus et qualitas mortis (cause of death)' }
    ],
    hints: [
      'Common causes in Latin: febris (fever), phthisis (consumption/TB), variola (smallpox), senectus (old age)'
    ]
  },
  outputSchema: {
    properties: {
      records: {
        items: {
          properties: {
            deathDate: { type: 'string' },
            burialDate: { type: 'string' },
            sex: { type: 'string', enum: ['M', 'F', 'unknown'] },
            age: { type: 'string' },
            cause: { type: 'string' }
          }
        }
      }
    }
  },
  translation: {
    languages: ['uk', 'en', 'ru', 'latin']
  },
  examples: [],
  instructions: {
    domain: [
      'decode_latin_abbreviations',
      'normalize_polish_diacritics',
      'preserve_latin_in_original_field'
    ]
  }
};

var RUSSIAN_ORTH_BIRTH_TEMPLATE = {
  id: 'russian_orth_birth',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'metric_book',
  meta: {
    label: 'Russian Imperial Orthodox — Births',
    description: 'Pre-reform Cyrillic birth registers (Метрическая книга)',
    icon: 'child_care',
    category: 'metric_book',
    region: 'russian_empire',
    religion: 'orthodox',
    recordType: 'birth',
    timePeriod: '1722-1918'
  },
  role: {
    expertise: ['pre_reform_cyrillic', 'church_slavonic', 'russian_patronymics']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['russian', 'church_slavonic']
    }
  },
  inputSchema: {
    columns: [
      { key: 'recordNumber', label: 'Счетъ родившихся (Мужеска / Женска)' },
      { key: 'birthDate',    label: 'Мѣсяцъ и день рожденія' },
      { key: 'baptismDate',  label: 'Мѣсяцъ и день крещенія' },
      { key: 'childName',    label: 'Имена родившихся' },
      { key: 'parents',      label: 'Званіе, имя, отчество и фамилія родителей и какого вѣроисповѣданія' },
      { key: 'godparents',   label: 'Званіе, имя, отчество и фамилія воспріемниковъ' },
      { key: 'officiant',    label: 'Кто совершалъ таинство крещенія' }
    ],
    hints: [
      'Pre-reform letters: Ѣ (yat), І (decimal i), Ѳ (fita), Ѵ (izhitsa), ъ (hard sign at end of words)',
      'Church Slavonic diacritics: titlo (combining marks), stress marks (acute/grave accents)',
      'Patronymics standard: Иванъ Петровичъ. Women: Мария Ивановна',
      'Social estates: крестьянинъ, мещанинъ, дворянинъ, военный поселянинъ, купецъ, священникъ',
      'Common abbreviations: кр. (крестьянинъ), мещ. (мещанинъ), свящ. (священникъ)',
      'Dates are Julian calendar (Old Style) — transcribe as written',
      '"Восприемники" = godparents; "Кто совершалъ таинство" = priest performing the sacrament'
    ]
  },
  outputSchema: {
    properties: {
      records: {
        items: {
          properties: {
            birthDate: { type: 'string' },
            baptismDate: { type: 'string' },
            sex: { type: 'string', enum: ['M', 'F', 'unknown'] }
          }
        }
      }
    }
  },
  translation: {
    languages: ['uk', 'en', 'ru']
  },
  examples: [],
  instructions: {
    domain: [
      'preserve_pre_reform_orthography_in_original',
      'modernize_in_translations_only',
      'decode_cyrillic_numerals'
    ]
  }
};

var RUSSIAN_ORTH_CONFESSION_TEMPLATE = {
  id: 'russian_orth_confession',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'census_revision',
  meta: {
    label: 'Russian Orthodox — Confession Lists',
    description: 'Исповедная роспись — 1737-Synodal 9-column form',
    icon: 'fact_check',
    category: 'census_revision',
    region: 'russian_empire',
    religion: 'orthodox',
    recordType: 'confession',
    timePeriod: '1737-1860'
  },
  role: {
    expertise: ['pre_reform_cyrillic', 'church_slavonic', 'cyrillic_numerals_18c']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['russian', 'church_slavonic']
    }
  },
  inputSchema: {
    columns: [
      { key: 'householdNumber', label: 'Номеръ дома' },
      { key: 'estate',          label: 'Званіе (estate / social class)' },
      { key: 'familyName',      label: 'Имя главы семейства' },
      { key: 'maleAge',         label: 'Лѣта мужеска пола' },
      { key: 'femaleAge',       label: 'Лѣта женска пола' },
      { key: 'confession',      label: 'Кто исповѣдался / не исповѣдался' }
    ],
    hints: [
      'Cyrillic numerals: АІ=11, КА=21, ҂АѰНД=1754',
      '18th-century Church Slavonic with full diacritics, titlo marks',
      'Output: Arabic digits in structured fields; preserve Cyrillic numerals in original field'
    ]
  },
  examples: [],
  instructions: {
    domain: [
      'decode_cyrillic_numerals',
      'preserve_pre_reform_orthography_in_original'
    ]
  }
};

var RUSSIAN_ORTH_REVISION_TEMPLATE = {
  id: 'russian_orth_revision',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'census_revision',
  meta: {
    label: 'Russian Orthodox — Revision Lists',
    description: 'Ревизские сказки (1719–1858, 10 revisions)',
    icon: 'history_edu',
    category: 'census_revision',
    region: 'russian_empire',
    religion: 'orthodox',
    recordType: 'revision',
    timePeriod: '1719-1858'
  },
  role: {
    expertise: ['pre_reform_cyrillic', 'cyrillic_numerals_18c', 'household_structure']
  },
  context: {
    fields: [],
    defaults: {
      sourceLanguages: ['russian', 'church_slavonic']
    }
  },
  inputSchema: {
    columns: [
      { key: 'householdNumber', label: 'Номеръ семейства' },
      { key: 'name',            label: 'Имя, отчество, фамилія' },
      { key: 'ageAtPrevRev',    label: 'Лѣта по прежней ревизіи' },
      { key: 'ageNow',          label: 'Лѣта по нынѣшней ревизіи' },
      { key: 'fate',            label: 'Гдѣ въ настоящее время находится' }
    ],
    hints: [
      'Revisions 1–4 (1719–1782) use Cyrillic alphabetic numerals; 5+ use Arabic digits',
      'Age pairs: "age at previous revision / age now" — transcribe both',
      'Fate column may indicate: умер (died), отдан въ рекруты (drafted), бѣглый (escaped)'
    ]
  },
  examples: [],
  instructions: {
    domain: [
      'decode_cyrillic_numerals',
      'preserve_pre_reform_orthography_in_original',
      'extract_age_pairs'
    ]
  }
};

var GENERIC_PLAIN_TEMPLATE = {
  id: 'generic_plain',
  schemaVersion: SCHEMA_VERSION_V2,
  parent: 'base_transcription',
  meta: {
    label: 'Generic — verbatim text',
    description: 'Letters, typescript, diary pages — any non-tabular text',
    icon: 'description',
    category: 'generic',
    region: 'any',
    timePeriod: 'any'
  },
  role: {
    expertise: ['cursive_handwriting', 'typescript', 'mixed_languages']
  },
  context: {
    fields: [],
    defaults: {}
  },
  translation: {
    enabled: true,
    languages: ['en', 'uk', 'ru']
  },
  examples: [],
  instructions: {
    domain: ['preserve_paragraph_breaks']
  }
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

var TEMPLATES_V2 = {
  // Tier 1
  base_transcription: BASE_TRANSCRIPTION_TEMPLATE,
  // Tier 2
  metric_book: METRIC_BOOK_TEMPLATE,
  census_revision: CENSUS_REVISION_TEMPLATE,
  personal_correspondence: PERSONAL_CORRESPONDENCE_TEMPLATE,
  official_document: OFFICIAL_DOCUMENT_TEMPLATE,
  // Tier 3 — user-facing variants
  galicia_gc_birth: GALICIA_GC_BIRTH_TEMPLATE,
  galicia_gc_marriage: GALICIA_GC_MARRIAGE_TEMPLATE,
  galicia_gc_death: GALICIA_GC_DEATH_TEMPLATE,
  russian_orth_birth: RUSSIAN_ORTH_BIRTH_TEMPLATE,
  russian_orth_confession: RUSSIAN_ORTH_CONFESSION_TEMPLATE,
  russian_orth_revision: RUSSIAN_ORTH_REVISION_TEMPLATE,
  generic_plain: GENERIC_PLAIN_TEMPLATE
};

/** Templates that appear in the user-facing gallery (Tier 3 variants only). */
var USER_FACING_TEMPLATE_IDS = [
  'generic_plain',
  'galicia_gc_birth',
  'galicia_gc_marriage',
  'galicia_gc_death',
  'russian_orth_birth',
  'russian_orth_confession',
  'russian_orth_revision'
];

function getRawTemplateV2(id) {
  return TEMPLATES_V2[id] || null;
}

function getUserFacingTemplatesV2() {
  var list = [];
  for (var i = 0; i < USER_FACING_TEMPLATE_IDS.length; i++) {
    var t = TEMPLATES_V2[USER_FACING_TEMPLATE_IDS[i]];
    if (t) list.push(t);
  }
  return list;
}

// ---------------------------------------------------------------------------
// Inheritance resolver
// ---------------------------------------------------------------------------

/**
 * Walks the parent chain for a template ID and returns the resolved template
 * with all layers merged according to the inheritance rules:
 *   - meta:                  child fully overrides parent
 *   - role.persona:          child overrides parent
 *   - role.expertise:        child appends to parent (union)
 *   - context.fields:        parent fields first, then child fields
 *   - context.defaults:      deep merge (child overrides matching keys)
 *   - inputSchema:           child overrides type; columns replace; hints append
 *   - outputSchema:          deep merge of properties
 *   - translation:           shallow merge (child overrides matching keys)
 *   - examples:              child replaces parent (not appended)
 *   - instructions.general:  parent first, child appends
 *   - instructions.domain:   parent first, child appends
 *
 * If the template (or any parent) is missing, returns null.
 * Also accepts a custom template object (with parent: 'base_transcription' etc).
 */
function resolveTemplateV2(templateIdOrObject) {
  var chain = buildInheritanceChain_(templateIdOrObject);
  if (!chain || chain.length === 0) return null;
  var resolved = cloneDeep_(chain[0]);
  for (var i = 1; i < chain.length; i++) {
    resolved = mergeTemplateLayer_(resolved, chain[i]);
  }
  // The resolved template uses the leaf's identity.
  var leaf = chain[chain.length - 1];
  resolved.id = leaf.id;
  resolved.schemaVersion = SCHEMA_VERSION_V2;
  resolved.parent = leaf.parent || null;
  return resolved;
}

function buildInheritanceChain_(templateIdOrObject) {
  var template = (typeof templateIdOrObject === 'string')
    ? getRawTemplateV2(templateIdOrObject)
    : templateIdOrObject;
  if (!template) return null;
  var chain = [template];
  var visited = {};
  visited[template.id || ''] = true;
  var current = template;
  while (current && current.parent) {
    if (visited[current.parent]) {
      Logger.log('buildInheritanceChain_: cycle detected at ' + current.parent);
      break;
    }
    visited[current.parent] = true;
    var parent = getRawTemplateV2(current.parent);
    if (!parent) {
      Logger.log('buildInheritanceChain_: missing parent ' + current.parent);
      break;
    }
    chain.unshift(parent);
    current = parent;
  }
  return chain;
}

function mergeTemplateLayer_(base, override) {
  var result = cloneDeep_(base);

  if (override.meta) {
    result.meta = result.meta || {};
    for (var mk in override.meta) {
      if (Object.prototype.hasOwnProperty.call(override.meta, mk)) {
        result.meta[mk] = override.meta[mk];
      }
    }
  }

  if (override.role) {
    result.role = result.role || { persona: '', expertise: [] };
    if (override.role.persona) result.role.persona = override.role.persona;
    if (override.role.expertise && override.role.expertise.length) {
      var existingExpertise = result.role.expertise || [];
      var seenExp = {};
      for (var ei = 0; ei < existingExpertise.length; ei++) seenExp[existingExpertise[ei]] = true;
      for (var ej = 0; ej < override.role.expertise.length; ej++) {
        var e = override.role.expertise[ej];
        if (!seenExp[e]) { existingExpertise.push(e); seenExp[e] = true; }
      }
      result.role.expertise = existingExpertise;
    }
  }

  if (override.context) {
    result.context = result.context || { fields: [], defaults: {} };
    if (override.context.fields && override.context.fields.length) {
      var existingFields = result.context.fields || [];
      var seenKeys = {};
      for (var fi = 0; fi < existingFields.length; fi++) seenKeys[existingFields[fi].key] = true;
      for (var fj = 0; fj < override.context.fields.length; fj++) {
        var f = override.context.fields[fj];
        if (!seenKeys[f.key]) { existingFields.push(cloneDeep_(f)); seenKeys[f.key] = true; }
      }
      result.context.fields = existingFields;
    }
    if (override.context.defaults) {
      result.context.defaults = result.context.defaults || {};
      for (var dk in override.context.defaults) {
        if (Object.prototype.hasOwnProperty.call(override.context.defaults, dk)) {
          result.context.defaults[dk] = cloneDeep_(override.context.defaults[dk]);
        }
      }
    }
  }

  if (override.inputSchema) {
    result.inputSchema = result.inputSchema || { type: 'freeform', columns: null, hints: [] };
    if (override.inputSchema.type) result.inputSchema.type = override.inputSchema.type;
    if (override.inputSchema.columns) {
      result.inputSchema.columns = cloneDeep_(override.inputSchema.columns);
    }
    if (override.inputSchema.hints && override.inputSchema.hints.length) {
      var existingHints = result.inputSchema.hints || [];
      for (var hi = 0; hi < override.inputSchema.hints.length; hi++) {
        existingHints.push(override.inputSchema.hints[hi]);
      }
      result.inputSchema.hints = existingHints;
    }
  }

  if (override.outputSchema) {
    result.outputSchema = mergeJsonSchema_(result.outputSchema || {}, override.outputSchema);
  }

  if (override.translation) {
    result.translation = result.translation || {};
    for (var tk in override.translation) {
      if (Object.prototype.hasOwnProperty.call(override.translation, tk)) {
        result.translation[tk] = cloneDeep_(override.translation[tk]);
      }
    }
  }

  if (override.examples && override.examples.length) {
    result.examples = override.examples.slice();
  }

  if (override.instructions) {
    result.instructions = result.instructions || { general: [], domain: [] };
    if (override.instructions.general && override.instructions.general.length) {
      result.instructions.general = (result.instructions.general || []).concat(override.instructions.general);
    }
    if (override.instructions.domain && override.instructions.domain.length) {
      result.instructions.domain = (result.instructions.domain || []).concat(override.instructions.domain);
    }
  }

  return result;
}

/**
 * Deep-merges two JSON Schema fragments. Used for outputSchema inheritance.
 * Properties merge recursively; arrays do not concat (override wins).
 */
function mergeJsonSchema_(base, override) {
  if (!base) return cloneDeep_(override);
  if (!override) return cloneDeep_(base);
  var result = cloneDeep_(base);
  for (var k in override) {
    if (!Object.prototype.hasOwnProperty.call(override, k)) continue;
    var v = override[k];
    if (k === 'properties' && result.properties && typeof v === 'object') {
      for (var pk in v) {
        if (!Object.prototype.hasOwnProperty.call(v, pk)) continue;
        result.properties[pk] = mergeJsonSchema_(result.properties[pk], v[pk]);
      }
    } else if (k === 'items' && result.items && typeof v === 'object' && !Array.isArray(v)) {
      result.items = mergeJsonSchema_(result.items, v);
    } else if (k === 'required' && Array.isArray(v) && Array.isArray(result.required)) {
      var seenReq = {};
      for (var ri = 0; ri < result.required.length; ri++) seenReq[result.required[ri]] = true;
      for (var rj = 0; rj < v.length; rj++) if (!seenReq[v[rj]]) { result.required.push(v[rj]); seenReq[v[rj]] = true; }
    } else {
      result[k] = cloneDeep_(v);
    }
  }
  return result;
}

function cloneDeep_(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    var arr = [];
    for (var i = 0; i < obj.length; i++) arr.push(cloneDeep_(obj[i]));
    return arr;
  }
  var out = {};
  for (var k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = cloneDeep_(obj[k]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public helpers (called by PromptCompiler, UI, migration)
// ---------------------------------------------------------------------------

/**
 * Returns the merged context-field list for a template (parent fields first,
 * then child additions). Useful for rendering the wizard's Context step.
 */
function getResolvedContextFields(templateId) {
  var resolved = resolveTemplateV2(templateId);
  if (!resolved || !resolved.context) return [];
  return resolved.context.fields || [];
}

/**
 * Returns the merged context defaults for a template — values pre-filled into
 * the wizard when the template is first selected.
 */
function getResolvedContextDefaults(templateId) {
  var resolved = resolveTemplateV2(templateId);
  if (!resolved || !resolved.context) return {};
  return resolved.context.defaults || {};
}

/**
 * Returns the resolved JSON Schema sent to Gemini's responseSchema field.
 * If translation is disabled (via doc property), strips translation properties.
 */
function getResolvedOutputSchema(templateId, opts) {
  var resolved = resolveTemplateV2(templateId);
  if (!resolved || !resolved.outputSchema) return null;
  var schema = cloneDeep_(resolved.outputSchema);
  var translationEnabled = opts && opts.translationEnabled;
  var translationLanguages = (opts && opts.translationLanguages) || (resolved.translation && resolved.translation.languages) || [];
  if (translationEnabled && translationLanguages.length > 0) {
    schema = injectTranslationIntoSchema_(schema, translationLanguages);
  }
  return schema;
}

function injectTranslationIntoSchema_(schema, languages) {
  if (!schema || typeof schema !== 'object') return schema;
  var translationProps = {};
  for (var i = 0; i < languages.length; i++) {
    translationProps[languages[i]] = { type: 'string' };
  }
  var translationSchema = {
    type: 'object',
    description: 'Modern-language summaries / translations',
    properties: translationProps
  };

  if (schema.properties) {
    if (schema.properties.records && schema.properties.records.type === 'array' && schema.properties.records.items) {
      // Tabular templates (metric_book / census_revision): per-record translation.
      schema.properties.records.items.properties = schema.properties.records.items.properties || {};
      schema.properties.records.items.properties.translation = translationSchema;
    } else {
      // Flat templates (base / personal_correspondence / official_document):
      // single top-level translation block.
      schema.properties.translation = translationSchema;
      // Ensure the model is asked to produce it.
      if (!Array.isArray(schema.required)) schema.required = [];
      if (schema.required.indexOf('translation') < 0) schema.required.push('translation');
    }
  }
  return schema;
}

/**
 * Returns the resolved translation config (deep-merged across the chain).
 * @param translationToggleEnabled — overrides translation.enabled when set.
 */
function getResolvedTranslationConfig(templateId, translationToggleEnabled) {
  var resolved = resolveTemplateV2(templateId);
  var cfg = (resolved && resolved.translation) ? cloneDeep_(resolved.translation) : { enabled: false, mode: 'inline', languages: [], fields: [] };
  if (typeof translationToggleEnabled === 'boolean') {
    cfg.enabled = translationToggleEnabled;
  }
  return cfg;
}

/**
 * Translates a context-field label into the active UI locale. Returns the
 * field key as a fallback if no localized label is present.
 */
function getLocalizedContextLabel(field, locale) {
  if (!field) return '';
  if (field.label && typeof field.label === 'object') {
    if (locale && field.label[locale]) return field.label[locale];
    if (field.label.en) return field.label.en;
  }
  if (typeof field.label === 'string') return field.label;
  return field.key;
}
