const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadBackend() {
  const context = {
    SpreadsheetApp: { openById() { return {}; } },
    CacheService: { getScriptCache() { return { get() { return null; }, put() {}, remove() {} }; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
  return context;
}

function loadBackendWithSheets() {
  class Range {
    constructor(sheet, row, column, rowCount, columnCount) { Object.assign(this, { sheet, row, column, rowCount, columnCount }); }
    read() {
      return Array.from({ length: this.rowCount }, (_, r) => Array.from({ length: this.columnCount }, (_, c) => this.sheet.rows[this.row - 1 + r]?.[this.column - 1 + c] ?? ''));
    }
    getValues() { return this.read(); }
    getValue() { return this.read()[0]?.[0] ?? ''; }
    getDisplayValues() { return this.read().map(row => row.map(value => String(value ?? ''))); }
    setValues(values) {
      values.forEach((source, r) => {
        const targetRow = this.row - 1 + r;
        while (this.sheet.rows.length <= targetRow) this.sheet.rows.push([]);
        source.forEach((value, c) => { this.sheet.rows[targetRow][this.column - 1 + c] = value; });
      });
      return this;
    }
    setNumberFormats() { return this; }
    setFontWeight() { return this; }
    setBackground() { return this; }
    setFontColor() { return this; }
  }
  class Sheet {
    constructor(name, rows = []) { this.name = name; this.rows = rows.map(row => [...row]); }
    getName() { return this.name; }
    getLastRow() { return this.rows.length; }
    getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
    getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
    getRange(row, column, rowCount = 1, columnCount = 1) { return new Range(this, row, column, rowCount, columnCount); }
    setFrozenRows() {}
  }
  class Spreadsheet {
    constructor() { this.sheets = new Map([['Students', new Sheet('Students', [['StipNo', 'Status'], ['MBS_001', 'Active']])]]); }
    getSheetByName(name) { return this.sheets.get(name) || null; }
    insertSheet(name) { const sheet = new Sheet(name); this.sheets.set(name, sheet); return sheet; }
  }
  const spreadsheet = new Spreadsheet();
  const cache = new Map();
  const scriptProperties = new Map([['EMPLOYMENT_LAUNCH_MODE', 'enabled']]);
  let uuidCounter = 0;
  const context = {
    SpreadsheetApp: { openById() { return spreadsheet; }, flush() {} },
    CacheService: { getScriptCache() { return { get(key) { return cache.get(key) || null; }, put(key, value) { cache.set(key, value); }, remove(key) { cache.delete(key); } }; } },
    LockService: { getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } },
    PropertiesService: { getScriptProperties() { return {
      getProperty(key) { return scriptProperties.get(key) || null; },
      setProperty(key, value) { scriptProperties.set(key, String(value)); return this; },
      deleteProperty(key) { scriptProperties.delete(key); return this; },
    }; } },
    Utilities: {
      getUuid() { uuidCounter += 1; return `${String(uuidCounter).padStart(8, '0')}-0000-0000-0000-000000000000`; },
      formatDate(value, timeZone, pattern) {
        assert.equal(pattern, 'yyyy-MM-dd');
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
          timeZone, year:'numeric', month:'2-digit', day:'2-digit'
        }).formatToParts(new Date(value)).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
        return `${parts.year}-${parts.month}-${parts.day}`;
      },
    },
    Session: { getScriptTimeZone() { return 'Asia/Bangkok'; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(root, 'databasesetup.gs'), 'utf8'), context);
  return { context, spreadsheet };
}

test('dynamic visibility rules support every declared operator and AND/OR logic', () => {
  const c = loadBackend();
  const core = { Status: 'Active', Institution: 'MBS', Blank: '' };
  const custom = { fld_tags: 'science,art', fld_level: 'advanced' };
  const cases = [
    ['equals', 'Status', 'Active', true],
    ['not_equals', 'Status', 'Graduated', true],
    ['contains', 'Institution', 'mb', true],
    ['in', 'Status', ['Active', 'Suspended'], true],
    ['not_in', 'Status', 'Graduated,Resigned', true],
    ['is_empty', 'Blank', '', true],
    ['is_not_empty', 'Status', '', true],
  ];
  for (const [operator, field, value, expected] of cases) {
    assert.equal(c._dfEvaluateRules({ logic: 'AND', conditions: [{ source: 'core', field, operator, value }] }, core, custom), expected, operator);
  }
  assert.equal(c._dfEvaluateRules({ logic: 'OR', conditions: [
    { source: 'core', field: 'Status', operator: 'equals', value: 'Graduated' },
    { source: 'custom', field: 'fld_level', operator: 'equals', value: 'advanced' },
  ] }, core, custom), true);
  assert.equal(c._dfEvaluateRules({ logic: 'AND', conditions: [
    { source: 'core', field: 'Status', operator: 'in', value: ['graduated', 'ACTIVE'] },
  ] }, core, custom), true, 'structured comparisons should ignore letter case');
});

test('server validation rejects invalid types, unsafe patterns, and unknown options', () => {
  const c = loadBackend();
  assert.equal(c._dfValidateValue({ FieldType: 'email', Required: 'true' }, 'invalid', []), 'EMAIL');
  assert.equal(c._dfValidateValue({ FieldType: 'number', MinValue: '2', MaxValue: '5' }, '1', []), 'MIN_VALUE');
  assert.equal(c._dfValidateValue({ FieldType: 'select' }, 'x', ['a', 'b']), 'OPTION');
  assert.equal(c._dfValidateValue({ FieldType: 'select' }, 'a', ['a', 'b']), '');
  assert.equal(c._dfSafePattern('(a+)+'), false);
  assert.equal(c._dfSafePattern('^[A-Z]{2}\\d{3}$'), true);
  assert.equal(c._dfSanitizeValue('=IMPORTXML("x")', 'text').startsWith("'="), true);
});

test('student self-update is limited to the server-configured allowlist', () => {
  const c = loadBackend();
  c.getSystemSettings = () => ({ status: 'success', data: { STUDENT_EDITABLE_FIELDS: ['f_phone1', 'f_email'] } });
  const own = c._prepareStudentUpdate(
    { username: 'MBS_001', role: 'Student' },
    { StipNo: 'MBS_001', Phone1: '0800000000', Email: 'student@example.com', Status: 'Graduated', SavedBy: 'attacker' }
  );
  assert.equal(own.StipNo, 'MBS_001');
  assert.equal(own.Phone1, '0800000000');
  assert.equal(own.Email, 'student@example.com');
  assert.equal(Object.hasOwn(own, 'Status'), false);
  assert.equal(own.SavedBy, 'MBS_001');
  assert.equal(c._prepareStudentUpdate({ username: 'MBS_001', role: 'Student' }, { StipNo: 'MBS_002', Phone1: 'x' }), null);
});

test('dynamic schema setup remains additive and defines stable value records', () => {
  const source = fs.readFileSync(path.join(root, 'databasesetup.gs'), 'utf8');
  const backend = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
  assert.match(source, /CustomFieldDefinitions/);
  assert.match(source, /CustomFieldAuditLog/);
  assert.match(backend, /EmploymentFollowUps/);
  assert.match(backend, /EmploymentMigrationLog/);
  assert.match(source, /'RecordID'/);
  assert.match(source, /'CalculationType'/);
  assert.match(source, /'CalculationConfig'/);
  assert.match(source, /'Active','CreatedAt'/);
  const dynamicBlock = source.slice(source.indexOf('Dynamic Custom Fields'));
  assert.doesNotMatch(dynamicBlock, /clear\s*\(/);
  assert.doesNotMatch(dynamicBlock, /deleteSheet|deleteColumn|deleteRow/);
});

test('pending calculation headers do not hide existing custom fields', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  const definitionSheet = spreadsheet.getSheetByName('CustomFieldDefinitions');
  const indexes = ['CalculationType', 'CalculationConfig']
    .map(header => definitionSheet.rows[0].indexOf(header)).sort((a, b) => b - a);
  definitionSheet.rows.forEach(row => indexes.forEach(index => row.splice(index, 1)));
  assert.equal(c.previewDynamicFieldSetup().ready, false);
  assert.equal(c._dfSetupReady(), true);
});

test('dynamic field writes are rate limited per authenticated account', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin@example.com', role: 'SuperAdmin' };
  for (let index = 0; index < 40; index += 1) {
    assert.equal(c._dfMutationRateLimited(admin, 'admin', 40), false);
  }
  assert.equal(c._dfMutationRateLimited(admin, 'admin', 40), true);
  assert.equal(c._dfMutationRateLimited({ username: 'other@example.com', role: 'SuperAdmin' }, 'admin', 40), false);
});

