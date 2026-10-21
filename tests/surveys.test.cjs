const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadSurveyBackend() {
  class Range {
    constructor(sheet, row, column, rowCount, columnCount) { Object.assign(this, { sheet, row, column, rowCount, columnCount }); }
    read() {
      return Array.from({ length:this.rowCount }, (_, r) => Array.from({ length:this.columnCount }, (_, c) => this.sheet.rows[this.row - 1 + r]?.[this.column - 1 + c] ?? ''));
    }
    getValues() { return this.read(); }
    getDisplayValues() { return this.read().map(row => row.map(value => String(value ?? ''))); }
    getValue() { return this.read()[0]?.[0] ?? ''; }
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
    constructor() {
      this.sheets = new Map([['Students', new Sheet('Students', [
        ['StipNo','Status','Institution','FirstName','LastName'],
        ['MBS_001','Graduated','MBS','หนึ่ง','ทดสอบ'],
        ['VC_001','University','VC','สอง','ทดสอบ'],
        ['MBS_002','Active','MBS','สาม','ทดสอบ'],
      ])]]);
    }
    getSheetByName(name) { return this.sheets.get(name) || null; }
    insertSheet(name) { const sheet = new Sheet(name); this.sheets.set(name, sheet); return sheet; }
  }
  const spreadsheet = new Spreadsheet();
  const cache = new Map();
  let uuid = 0;
  const context = {
    SpreadsheetApp:{ openById() { return spreadsheet; }, flush() {} },
    CacheService:{ getScriptCache() { return { get(key) { return cache.get(key) || null; }, put(key, value) { cache.set(key, value); }, remove(key) { cache.delete(key); } }; } },
    LockService:{ getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } },
    PropertiesService:{ getScriptProperties() { return { getProperty() { return null; }, setProperty() {}, deleteProperty() {} }; } },
    Utilities:{
      getUuid() { uuid += 1; return `${String(uuid).padStart(8, '0')}-0000-0000-0000-000000000000`; },
      formatDate(value, timeZone, pattern) {
        if (pattern === 'yyyy-MM-dd') return new Date(value).toISOString().slice(0, 10);
        return new Date(value).toISOString();
      },
    },
    Session:{ getScriptTimeZone() { return 'Asia/Bangkok'; } },
    console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
  return { context, spreadsheet };
}

function sampleForm() {
  return {
    titleTH:'แบบติดตามศิษย์เก่า', titleEN:'Alumni follow-up survey', allowDraft:true,
    questions:[
      { questionKey:'comment', type:'long_text', promptTH:'ข้อเสนอแนะ', promptEN:'Suggestions', required:false },
      { questionKey:'satisfaction', type:'rating_5', promptTH:'ความพึงพอใจ', promptEN:'Satisfaction', required:true },
      {
        questionKey:'services', type:'likert_matrix', promptTH:'ประเมินบริการ', promptEN:'Rate our services', required:true,
        rows:[{ value:'support', labelTH:'การดูแล', labelEN:'Support' }, { value:'coordination', labelTH:'การประสานงาน', labelEN:'Coordination' }],
        columns:[{ value:'1', labelTH:'ไม่พอใจ', labelEN:'Dissatisfied' }, { value:'5', labelTH:'พอใจมาก', labelEN:'Very satisfied' }],
      },
    ],
  };
}

test('survey schema setup is additive and idempotent', () => {
  const { context:c, spreadsheet } = loadSurveyBackend();
  const admin = { username:'admin', role:'SuperAdmin' };
  const preview = c.previewSurveySetupForUser(admin);
  assert.equal(preview.ready, false);
  const beforeSetup = c.getSurveyAdminData(admin);
  assert.equal(beforeSetup.setupRequired, true);
  assert.equal(beforeSetup.canManage, true, 'authorized admins must retain the install action before setup');
  assert.equal(beforeSetup.canViewResults, true);
  const first = c.setupSurveySchemaForUser(admin);
  assert.equal(first.ready, true);
  assert.equal(first.changed.length, 8);
  const formSheet = spreadsheet.getSheetByName('SurveyForms');
  formSheet.rows.push(formSheet.rows[0].map(header => header === 'FormID' ? 'existing' : ''));
  const second = c.setupSurveySchemaForUser(admin);
  assert.equal(second.ready, true);
  assert.equal(second.changed.length, 0);
  assert.equal(formSheet.rows.length, 2, 'setup rerun must preserve existing rows');
});

test('survey authoring validates matrix questions and locks published forms', () => {
  const { context:c } = loadSurveyBackend();
  const admin = { username:'admin', role:'SuperAdmin' };
  c.setupSurveySchemaForUser(admin);
  const invalid = sampleForm();
  invalid.questions[2].columns = [{ value:'1', labelTH:'หนึ่ง', labelEN:'One' }];
  assert.equal(c.saveSurveyFormDraft(admin, invalid).code, 'SURVEY_MATRIX_INVALID');
  const saved = c.saveSurveyFormDraft(admin, sampleForm());
  assert.equal(saved.status, 'success');
  const adminData = c.getSurveyAdminData(admin);
  assert.equal(adminData.forms.length, 1);
  assert.equal(adminData.forms[0].questions.length, 3);
  assert.equal(adminData.forms[0].questions[2].options.length, 4);
});

