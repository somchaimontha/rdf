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
  let uuidCounter = 0;
  const context = {
    SpreadsheetApp: { openById() { return spreadsheet; }, flush() {} },
    CacheService: { getScriptCache() { return { get(key) { return cache.get(key) || null; }, put(key, value) { cache.set(key, value); }, remove(key) { cache.delete(key); } }; } },
    LockService: { getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } },
    Utilities: { getUuid() { uuidCounter += 1; return `${String(uuidCounter).padStart(8, '0')}-0000-0000-0000-000000000000`; } },
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
  assert.match(source, /CustomFieldDefinitions/);
  assert.match(source, /CustomFieldAuditLog/);
  assert.match(source, /'RecordID'/);
  assert.match(source, /'Active','CreatedAt'/);
  const dynamicBlock = source.slice(source.indexOf('Dynamic Custom Fields'));
  assert.doesNotMatch(dynamicBlock, /clear\s*\(/);
  assert.doesNotMatch(dynamicBlock, /deleteSheet|deleteColumn|deleteRow/);
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