test('section, field, value, role filtering, and archive work end to end', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  const student = { username: 'MBS_001', role: 'Student' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  const section = c.saveDynamicSection(admin, {
    sectionKey: 'student_interests', nameTH: 'ความสนใจ', nameEN: 'Interests', cardinality: 'single',
    visibleRoles: ['SuperAdmin', 'Student'], visibilityRules: { logic: 'AND', conditions: [{ source: 'core', field: 'Status', operator: 'equals', value: 'Active' }] },
  });
  assert.equal(section.status, 'success');
  const field = c.saveDynamicField(admin, {
    fieldKey: 'favorite_subject', labelTH: 'วิชาที่ชอบ', labelEN: 'Favorite subject', sectionId: section.sectionId,
    fieldType: 'select', visibleRoles: ['SuperAdmin', 'Student'], editableRoles: ['SuperAdmin', 'Student'],
    required: true, visibilityRules: { logic: 'AND', conditions: [] },
  }, [
    { value: 'science', labelTH: 'วิทยาศาสตร์', labelEN: 'Science' },
    { value: 'art', labelTH: 'ศิลปะ', labelEN: 'Art' },
  ]);
  assert.equal(field.status, 'success');
  const ownSchema = c.getDynamicFormSchema(student, 'student', 'MBS_001');
  assert.equal(ownSchema.status, 'success');
  assert.equal(ownSchema.fields.length, 1);
  assert.equal(ownSchema.fields[0].canEdit, true);
  const adminData = c.getDynamicFieldAdminData(admin, 'student');
  assert.equal(adminData.status, 'success');
  assert.equal(adminData.conditionCatalog.core.Status.includes('Active'), true);
  assert.equal(adminData.conditionCatalog.core.Institution.includes('MBS'), true);
  assert.equal(adminData.conditionCatalog.custom[field.fieldId].includes('science'), true);
  assert.equal(c.getDynamicFormSchema({ username: 'MBS_002', role: 'Student' }, 'student', 'MBS_001').code, 'ACCESS_DENIED');
  assert.equal(c.saveStudentDynamicValues(student, 'student', 'MBS_001', [{ fieldId: field.fieldId, recordId: 'single', value: 'unknown' }], []).validation, 'OPTION');
  const saved = c.saveStudentDynamicValues(student, 'student', 'MBS_001', [{ fieldId: field.fieldId, recordId: 'single', value: 'science' }], []);
  assert.equal(saved.status, 'success', JSON.stringify(saved));
  assert.equal(c.getDynamicFormSchema(student, 'student', 'MBS_001').values[0].value, 'science');
  const archived = c.archiveDynamicField(admin, field.fieldId);
  assert.equal(archived.preservedValues, 1);
  assert.equal(c.getDynamicFormSchema(student, 'student', 'MBS_001').fields.length, 0);
});

test('server generates unique stable keys and prevents section key changes', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);

  const section = c.saveDynamicSection(admin, {
    nameTH: 'ประวัติการทำงาน', nameEN: 'Employment History', cardinality: 'repeatable',
    visibilityRules: { logic: 'AND', conditions: [] },
  });
  assert.equal(section.status, 'success');
  assert.match(section.sectionKey, /^section_[a-f0-9]{12}$/);

  const field = c.saveDynamicField(admin, {
    sectionId: section.sectionId, fieldType: 'text', labelTH: 'สถานที่ทำงาน', labelEN: 'Employer',
    visibilityRules: { logic: 'AND', conditions: [] },
  }, []);
  assert.equal(field.status, 'success');
  assert.match(field.fieldKey, /^field_[a-f0-9]{12}$/);

  const changed = c.saveDynamicSection(admin, {
    sectionId: section.sectionId, sectionKey: 'changed_key', nameTH: 'ประวัติการทำงาน',
    nameEN: 'Employment History', cardinality: 'repeatable', visibilityRules: { logic: 'AND', conditions: [] },
  });
  assert.equal(changed.code, 'IMMUTABLE_KEY');
});

test('month fields and calculated employment duration are configured safely', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);

  const section = c.saveDynamicSection(admin, {
    nameTH: 'ประวัติการทำงาน', nameEN: 'Employment History', cardinality: 'repeatable',
    visibilityRules: { logic: 'AND', conditions: [] },
  });
  const start = c.saveDynamicField(admin, {
    sectionId: section.sectionId, fieldType: 'month', labelTH: 'เดือนเริ่มต้น', labelEN: 'Start month',
    visibilityRules: { logic: 'AND', conditions: [] },
  }, []);
  const end = c.saveDynamicField(admin, {
    sectionId: section.sectionId, fieldType: 'month', labelTH: 'เดือนสิ้นสุด', labelEN: 'End month',
    visibilityRules: { logic: 'AND', conditions: [] },
  }, []);
  assert.equal(start.status, 'success');
  assert.equal(end.status, 'success');
  assert.equal(c._dfValidateValue({ FieldType: 'month' }, '2026-09', []), '');
  assert.equal(c._dfValidateValue({ FieldType: 'month' }, '2026-13', []), 'MONTH');

  const invalid = c.saveDynamicField(admin, {
    sectionId: section.sectionId, fieldType: 'calculated_duration', labelTH: 'ระยะเวลา', labelEN: 'Duration',
    calculationConfig: { startFieldId: start.fieldId, endFieldId: start.fieldId },
    visibilityRules: { logic: 'AND', conditions: [] },
  }, []);
  assert.equal(invalid.code, 'INVALID_CALCULATION_CONFIG');

  const duration = c.saveDynamicField(admin, {
    sectionId: section.sectionId, fieldType: 'calculated_duration', labelTH: 'ระยะเวลา', labelEN: 'Duration',
    calculationConfig: { startFieldId: start.fieldId, endFieldId: end.fieldId, useCurrentMonth: true },
    editable: true, required: true, unique: true,
    visibilityRules: { logic: 'AND', conditions: [] },
  }, []);
  assert.equal(duration.status, 'success');
  const schema = c.getDynamicFormSchema(admin, 'student', 'MBS_001');
  const calculated = schema.fields.find(field => field.fieldId === duration.fieldId);
  assert.equal(calculated.fieldType, 'calculated_duration');
  assert.equal(calculated.canEdit, false);
  assert.equal(calculated.editable, false);
  assert.equal(calculated.required, false);
  assert.equal(calculated.calculationType, 'month_range_duration');
  assert.equal(calculated.calculationConfig.startFieldId, start.fieldId);
  assert.equal(calculated.calculationConfig.endFieldId, end.fieldId);

  const rejected = c.saveStudentDynamicValues(admin, 'student', 'MBS_001', [
    { fieldId: duration.fieldId, recordId: 'rec_work_1', value: '12' },
  ], []);
  assert.equal(rejected.code, 'FIELD_ACCESS_DENIED');
});