test('campaign publishing assigns only eligible alumni in the selected institution', () => {
  const { context:c } = loadSurveyBackend();
  const admin = { username:'admin', role:'SuperAdmin' };
  c.setupSurveySchemaForUser(admin);
  const form = c.saveSurveyFormDraft(admin, sampleForm());
  const campaign = c.saveSurveyCampaignDraft(admin, {
    formId:form.formId, nameTH:'รอบ MBS', nameEN:'MBS round', institution:'MBS', required:true,
    openAt:'2026-10-01T00:00:00.000Z', dueAt:'2030-10-31T00:00:00.000Z',
  });
  const published = c.publishSurveyCampaign(admin, campaign.campaignId);
  assert.equal(published.assigned, 1);
  assert.equal(c.publishSurveyCampaign(admin, campaign.campaignId).reused, true, 'publishing twice must not duplicate assignments');
  const assignments = c.DynamicFieldRepository.readTable('SurveyAssignments').objects;
  assert.deepEqual(assignments.map(row => row.StipNo), ['MBS_001']);
});

test('shared tracking cycle drives both employment scope and survey assignment', () => {
  const { context:c } = loadSurveyBackend();
  const admin = { username:'admin', role:'SuperAdmin' };
  c.setupSurveySchemaForUser(admin);
  const form = c.saveSurveyFormDraft(admin, sampleForm());
  const saved = c.saveTrackingCycle(admin, {
    nameTH:'รอบติดตามปี 2569', nameEN:'2026 tracking cycle', startDate:'2026-01-01', endDate:'2026-12-31',
    asOfMonth:'2026-12', institution:'MBS', surveyEnabled:true, surveyFormId:form.formId,
    surveyOpenAt:'2020-01-01T00:00:00.000Z', surveyDueAt:'2030-12-31T00:00:00.000Z', surveyRequired:true,
  });
  assert.equal(saved.status, 'success');
  const duplicate = c.saveTrackingCycle(admin, {
    nameTH:'ช่วงซ้ำ', nameEN:'Duplicate', startDate:'2026-01-01', endDate:'2026-12-31', asOfMonth:'2026-12', institution:'', surveyEnabled:false,
  });
  assert.equal(duplicate.code, 'TRACKING_CYCLE_DUPLICATE');
  const published = c.publishTrackingCycle(admin, saved.cycleId);
  assert.equal(published.status, 'success');
  assert.equal(published.assigned, 1);
  const data = c.getTrackingCycleData(admin);
  assert.equal(data.cycles.length, 1);
  assert.equal(data.cycles[0].campaignId, published.campaignId);
  assert.equal(data.cycles[0].summary.assigned, 1);
  assert.equal(c.archiveTrackingCycle(admin, saved.cycleId).code, 'TRACKING_CYCLE_IMMUTABLE');
});

test('alumni can save and submit only their own assigned response', () => {
  const { context:c } = loadSurveyBackend();
  const admin = { username:'admin', role:'SuperAdmin' };
  const student = { username:'MBS_001', role:'Student' };
  c.setupSurveySchemaForUser(admin);
  const form = c.saveSurveyFormDraft(admin, sampleForm());
  const campaign = c.saveSurveyCampaignDraft(admin, {
    formId:form.formId, nameTH:'รอบทดสอบ', nameEN:'Test round', institution:'MBS', required:true,
    openAt:'2020-01-01T00:00:00.000Z', dueAt:'2030-12-31T00:00:00.000Z',
  });
  c.publishSurveyCampaign(admin, campaign.campaignId);
  const assignment = c.getMySurveyAssignments(student).assignments[0];
  assert.ok(assignment.assignmentId);
  assert.equal(c.getSurveyForResponse({ username:'VC_001', role:'Student' }, assignment.assignmentId).code, 'ACCESS_DENIED');
  const loaded = c.getSurveyForResponse(student, assignment.assignmentId);
  const byKey = Object.fromEntries(loaded.form.questions.map(question => [question.questionKey, question.questionId]));
  const incomplete = c.saveSurveyResponse(student, assignment.assignmentId, [
    { questionId:byKey.satisfaction, value:5 },
  ], true, 'th');
  assert.equal(incomplete.code, 'SURVEY_REQUIRED_ANSWERS');
  const draft = c.saveSurveyResponse(student, assignment.assignmentId, [
    { questionId:byKey.comment, value:'=ข้อความทดสอบ' },
    { questionId:byKey.satisfaction, value:5 },
  ], false, 'th');
  assert.equal(draft.status, 'draft');
  const submitted = c.saveSurveyResponse(student, assignment.assignmentId, [
    { questionId:byKey.comment, value:'ข้อเสนอแนะ' },
    { questionId:byKey.satisfaction, value:5 },
    { questionId:byKey.services, value:{ support:'5', coordination:'1' } },
  ], true, 'th');
  assert.equal(submitted.status, 'submitted');
  assert.equal(c.saveSurveyResponse(student, assignment.assignmentId, [], true, 'th').code, 'SURVEY_ALREADY_SUBMITTED');
  const summary = c.getSurveyCampaignSummary(admin, campaign.campaignId);
  assert.equal(summary.summary.assigned, 1);
  assert.equal(summary.summary.submitted, 1);
  assert.equal(summary.summary.responseRate, 100);
  assert.equal(summary.analytics.find(item => item.questionKey === 'satisfaction').average, 5);
});
