const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const reports = fs.readFileSync(path.join(root, 'reports.html'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'student-profile.html'), 'utf8');
const settings = fs.readFileSync(path.join(root, 'settings.html'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'assets/js/auth.js'), 'utf8');
const tracking = fs.readFileSync(path.join(root, 'tracking-management.html'), 'utf8');
const rbac = fs.readFileSync(path.join(root, 'assets/js/rbac.js'), 'utf8');
const academicResults = fs.readFileSync(path.join(root, 'academic-results.html'), 'utf8');
const code = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');

test('academic results show complete bilingual student identity and use the selected report language', () => {
  assert.match(code, /EngTitle:\s+_c\(row, 'EngTitle'\)/);
  assert.match(academicResults, /function academicThaiName/);
  assert.match(academicResults, /function academicEnglishName/);
  assert.match(academicResults, /function academicStudentMajor/);
  assert.match(academicResults, /function academicStudentPhotoSrc/);
  assert.match(academicResults, /data-t="arColNo">ที่</);
  assert.match(academicResults, /T\[lang\]\.arColNo/);
  assert.match(academicResults, /T\[lang\]\.arColMajor/);
  assert.match(academicResults, /bi\('ปีการศึกษา ','Academic Year ',lang\)/);
  assert.match(academicResults, /formatLevel\(r\.level,lang\)/);
  assert.match(academicResults, /const L = T\[lang\]/);
  assert.doesNotMatch(academicResults, /<th[^>]*>#<\/th>/);
});

test('employment report keeps grouped columns compact and follow-up notes last', () => {
  const fields = reports.slice(reports.indexOf('const EMPLOYMENT_REPORT_FIELDS'), reports.indexOf('function employmentReportText'));
  assert.match(fields, /identitySummary[\s\S]*educationFunding[\s\S]*employmentSummary[\s\S]*workplaceSummary[\s\S]*periodSummary[\s\S]*followUpSummary/);
  assert.match(fields, /followUpNotes[^\n]*recommended:true/);
  assert.ok(fields.lastIndexOf("key:'lastUpdated'") > fields.lastIndexOf("key:'assignedTo'"));
  assert.ok(fields.lastIndexOf("key:'followUpNotes'") > fields.lastIndexOf("key:'assignedTo'"));
});

test('employment reporting uses a shared period scope and exposes follow-up timestamps', () => {
  assert.match(reports, /id="empPeriodAsOf"/);
  assert.match(reports, /id="empPeriodFrom"/);
  assert.match(reports, /id="empPeriodTo"/);
  assert.match(reports, /id="empPeriodAsOfDisplay"/);
  assert.match(reports, /id="empPeriodFromDisplay"/);
  assert.match(reports, /id="empPeriodToDisplay"/);
  assert.match(reports, /function renderEmploymentPeriodInputDates/);
  assert.match(reports, /class="emp-date-native"/);
  assert.match(reports, /function applyEmploymentPeriod/);
  assert.match(reports, /followUpFrom:_EMP_PERIOD\.from,followUpTo:_EMP_PERIOD\.to/);
  assert.match(reports, /data-t="empColLastFollowUp"/);
  assert.match(reports, /data-t="empColLastUpdated"/);
  assert.match(reports, /id="empSavedPeriods"/);
  assert.match(reports, /function openTrackingCycleManager/);
  assert.match(reports, /API\.getTrackingCycleData/);
  assert.match(tracking, /function saveCycle/);
  assert.match(tracking, /tracking-management\.html/);
  assert.match(reports, /empFollowUpRecordCount/);
});

test('student profile reads and displays shared employment follow-up records', () => {
  assert.match(profile, /id="employmentFollowUpCard"/);
  assert.match(profile, /API\.getStudentEmploymentFollowUps\(stipNo\)/);
  assert.match(profile, /function renderProfileEmploymentFollowUps/);
});

test('employment preview changes paper shape and places QR beside the reference on the right', () => {
  assert.match(reports, /report-preview-page\[data-orientation="landscape"\][^{]*\{[^}]*aspect-ratio:297 \/ 210/);
  assert.match(reports, /report-preview-page\[data-orientation="portrait"\][^{]*\{[^}]*width:min\(70\.7%,520px\)[^}]*aspect-ratio:210 \/ 297/);
  assert.match(reports, /report-preview-verification[\s\S]*empPreviewQr/);
  assert.doesNotMatch(reports, /empComposerPageSetup',lang\)\)}:\s*\$\{escapeEmploymentHtml\(employmentReportText\(orientation/);
  assert.match(reports, /<div class="verification"><div class="reference">[\s\S]*<img class="qr"/);
});

test('shared signature settings support drawing, clearing, and signed-in recorder names', () => {
  assert.match(settings, /signature-pad-canvas/);
  assert.match(settings, /clearSignaturePad\(\$\{i\}\)/);
  assert.match(settings, /clearSignaturePad\(\$\{i\},true\)/);
  assert.match(settings, /output\.toDataURL\('image\/png'\)/);
  assert.match(auth, /reportIsDataRecorderRole/);
  assert.match(auth, /resolved\.name = String\(user\.name\)\.trim\(\)/);
  assert.match(auth, /reportSignatureMarkHtml/);
});

test('employment report composer supports report-specific on-screen signatures', () => {
  assert.match(reports, /report-signature-pad-canvas/);
  assert.match(reports, /function initializeEmploymentReportSignaturePad/);
  assert.match(reports, /output\.toDataURL\('image\/png'\)/);
  assert.match(reports, /function clearEmploymentReportSignature/);
  assert.match(reports, /_EMP_REPORT_SIGNATURE_DRAFTS/);
  assert.match(reports, /resetEmploymentReportSignatureDrafts\(\);[\s\S]*renderEmploymentReportSignatures\(false\)/);
});

test('employment follow-up settings reuse the central notification system', () => {
  assert.match(reports, /id="empFollowUpSettingsBtn"/);
  assert.match(reports, /id="empFollowUpSettingsModal"/);
  assert.match(reports, /API\.saveSetting\('NOTIFICATION_RULES',config\)/);
  assert.match(reports, /employmentNotificationConfig/);
  assert.match(reports, /empFltFollowUp/);
  assert.match(auth, /function _buildOperationalNotifications/);
  assert.match(auth, /API\.getNotificationFeed\(force\)/);
  assert.match(auth, /operationalEvents/);
});

test('volunteer UI permissions expose alumni workflows without exposing scholarship reports', () => {
  assert.match(rbac, /Volunteer:\s*\[[^\]]*'viewAlumni'[^\]]*'manageAlumniFollowUps'[^\]]*'manageSurveys'[^\]]*'exportAlumniReports'/s);
  assert.match(reports, /RBAC\.enforcePage\(\['viewReports','viewAlumniEmployment'\]\)/);
  assert.match(reports, /CAN_VIEW_SCHOLARSHIP_REPORTS \? API\.getStudents\(\)/);
  assert.match(reports, /CAN_EXPORT_EMPLOYMENT_REPORTS/);
  assert.match(rbac, /RBAC_PERMISSIONS_SCHEMA_VERSION = '2\.0\.0'/);
  assert.match(rbac, /_rbacUpgradePermissionMap/);
  assert.match(tracking, /'manageTrackingCycles'/);
  assert.match(auth, /_notifHas\('viewAlumniEmployment'\)/);
  assert.match(settings, /value="Volunteer"/);
  assert.match(settings, /const PERM_EDITABLE_ROLES = \['Manager','Finance','Committee','DormTeacher','Volunteer'\]/);
});