test('employment schema installer is additive, stable, and idempotent', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  const originalStudentHeaders = [...spreadsheet.getSheetByName('Students').rows[0]];
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(spreadsheet.getSheetByName('EmploymentFollowUps'), null,
    'base dynamic-field setup must remain independent from employment operations');
  assert.equal(spreadsheet.getSheetByName('EmploymentMigrationLog'), null,
    'base dynamic-field setup must remain independent from employment migration');

  const preview = c.previewEmploymentHistorySetup(admin);
  assert.equal(preview.status, 'success');
  assert.equal(preview.ready, false);
  assert.equal(preview.safeToInstall, true);

  const installed = c.setupEmploymentHistorySchema(admin);
  assert.equal(installed.status, 'success', JSON.stringify(installed));
  assert.equal(installed.ready, true);
  assert.equal(installed.changed.length, 16);
  assert.deepEqual(spreadsheet.getSheetByName('Students').rows[0], originalStudentHeaders);
  assert.ok(spreadsheet.getSheetByName('EmploymentFollowUps'));
  assert.ok(spreadsheet.getSheetByName('EmploymentMigrationLog'));

  const sections = spreadsheet.getSheetByName('FormSections').rows;
  const sectionKeyIndex = sections[0].indexOf('SectionKey');
  assert.equal(sections.filter(row => row[sectionKeyIndex] === 'alumni_employment_summary').length, 1);
  assert.equal(sections.filter(row => row[sectionKeyIndex] === 'alumni_employment_history').length, 1);

  const repeated = c.setupEmploymentHistorySchema(admin);
  assert.equal(repeated.status, 'success');
  assert.equal(repeated.alreadyReady, true);
  assert.equal(repeated.changed.length, 0);
});

test('employment audit mode is enforced by the server while previews remain readable', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);
  c.PropertiesService.getScriptProperties().deleteProperty('EMPLOYMENT_LAUNCH_MODE');

  assert.equal(c.previewEmploymentHistorySetup(admin).launchMode, 'audit');
  assert.equal(c.previewLegacyEmploymentMigration(admin).launchMode, 'audit');
  assert.equal(c.getEmploymentReport(admin, {}).launchMode, 'audit');
  assert.equal(c.getEmploymentReport(admin, {}).canManageFollowUps, false);
  assert.equal(c.setupEmploymentHistorySchema(admin).code, 'EMPLOYMENT_AUDIT_MODE');
  assert.equal(c.saveEmploymentFollowUp(admin, {}).code, 'EMPLOYMENT_AUDIT_MODE');
  assert.equal(c.archiveEmploymentFollowUp(admin, 'fup_test').code, 'EMPLOYMENT_AUDIT_MODE');
  assert.equal(c.migrateLegacyEmploymentData(admin, ['legacy']).code, 'EMPLOYMENT_AUDIT_MODE');
});

test('employment preview detects a changed duration formula before reporting', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);

  const definitions = spreadsheet.getSheetByName('CustomFieldDefinitions').rows;
  const fieldKeyIndex = definitions[0].indexOf('FieldKey');
  const calculationIndex = definitions[0].indexOf('CalculationConfig');
  const durationRow = definitions.find(row => row[fieldKeyIndex] === 'employment_duration');
  durationRow[calculationIndex] = JSON.stringify({ startFieldId: 'wrong', endFieldId: 'wrong', useCurrentMonth: true });
  c._dfInvalidateSchemaCache();

  const preview = c.previewEmploymentHistorySetup(admin);
  assert.equal(preview.ready, false);
  assert.equal(preview.safeToInstall, false);
  assert.ok(preview.conflicts.some(conflict => conflict.key === 'employment_duration' && conflict.reason === 'CALCULATION_CONFIG'));
  assert.equal(c.getEmploymentReport(admin, {}).setupRequired, true);
});

test('employment setup stops when legacy work data or a similar custom section exists', () => {
  const first = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(first.context.setupDynamicFieldSheets().ready, true);
  const alumni = first.spreadsheet.insertSheet('Alumni');
  alumni.rows = [
    ['StipNo', 'Occupation', 'Workplace'],
    ['MBS_001', 'Teacher', 'RDF School'],
  ];
  const legacyPreview = first.context.previewEmploymentHistorySetup(admin);
  assert.equal(legacyPreview.legacy.rowsWithEmployment, 1);
  assert.equal(legacyPreview.safeToInstall, false);
  assert.equal(first.context.setupEmploymentHistorySchema(admin).code, 'EMPLOYMENT_REVIEW_REQUIRED');

  const second = loadBackendWithSheets();
  assert.equal(second.context.setupDynamicFieldSheets().ready, true);
  const manual = second.context.saveDynamicSection(admin, {
    sectionKey: 'existing_work_history', nameTH: 'ประวัติการทำงานเดิม', nameEN: 'Existing Employment History',
    cardinality: 'repeatable', visibilityRules: { logic: 'AND', conditions: [] },
  });
  assert.equal(manual.status, 'success');
  const candidatePreview = second.context.previewEmploymentHistorySetup(admin);
  assert.equal(candidatePreview.candidateSections.length, 1);
  assert.equal(candidatePreview.safeToInstall, false);
  assert.equal(second.context.setupEmploymentHistorySchema(admin).code, 'EMPLOYMENT_REVIEW_REQUIRED');
});

