const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const backend = read('Code.gs');
const auth = read('assets/js/auth.js');
const promotion = read('promotion.html');
const students = read('students.html');
const studentForm = read('student-form.html');

test('resolved scholarship decisions cannot return through the notification fallback', () => {
  assert.match(backend, /schApprovalStatus:\s*_c\('SchApprovalStatus'\)/);
  assert.match(auth, /s\.status === 'Graduated' && s\.uniName && !String\(s\.schApprovalStatus \|\| ''\)\.trim\(\)/);
  assert.match(promotion, /_PENDING_APPROVALS = _PENDING_APPROVALS\.filter/);
  assert.match(promotion, /await loadApprovalPanel\(\)/);
  assert.match(promotion, /_refreshNotifBell\(true\)/);
});

test('university entry year is stored separately and drives the list timeline', () => {
  assert.match(backend, /f_uniEntryYear:'UniEntryYear'/);
  assert.match(backend, /ensureCol\('Students', 'UniEntryYear'/);
  assert.match(studentForm, /id="f_uniEntryYear"/);
  assert.match(studentForm, /UniEntryYear: get\('f_uniEntryYear'\)/);
  assert.match(students, /function _universityTimeline\(student\)/);
  assert.match(students, /uniStudyTimeline/);
  assert.match(students, /uniTransferred/);
});

test('university promotion supports additional enrollment with stay or advance outcomes', () => {
  assert.match(promotion, /value="additional"/);
  assert.match(promotion, /function onAdditionalProgressChange/);
  assert.match(promotion, /promoAdditionalStay/);
  assert.match(promotion, /promoAdditionalPromote/);
  assert.match(promotion, /case 'additional':[\s\S]{0,180}additionalProgress === 'promote'/);
  assert.match(promotion, /\['promote', 'additional', 'uni', 'continue_inst'\]/);
});