test('employment setup safely reuses an empty matching section without duplicating it', () => {
  const { context: c } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  const manual = c.saveDynamicSection(admin, {
    sectionKey: 'existing_work_history', nameTH: 'ประวัติการทำงาน', nameEN: 'Employment History',
    cardinality: 'repeatable', visibilityRules: { logic: 'AND', conditions: [] },
  });
  assert.equal(manual.status, 'success');
  const preview = c.previewEmploymentHistorySetup(admin);
  assert.equal(preview.candidateSections.length, 1);
  assert.equal(preview.candidateSections[0].adoptable, true);
  assert.equal(preview.candidateSections[0].recommendedTargetKey, 'alumni_employment_history');

  const installed = c.setupEmploymentHistorySchema(admin, {
    adoptCandidateSectionId: manual.sectionId,
    adoptTargetSectionKey: 'alumni_employment_history',
  });
  assert.equal(installed.status, 'success');
  assert.equal(installed.ready, true);
  assert.ok(installed.changed.some(item => item.type === 'section_adoption' && item.sectionId === manual.sectionId));
  const sections = c.DynamicFieldRepository.readTable('FormSections').objects;
  const adopted = sections.find(section => section.SectionID === manual.sectionId);
  assert.equal(adopted.SectionKey, 'alumni_employment_history');
  assert.equal(sections.filter(section => section.SectionKey === 'alumni_employment_history').length, 1);
  assert.equal(sections.some(section => section.SectionKey === 'existing_work_history'), false);
  assert.equal(c.previewEmploymentHistorySetup(admin).candidateSections.length, 0);

  const sectionCount = sections.length;
  const repeated = c.setupEmploymentHistorySchema(admin, {
    adoptCandidateSectionId: manual.sectionId,
    adoptTargetSectionKey: 'alumni_employment_history',
  });
  assert.equal(repeated.alreadyReady, true);
  assert.equal(c.DynamicFieldRepository.readTable('FormSections').objects.length, sectionCount);
});

test('employment report joins profile identity without copying it into work values', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);

  const students = spreadsheet.getSheetByName('Students');
  students.rows[0].push('Title', 'FirstName', 'LastName', 'Institution', 'ScholarshipYear');
  students.rows[1][1] = 'Graduated';
  students.rows[1].push('นางสาว', 'มะลิ', 'ใจดี', 'MBS', '2020');

  const fields = c.DynamicFieldRepository.readTable('CustomFieldDefinitions').objects;
  const byKey = Object.fromEntries(fields.map(field => [field.FieldKey, field.FieldID]));
  const saved = c.saveStudentDynamicValues(admin, 'student', 'MBS_001', [
    { fieldId: byKey.employment_current_status, recordId: 'single', value: 'employed_full_time' },
    { fieldId: byKey.employment_employer_name, recordId: 'rec_work_1', value: 'RDF Foundation' },
    { fieldId: byKey.employment_workplace_location, recordId: 'rec_work_1', value: 'Mae Sariang' },
    { fieldId: byKey.employment_job_title, recordId: 'rec_work_1', value: 'Coordinator' },
    { fieldId: byKey.employment_start_month, recordId: 'rec_work_1', value: '2025-01' },
    { fieldId: byKey.employment_end_month, recordId: 'rec_work_1', value: '' },
    { fieldId: byKey.employment_verification_status, recordId: 'rec_work_1', value: 'verified' },
  ], []);
  assert.equal(saved.status, 'success', JSON.stringify(saved));

  const report = c.getEmploymentReport(
    { username: 'manager', role: 'Manager' },
    { institution: 'MBS', asOfMonth: '2026-03' },
  );
  assert.equal(report.status, 'success');
  assert.equal(report.setupRequired, false);
  assert.equal(report.summary.eligiblePeople, 1);
  assert.equal(report.summary.reportedPeople, 1);
  assert.equal(report.summary.employmentRecords, 1);
  assert.equal(report.data[0].nameTH, 'นางสาวมะลิ ใจดี');
  assert.equal(report.data[0].histories[0].employerName, 'RDF Foundation');
  assert.equal(report.data[0].histories[0].durationMonths, 15);
  assert.equal(report.data[0].histories[0].current, true);
  assert.equal(report.data[0].histories[0].verificationStatus, 'verified');

  const storedValues = c.DynamicFieldRepository.readTable('CustomFieldValues').objects.map(row => row.Value);
  assert.equal(storedValues.includes('มะลิ'), false);
  assert.equal(storedValues.includes('MBS'), false);
  assert.equal(c.getEmploymentReport({ username: 'MBS_001', role: 'Student' }, {}).code, 'ACCESS_DENIED');
});

test('rejected continuation funding becomes self-funded study and is derived once in employment reporting', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);

  const students = spreadsheet.getSheetByName('Students');
  students.rows = [
    ['StipNo','Status','Institution','Title','FirstName','LastName','CurrentAcademicYear','SchApprovalStatus','SchApprovalBy','SchApprovalDate','SchApprovalNotes','UniScholarship','UniName','UniNameEN','UpdatedAt'],
    ['MBS_001','Graduated','MBS','นางสาว','มะลิ','ใจดี','2568','Pending','','','','Yes','มหาวิทยาลัยเชียงใหม่','Chiang Mai University',''],
  ];

  const reviewed = c.reviewScholarshipRequest('MBS_001', 'Rejected', 'Foundation funding not continued', 'manager', '2026-03-20', '2569');
  assert.equal(reviewed.status, 'success');
  const headers = students.rows[0];
  const value = key => students.rows[1][headers.indexOf(key)];
  assert.equal(value('Status'), 'University');
  assert.equal(value('UniScholarship'), 'No');
  assert.equal(value('SchApprovalStatus'), 'Rejected');
  assert.equal(value('CurrentAcademicYear'), '2569');

  const report = c.getEmploymentReport({ username:'manager', role:'Manager' }, { asOfMonth:'2026-03' });
  assert.equal(report.status, 'success');
  assert.equal(report.data[0].employmentStatus, 'studying_only');
  assert.equal(report.data[0].employmentStatusSource, 'scholarship_continuation');
  assert.equal(report.data[0].continuingEducationWithoutRdf, true);
  assert.equal(report.data[0].universityName, 'มหาวิทยาลัยเชียงใหม่');
  assert.equal(report.summary.reportedPeople, 1);
  assert.equal(c.DynamicFieldRepository.readTable('CustomFieldValues').objects.length, 0, 'derived scholarship status must not be copied to employment values');
});

test('graduated self-funded university students default to studying only without employment history', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);

  const students = spreadsheet.getSheetByName('Students');
  students.rows = [
    ['StipNo','Status','Institution','Title','FirstName','LastName','CurrentAcademicYear','SchApprovalStatus','UniScholarship','UniName','UniNameEN','UpdatedAt'],
    ['MBS_001','Graduated','MBS','นาย','เรียนต่อ','ทุนตนเอง','2569','','No','มหาวิทยาลัยเชียงใหม่','Chiang Mai University','2026-10-18T08:00:00Z'],
  ];

  const schema = c.getDynamicFormSchema(admin, 'student', 'MBS_001');
  const statusField = schema.fields.find(field => field.fieldKey === 'employment_current_status');
  const derived = schema.values.find(value => value.fieldId === statusField.fieldId && value.recordId === 'single');
  assert.equal(derived.value, 'studying_only');
  assert.equal(derived.derived, true);
  assert.equal(derived.source, 'scholarship_continuation');

  const report = c.getEmploymentReport(admin, { asOfMonth:'2026-10' });
  assert.equal(report.data[0].employmentStatus, 'studying_only');
  assert.equal(report.data[0].employmentStatusSource, 'scholarship_continuation');
  assert.equal(report.data[0].continuingEducationWithoutRdf, true);
  assert.equal(report.data[0].histories.length, 0);
  assert.equal(c.DynamicFieldRepository.readTable('CustomFieldValues').objects.length, 0, 'automatic status must remain derived instead of duplicated');

  const headers = students.rows[0];
  students.rows[1][headers.indexOf('Status')] = 'University';
  students.rows[1][headers.indexOf('UniScholarship')] = 'Yes';
  students.rows[1][headers.indexOf('SchApprovalStatus')] = 'Approved';
  const sponsoredSchema = c.getDynamicFormSchema(admin, 'student', 'MBS_001');
  assert.equal(sponsoredSchema.values.some(value => value.fieldId === statusField.fieldId), false,
    'RDF-funded university students must not be classified as self-funded');
  const sponsoredReport = c.getEmploymentReport(admin, { asOfMonth:'2026-10' });
  assert.equal(sponsoredReport.data[0].continuingEducationWithoutRdf, false);
  assert.equal(sponsoredReport.data[0].employmentStatus, '');
});

test('student promotion history hides technical scholarship rows and returns ISO dates', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const headers = [
    'BatchID','Date','AcademicYear','StipNo','Title','FirstName','LastName','EngFirstName','EngLastName',
    'Institution','OldLevel','ActionTaken','NewLevel','NewStatus','UniName','UniNameEN','UniFaculty','UniFacultyEN',
    'UniMajor','UniMajorEN','UniProvince','UniProvinceEN','UniDuration','SchPriority','Notes','SavedBy'
  ];
  const history = spreadsheet.insertSheet('Promotion_History');
  const row = values => headers.map(header => values[header] || '');
  history.rows = [headers,
    row({ BatchID:'2568_PROMO', Date:new Date('2026-04-30T17:00:00.000Z'), AcademicYear:'2568', StipNo:'333',
      NewStatus:'Graduated', UniName:'มหาวิทยาลัยราชภัฏเชียงใหม่', UniFaculty:'มนุษยศาสตร์และสังคมศาสตร์', UniMajor:'รัฐประศาสนศาสตร์' }),
    row({ BatchID:'UNKNOWN_PROMO', Date:new Date('2026-05-30T17:00:00.000Z'), AcademicYear:'UNKNOWN', StipNo:'333',
      NewStatus:'Active', Institution:'UNI' }),
  ];

  const result = c.getStudentPromoHistory('333');
  assert.equal(result.status, 'success');
  assert.equal(result.rows.length, 1, 'administrative scholarship decisions must not appear as empty promotions');
  assert.equal(result.rows[0].ActionTaken, 'university_transition');
  assert.equal(result.rows[0].AcademicYear, '2568');
  assert.equal(result.rows[0].Date, '2026-05-01');

  const before = history.rows.length;
  c._appendPromotionHistory([{ StipNo:'333', NewStatus:'Active', SchApprovalStatus:'Approved' }], 'admin', '2026-05-31');
  assert.equal(history.rows.length, before, 'new scholarship decisions must not create promotion-history rows');
  c._appendPromotionHistory([{ StipNo:'333', Action:'graduate', NewStatus:'Graduated', CurrentAcademicYear:'2569' }], 'admin', '2027-05-01');
  assert.equal(history.rows.length, before + 1, 'explicit promotion and graduation actions remain in history');
});

test('signature settings accept compact PNG marks and reject unsafe or oversized payloads', () => {
  const c = loadBackend();
  const png = 'data:image/png;base64,' + Buffer.from('compact-signature').toString('base64');
  const valid = c._validateSignatureBlock([{ role:'ผู้ตรวจสอบข้อมูล', name:'Test User', position:'Manager', signatureDataUrl:png }]);
  assert.equal(valid.ok, true);
  assert.equal(valid.values[0].signatureDataUrl, png);
  assert.equal(c._validateSignatureBlock([{ role:'x', signatureDataUrl:'data:image/svg+xml,<svg onload=alert(1)>' }]).ok, false);
  assert.equal(c._validateSignatureBlock([{ role:'x', signatureDataUrl:'data:image/png;base64,' + 'A'.repeat(26000) }]).ok, false);
});

test('shared notification rules validate once and preserve an extensible module schema', () => {
  const c = loadBackend();
  const defaults = c._defaultNotificationRules();
  const valid = c._validateNotificationRules(defaults);
  assert.equal(valid.ok, true);
  assert.equal(valid.values.modules[0].moduleId, 'employment');
  assert.deepEqual([...valid.values.modules[0].audienceRoles], ['SuperAdmin','Manager','Volunteer']);
  assert.equal(c._validateNotificationRules({ modules:[] }).ok, false);
  const duplicate = JSON.parse(JSON.stringify(defaults));
  duplicate.modules[0].rules.push({ ...duplicate.modules[0].rules[0] });
  assert.equal(c._validateNotificationRules(duplicate).ok, false);
  const future = JSON.parse(JSON.stringify(defaults));
  future.modules.push({
    moduleId:'academic_results', enabled:true, audienceRoles:['Manager'],
    rules:[{ruleId:'academic_results.update_due',eventType:'update_due',enabled:true,leadDays:14}],
  });
  assert.equal(c._validateNotificationRules(future).ok, true, 'future modules reuse the same validated notification schema');
});

test('employment tracking periods accept multiple yearly and ongoing ranges safely', () => {
  const c = loadBackend();
  const valid = c._validateEmploymentTrackingPeriods({ schemaVersion:'1.0.0', periods:[
    { periodId:'period_2026_a', startDate:'2026-01-01', endDate:'2026-03-31', asOfMonth:'2026-03', active:true },
    { periodId:'period_2026_b', startDate:'2026-04-01', endDate:'', asOfMonth:'2026-12', active:true },
    { periodId:'period_2025_a', startDate:'2025-01-01', endDate:'2025-12-31', asOfMonth:'2025-12', active:true },
  ] });
  assert.equal(valid.ok,true);
  assert.equal(valid.values.periods.length,3);
  assert.equal(valid.values.periods[0].periodId,'period_2026_b');
  assert.equal(c._validateEmploymentTrackingPeriods({periods:[{periodId:'period_bad',startDate:'2026-03-31',endDate:'2026-03-01',asOfMonth:'2026-03'}]}).ok,false);
  assert.equal(c._validateEmploymentTrackingPeriods({periods:[
    {periodId:'period_same',startDate:'2026-01-01',endDate:'',asOfMonth:'2026-01'},
    {periodId:'period_same',startDate:'2026-02-01',endDate:'',asOfMonth:'2026-02'},
  ]}).ok,false);
});

test('operational notification feed aggregates live follow-up data without copying it', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username:'admin', role:'SuperAdmin' };
  const manager = { username:'manager', role:'Manager' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);
  spreadsheet.getSheetByName('Students').rows[1][1] = 'Graduated';
  c._employmentCurrentDate = () => '2026-03-20';
  c._dfNow = () => '2026-03-20T10:00:00.000Z';
  const overdue = c.saveEmploymentFollowUp(manager, {
    stipNo:'MBS_001', contactDate:'2026-03-01', contactMethod:'phone', outcome:'follow_up_needed',
    nextFollowUpDate:'2026-03-19', assignedTo:'Manager A', notes:'Overdue source record',
  });
  const upcoming = c.saveEmploymentFollowUp(manager, {
    stipNo:'MBS_001', contactDate:'2026-03-10', contactMethod:'email', outcome:'follow_up_needed',
    nextFollowUpDate:'2026-03-24', assignedTo:'Manager A', notes:'Upcoming source record',
  });
  assert.equal(overdue.status, 'success');
  assert.equal(upcoming.status, 'success');
  const feed = c.getNotificationFeed(manager, true);
  assert.equal(feed.status, 'success');
  assert.deepEqual([...feed.data.map(item => item.eventType)], ['followup_overdue','followup_due_soon','data_missing','data_updated']);
  assert.deepEqual([...feed.data.map(item => item.count)], [1,1,1,1]);
  assert.match(feed.data[0].eventId, /^employment\.followup_overdue\.[a-f0-9]{8}$/);
  assert.equal(c.getNotificationFeed({ username:'finance', role:'Finance' }, true).data.length, 0, 'default audience excludes Finance');
  const volunteerFeed = c.getNotificationFeed({ username:'volunteer', role:'Volunteer' }, true);
  assert.deepEqual([...volunteerFeed.data.map(item => item.eventType)], ['followup_overdue','followup_due_soon','data_missing','data_updated'], 'volunteers receive alumni follow-up notifications by default');
  const studentConfig = c._defaultNotificationRules();
  studentConfig.modules[0].audienceRoles.push('Student');
  assert.equal(c._validateNotificationRules(studentConfig).ok, true, 'Student is a supported notification recipient');
  c._notificationRulesConfig = () => studentConfig;
  const studentFeed = c.getNotificationFeed({ username:'MBS_001', role:'Student' }, true);
  assert.equal(studentFeed.status, 'success');
  assert.deepEqual([...studentFeed.data.map(item => item.eventType)], ['followup_overdue','followup_due_soon','data_missing','data_updated']);
  assert.deepEqual([...studentFeed.data.map(item => item.count)], [1,1,1,1], 'student feed is limited to the signed-in record');
  assert.equal(c.getEmploymentReport({ username:'MBS_001', role:'Student' }, {}).code, 'ACCESS_DENIED', 'students cannot open the aggregate employment report');
  const managerProfileFollowUps=c.getStudentEmploymentFollowUps(manager,'MBS_001');
  assert.equal(managerProfileFollowUps.status,'success');
  assert.equal(managerProfileFollowUps.data.length,2,'staff profile reads the same active follow-up records');
  const ownProfileFollowUps=c.getStudentEmploymentFollowUps({username:'MBS_001',role:'Student'},'MBS_001');
  assert.equal(ownProfileFollowUps.data.length,2,'students can read follow-ups only on their own profile');
  assert.equal(c.getStudentEmploymentFollowUps({username:'MBS_002',role:'Student'},'MBS_001').code,'ACCESS_DENIED');
  const stored = c.DynamicFieldRepository.readTable('EmploymentFollowUps').objects;
  assert.equal(stored.length, 2);
  assert.equal(Object.hasOwn(stored[0], 'StudentName'), false, 'notification feed must not copy profile identity into follow-up storage');
});

test('report registry reuses opaque QR tokens and invalidates the old token on controlled regeneration', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const originalStudentRows = spreadsheet.getSheetByName('Students').rows.map(row => [...row]);
  const session = { username: 'admin', role: 'SuperAdmin' };
  const report = {
    reportType: 'employment_status', fingerprint: 'a'.repeat(64), contentHash: 'a'.repeat(64),
    subjectTH: 'รายงานภาวะการทำงานของศิษย์เก่า', subjectEN: 'Alumni Employment Status Report',
    language: 'th', scope: { institution: 'MBS' }, fieldKeys: ['alumni', 'employmentStatus'], rowCount: 1,
  };

  const first = c.issueReportReference(session, report);
  assert.equal(first.status, 'success');
  assert.equal(first.reused, false);
  assert.match(first.verificationToken, /^[a-f0-9]{64}$/);
  assert.match(first.report.referenceNo, /^RDF-EMP-/);

  const second = c.issueReportReference(session, report);
  assert.equal(second.status, 'success');
  assert.equal(second.reused, true);
  assert.equal(second.verificationToken, first.verificationToken, 'unchanged report content must reuse its QR token');
  assert.equal(spreadsheet.getSheetByName('ReportRegistry').rows.length, 2, 'registry must contain one header and one report');

  const scholarship = c.issueReportReference(session, {
    reportType: 'scholarship_statistics', fingerprint: 'b'.repeat(64), contentHash: 'b'.repeat(64),
    subjectTH: 'รายงานสถิติทุนการศึกษา', subjectEN: 'Scholarship Statistics Report', language: 'th',
    scope: { scholarshipYear: '2568' }, fieldKeys: ['kpis', 'annual_summary'], rowCount: 1,
  });
  assert.equal(scholarship.status, 'success');
  assert.equal(scholarship.report.reportType, 'scholarship_statistics');
  assert.match(scholarship.report.referenceNo, /^RDF-SCH-/);
  assert.notEqual(scholarship.verificationToken, first.verificationToken, 'each report type must receive an independent opaque token');
  assert.equal(spreadsheet.getSheetByName('ReportRegistry').rows.length, 3, 'different report types share one registry without overwriting each other');

  const publicView = c.getReportVerificationPublic(first.verificationToken);
  assert.equal(publicView.status, 'success');
  assert.equal(publicView.authenticationRequired, true);
  assert.equal(Object.hasOwn(publicView.report, 'contentHash'), false, 'public QR view must not expose internal verification data');
  assert.deepEqual(Object.keys(publicView.report).sort(), ['active', 'referenceNo', 'reportType', 'subjectEN', 'subjectTH'].sort(), 'public QR view must expose only the subject and reference summary');
  const privateView = c.getReportVerificationDetails(session, first.verificationToken);
  assert.equal(privateView.report.contentHash, 'a'.repeat(64));
  assert.equal(privateView.report.exportCount, 2);

  const rejected = c.regenerateReportQr(session, first.report.reportId, 'short', true);
  assert.equal(rejected.code, 'REPORT_QR_REGENERATION_CONDITIONS');
  const regenerated = c.regenerateReportQr(session, first.report.reportId, 'QR code was exposed and must be replaced', true);
  assert.equal(regenerated.status, 'success');
  assert.equal(regenerated.report.referenceNo, first.report.referenceNo, 'QR renewal must retain the document reference');
  assert.equal(regenerated.report.qrVersion, 2);
  assert.notEqual(regenerated.verificationToken, first.verificationToken);
  assert.equal(c.getReportVerificationPublic(first.verificationToken).code, 'REPORT_VERIFICATION_NOT_FOUND', 'old QR must be revoked immediately');
  assert.equal(c.getReportVerificationPublic(regenerated.verificationToken).status, 'success');
  assert.deepEqual(spreadsheet.getSheetByName('Students').rows, originalStudentRows, 'report registration must not alter student data');
});

test('report registry database setup is additive and idempotent', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const originalStudentRows = spreadsheet.getSheetByName('Students').rows.map(row => [...row]);
  const before = c.previewReportRegistrySetup();
  assert.equal(before.exists, false);
  assert.equal(before.ready, false);

  const created = c.setupReportRegistrySheet();
  assert.equal(created.status, 'success');
  assert.equal(created.ready, true);
  assert.equal(created.action, 'created');
  assert.equal(created.rowCount, 0);

  const repeated = c.setupReportRegistrySheet();
  assert.equal(repeated.status, 'success');
  assert.equal(repeated.action, 'none');
  assert.equal(repeated.changed, false);
  assert.deepEqual(spreadsheet.getSheetByName('Students').rows, originalStudentRows, 'registry setup must not alter student data');
});

test('employment follow-ups reference student and work record without copying workplace data', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  const manager = { username: 'manager', role: 'Manager' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);
  spreadsheet.getSheetByName('Students').rows[1][1] = 'Graduated';

  const fields = c.DynamicFieldRepository.readTable('CustomFieldDefinitions').objects;
  const byKey = Object.fromEntries(fields.map(field => [field.FieldKey, field.FieldID]));
  assert.equal(c.saveStudentDynamicValues(admin, 'student', 'MBS_001', [
    { fieldId: byKey.employment_employer_name, recordId: 'rec_work_1', value: 'RDF Foundation' },
    { fieldId: byKey.employment_start_month, recordId: 'rec_work_1', value: '2026-01' },
  ], []).status, 'success');

  const saved = c.saveEmploymentFollowUp(manager, {
    stipNo: 'MBS_001', employmentRecordId: 'rec_work_1', contactDate: '2026-03-10',
    contactMethod: 'phone', outcome: 'follow_up_needed', nextFollowUpDate: '2026-04-10',
    assignedTo: 'Manager A', notes: 'Waiting for confirmation',
  });
  assert.equal(saved.status, 'success', JSON.stringify(saved));
  assert.match(saved.data.followUpId, /^fup_/);
  assert.equal(c.saveEmploymentFollowUp(manager, {
    stipNo: 'MBS_001', employmentRecordId: 'rec_missing', contactDate: '2026-03-10',
    contactMethod: 'phone', outcome: 'other',
  }).code, 'FOLLOWUP_RECORD_NOT_FOUND');
  assert.equal(c.saveEmploymentFollowUp(manager, {
    stipNo: 'MBS_001', contactDate: '2026-03-10', nextFollowUpDate: '2026-03-01',
    contactMethod: 'phone', outcome: 'other',
  }).code, 'FOLLOWUP_VALIDATION_ERROR');
  assert.equal(c.saveEmploymentFollowUp(manager, {
    stipNo: 'MBS_001', contactDate: '2026-02-31',
    contactMethod: 'phone', outcome: 'other',
  }).code, 'FOLLOWUP_VALIDATION_ERROR');

  const report = c.getEmploymentReport(manager, { asOfMonth: '2026-03' });
  assert.equal(report.data[0].followUps.length, 1);
  assert.equal(report.data[0].followUps[0].employmentRecordId, 'rec_work_1');
  assert.equal(report.summary.followUpRecords, 1);
  const stored = c.DynamicFieldRepository.readTable('EmploymentFollowUps').objects[0];
  assert.equal(Object.hasOwn(stored, 'Workplace'), false);
  assert.equal(Object.values(stored).includes('RDF Foundation'), false);

  assert.equal(c.archiveEmploymentFollowUp(manager, saved.data.followUpId).status, 'success');
  assert.equal(c.getEmploymentReport(manager, {}).summary.followUpRecords, 0);
});

test('volunteer role is limited to alumni employment, follow-ups, surveys, and reports', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username:'admin', role:'SuperAdmin' };
  const volunteer = { username:'volunteer.user', role:'Volunteer' };
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).ready, true);
  spreadsheet.getSheetByName('Students').rows[1][1] = 'Graduated';
  spreadsheet.getSheetByName('Students').rows.push(['MBS_002','Active']);

  assert.equal(c._serverHasPermission(volunteer, 'viewAlumniEmployment'), true);
  assert.equal(c._serverHasPermission(volunteer, 'editStudents'), false);
  assert.equal(c._serverCanReadStudent(volunteer, 'MBS_001'), true);
  assert.equal(c._serverCanReadStudent(volunteer, 'MBS_002'), false);
  assert.equal(c.getAlumniStudentsData().data.length, 1);
  assert.equal(c.getEmploymentReport(volunteer, {}).status, 'success');

  const fields = c.DynamicFieldRepository.readTable('CustomFieldDefinitions').objects;
  const statusField = fields.find(field => field.FieldKey === 'employment_current_status');
  assert.equal(c.saveStudentDynamicValues(volunteer, 'student', 'MBS_001', [
    { fieldId:statusField.FieldID, recordId:'single', value:'employed_full_time' },
  ], []).status, 'success');

  const extraSection = c.saveDynamicSection(admin, {
    entityType:'student', sectionKey:'private_admin_notes', nameTH:'บันทึกเจ้าหน้าที่', nameEN:'Staff Notes',
    cardinality:'single', visibleRoles:['SuperAdmin'], visibilityRules:{logic:'AND',conditions:[]},
  });
  const extraField = c.saveDynamicField(admin, {
    entityType:'student', sectionId:extraSection.sectionId, fieldKey:'private_admin_note', fieldType:'text',
    labelTH:'หมายเหตุ', labelEN:'Note', visibleRoles:['SuperAdmin'], editableRoles:['SuperAdmin'],
    visibilityRules:{logic:'AND',conditions:[]},
  }, []);
  assert.equal(c.saveStudentDynamicValues(volunteer, 'student', 'MBS_001', [
    { fieldId:extraField.fieldId, recordId:'single', value:'must be denied' },
  ], []).code, 'FIELD_ACCESS_DENIED');

  const followUp = c.saveEmploymentFollowUp(volunteer, {
    stipNo:'MBS_001', contactDate:'2026-10-20', contactMethod:'phone', outcome:'follow_up_needed',
    nextFollowUpDate:'2026-11-01', assignedTo:'Volunteer A', notes:'Volunteer follow-up',
  });
  assert.equal(followUp.status, 'success');

  const migrated = c._upgradeServerPermissionMap({ Manager:['viewStudents','editStudents','viewReports','exportData','manageNotifications'] });
  assert.equal(migrated.Manager.includes('viewAlumniEmployment'), true, 'legacy permission maps gain equivalent granular permissions once');
  assert.equal(migrated.Manager.includes('manageAlumniFollowUps'), true);
  assert.equal(migrated.Manager.includes('manageTrackingCycles'), true);

  c.getSystemSettings = () => ({ status:'success', data:{ RBAC_PERMISSIONS:{
    _schemaVersion:'2.0.0', Manager:['viewStudents','editStudents','viewReports'],
  } } });
  const restrictedManager = { username:'restricted.manager', role:'Manager' };
  assert.equal(c.getEmploymentReport(restrictedManager, {}).code, 'ACCESS_DENIED', 'current permission maps must not regain a revoked alumni-report permission through legacy rights');
  assert.equal(c._employmentCanManageFollowUps(restrictedManager), false, 'follow-up permission matrix choices must be authoritative');
  assert.equal(c.saveStudentDynamicValues(restrictedManager, 'student', 'MBS_001', [
    { fieldId:statusField.FieldID, recordId:'single', value:'self_employed' },
  ], []).code, 'FIELD_ACCESS_DENIED', 'student-registry edit access must not bypass alumni-employment edit permission');
});

test('legacy employment migration requires review, is idempotent, and preserves Alumni source rows', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  spreadsheet.getSheetByName('Students').rows[1][1] = 'Graduated';
  const alumni = spreadsheet.insertSheet('Alumni');
  alumni.rows = [
    ['StipNo', 'Occupation', 'Workplace'],
    ['MBS_001', 'Coordinator', 'RDF Foundation'],
  ];
  const originalSource = alumni.rows.map(row => [...row]);
  assert.equal(c.setupDynamicFieldSheets().ready, true);
  assert.equal(c.setupEmploymentHistorySchema(admin).code, 'EMPLOYMENT_REVIEW_REQUIRED');
  const prepared = c.setupEmploymentHistorySchema(admin, { allowLegacyData: true });
  assert.equal(prepared.status, 'success', JSON.stringify(prepared));
  assert.equal(prepared.ready, true);

  const preview = c.previewLegacyEmploymentMigration(admin);
  assert.equal(preview.schemaReady, true);
  assert.equal(preview.ready, 1);
  assert.equal(preview.rows[0].status, 'ready');
  const migrated = c.migrateLegacyEmploymentData(admin, [preview.rows[0].sourceKey]);
  assert.equal(migrated.status, 'success', JSON.stringify(migrated));
  assert.equal(migrated.migrated.length, 1);
  assert.deepEqual(alumni.rows, originalSource);

  const report = c.getEmploymentReport(admin, {});
  assert.equal(report.data[0].histories.length, 1);
  assert.equal(report.data[0].histories[0].employerName, 'RDF Foundation');
  assert.equal(report.data[0].histories[0].jobTitle, 'Coordinator');
  assert.equal(report.data[0].histories[0].verificationStatus, 'needs_revision');
  assert.equal(report.data[0].histories[0].durationMonths, null);
  assert.equal(report.legacyRowsPendingMigration, 0);
  assert.equal(c.previewLegacyEmploymentMigration(admin).migrated, 1);

  const repeated = c.migrateLegacyEmploymentData(admin, [preview.rows[0].sourceKey]);
  assert.equal(repeated.status, 'success');
  assert.equal(repeated.migrated.length, 0);
  assert.equal(c.DynamicFieldRepository.readTable('EmploymentMigrationLog').objects.length, 1);
});

test('volunteer profiles are additive, validated, archivable, and support custom fields', () => {
  const { context: c, spreadsheet } = loadBackendWithSheets();
  const admin = { username: 'admin', role: 'SuperAdmin' };
  const preview = c.previewVolunteerSetupForUser(admin);
  assert.equal(preview.ready, false);
  assert.equal(c.setupVolunteerSchema(admin).ready, true);
  assert.equal(c.setupVolunteerSchema(admin).changed.length, 0, 'setup must be idempotent');

  const invalid = c.saveVolunteer(admin, { firstName:'Volunteer', lastName:'Missing' });
  assert.equal(invalid.code, 'VOLUNTEER_VALIDATION_ERROR');
  const saved = c.saveVolunteer(admin, {
    firstName:'อาสา', lastName:'ทดสอบ', engFirstName:'Test', engLastName:'Volunteer',
    email:'volunteer@example.com', phone:'081-234-5678', lineId:'rdf-volunteer',
    volunteerStartDate:'2026-10-01', status:'active', skills:'=HELP()',
  });
  assert.equal(saved.status, 'success', JSON.stringify(saved));
  assert.match(saved.volunteerId, /^vol_/);
  const loaded = c.getVolunteer(admin, saved.volunteerId);
  assert.equal(loaded.data.lineId, 'rdf-volunteer');
  assert.equal(loaded.data.skills, '=HELP()', 'formula-safe storage must not change the displayed value');
  const stored = c.DynamicFieldRepository.readTable('Volunteers').objects[0];
  assert.equal(stored.Skills, "'=HELP()", 'spreadsheet formulas must be neutralized at rest');
  assert.equal(c.saveVolunteer(admin, {
    firstName:'ซ้ำ', lastName:'อีเมล', email:'VOLUNTEER@example.com',
    volunteerStartDate:'2026-10-02', status:'active',
  }).code, 'VOLUNTEER_EMAIL_DUPLICATE', 'active volunteer emails must be unique regardless of letter case');

  const adminsSheet = spreadsheet.insertSheet('Admins');
  adminsSheet.rows.push(['Username','Email','Role','Active'], ['volunteer.user','volunteer@example.com','Volunteer','true']);
  const linked = c.getVolunteer(admin, saved.volunteerId).data;
  assert.equal(linked.accountLinked, true);
  assert.equal(linked.accountRole, 'Volunteer');

  assert.equal(c.setupDynamicFieldSheets().ready, true);
  const section = c.saveDynamicSection(admin, {
    entityType:'volunteer', sectionKey:'volunteer_assignment', nameTH:'งานที่รับผิดชอบ', nameEN:'Assignment',
    cardinality:'single', visibleRoles:['SuperAdmin'], visibilityRules:{ logic:'AND', conditions:[] },
  });
  assert.equal(section.status, 'success', JSON.stringify(section));
  const field = c.saveDynamicField(admin, {
    entityType:'volunteer', sectionId:section.sectionId, fieldKey:'volunteer_project', fieldType:'text',
    labelTH:'โครงการ', labelEN:'Project', visibleRoles:['SuperAdmin'], editableRoles:['SuperAdmin'],
    visibilityRules:{ logic:'AND', conditions:[] },
  }, []);
  assert.equal(field.status, 'success', JSON.stringify(field));
  assert.equal(c.saveStudentDynamicValues(admin, 'volunteer', saved.volunteerId, [
    { fieldId:field.fieldId, recordId:'single', value:'Education camp' },
  ], []).status, 'success');
  const schema = c.getDynamicFormSchema(admin, 'volunteer', saved.volunteerId);
  assert.equal(schema.sections.length, 1);
  assert.equal(schema.values[0].value, 'Education camp');
  assert.equal(c.getDynamicFieldAdminData(admin, 'student').sections.some(item => item.sectionKey === 'volunteer_assignment'), false, 'volunteer sections must not leak into student forms');

  assert.equal(c.archiveVolunteer(admin, saved.volunteerId).status, 'success');
  assert.equal(c.getVolunteers(admin).data.length, 0);
  assert.equal(spreadsheet.getSheetByName('Students').rows.length, 2, 'volunteer setup must not modify student rows');
});
