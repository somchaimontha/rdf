const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');

class Range {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    Object.assign(this, { sheet, row, column, rowCount, columnCount });
  }
  read() {
    return Array.from({ length:this.rowCount }, (_, r) =>
      Array.from({ length:this.columnCount }, (_, c) => this.sheet.rows[this.row - 1 + r]?.[this.column - 1 + c] ?? ''));
  }
  getValues() { return this.read(); }
  getDisplayValues() { return this.read().map(row => row.map(value => String(value ?? ''))); }
  getValue() { return this.read()[0]?.[0] ?? ''; }
  setValue(value) { return this.setValues([[value]]); }
  setValues(values) {
    values.forEach((source, r) => {
      const rowIndex = this.row - 1 + r;
      while (this.sheet.rows.length <= rowIndex) this.sheet.rows.push([]);
      source.forEach((value, c) => { this.sheet.rows[rowIndex][this.column - 1 + c] = value; });
    });
    return this;
  }
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
  appendRow(row) { this.rows.push([...row]); }
  setFrozenRows() {}
}

function setup() {
  const sheets = new Map([
    ['Students', new Sheet('Students', [
      ['StipNo','IDCard','BirthYear','BirthMonth','BirthDay','StudentID','Status','FirstName','LastName','EngFirstName','EngLastName','Phone1','Email','ProfilePicURL','UpdatedAt'],
      ['MBS_001','1111111111111','2005','5','10','S001','Active','มะลิ','ใจดี','Mali','Jaidee','0811111111','','https://example.com/mali.jpg',''],
      ['MBS_002','2222222222222','2005','','','S002','Active','มานะ','ดี','Mana','Dee','0822222222','used@example.com','',''],
      ['MBS_003','3333333333333','2004','4','9','S003','Resigned','สายใจ','มั่นคง','Saijai','Mankhong','0833333333','','',''],
      ['MBS_004','4444444444444','2003','3','8','S004','Incomplete','กล้า','เรียนรู้','Kla','Rianru','0844444444','','',''],
    ])],
    ['Admins', new Sheet('Admins', [['Username','Password','Role','FirstName','LastName','Email','Status']])],
    ['Logs', new Sheet('Logs', [['Timestamp','User','Action','Details']])],
  ]);
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) { const sheet = new Sheet(name); sheets.set(name, sheet); return sheet; },
  };
  const properties = new Map();
  const cache = new Map();
  const emails = [];
  const mailState = { quota:100, fail:false };
  let uuid = 0;
  const props = {
    getProperty(key) { return properties.has(key) ? properties.get(key) : null; },
    getProperties() { return Object.fromEntries(properties); },
    setProperty(key, value) { properties.set(key, String(value)); },
    deleteProperty(key) { properties.delete(key); },
  };
  const context = {
    SpreadsheetApp:{ openById() { return spreadsheet; }, flush() {} },
    CacheService:{ getScriptCache() { return { get:key => cache.get(key) || null, put(key, value) { cache.set(key, String(value)); }, remove(key) { cache.delete(key); } }; } },
    PropertiesService:{ getScriptProperties() { return props; } },
    LockService:{ getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } },
    Utilities:{
      DigestAlgorithm:{ SHA_256:'sha256' }, Charset:{ UTF_8:'utf8' },
      computeDigest(_algorithm, value) { return [...crypto.createHash('sha256').update(String(value)).digest()]; },
      computeHmacSha256Signature(value, key) { return [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()]; },
      getUuid() { uuid += 1; return crypto.createHash('sha256').update(`uuid-${uuid}`).digest('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12}).*/, '$1-$2-$3-$4-$5'); },
      formatDate(value) { return new Date(value).toISOString(); },
    },
    MailApp:{
      sendEmail(to, subject, body) {
        if (mailState.fail) throw new Error('simulated mail failure');
        emails.push({ to, subject, body });
      },
      getRemainingDailyQuota() { return mailState.quota; }
    },
    Logger:{ log() {} }, console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
  return { c:context, sheets, properties, emails, mailState };
}

function emailCode(message) {
  const match = message.body.match(/verification code is:\s*(\d{6})/i);
  assert.ok(match, 'verification email must contain a six-digit code');
  return match[1];
}

function beginEnrollment(c, setupToken, email, birthDate, password, confirmations = {}) {
  return c.beginStudentFirstLogin(
    setupToken, email, birthDate, password,
    confirmations.identityConfirmed !== false,
    confirmations.birthDateConfirmed !== false,
    confirmations.nonGmailConfirmed !== false
  );
}

test('first login creates a usable password account without sending or requiring an email OTP', () => {
  const { c, sheets, emails } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  assert.equal(legacy.status, 'setup_required');
  assert.ok(legacy.setupToken);
  assert.equal(legacy.sessionToken, undefined);
  assert.equal(legacy.name, 'มะลิ ใจดี');
  assert.equal(legacy.pic, 'https://example.com/mali.jpg');
  assert.equal(legacy.existingEmail, '');
  assert.equal(legacy.birthDate, '2005-05-10');
  assert.equal(legacy.birthYear, '2005');
  assert.equal(c._isGmailAddress('mali@gmail.com'), true);
  assert.equal(c._isGmailAddress('mali@googlemail.com'), true);
  assert.equal(c._isGmailAddress('mali@example.com'), false);
  const concurrentSetup = c.handleLogin('1111111111111', '2005', 'student');
  assert.equal(concurrentSetup.status, 'setup_required');
  assert.equal(c.handleLogin('3333333333333', '2004', 'student').status, 'setup_required', 'former students remain eligible');
  assert.equal(c.handleLogin('4444444444444', '2003', 'student').status, 'setup_required', 'students with incomplete records can fix their profile');
  const existingProfile = c.handleLogin('2222222222222', '2005', 'student');
  assert.equal(existingProfile.existingEmail, 'used@example.com');
  assert.equal(existingProfile.birthDate, '');
  assert.equal(c.handleLogin('used@example.com', '2005', 'student').status, 'error',
    'an email stored only in the student profile must not be accepted for sign-in');
  assert.equal(c._findStudentAuthByVerifiedEmail('used@example.com'), null);

  assert.equal(beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1', { identityConfirmed:false }).code, 'STUDENT_IDENTITY_CONFIRM_REQUIRED');
  assert.equal(beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1', { nonGmailConfirmed:false }).code, 'STUDENT_NON_GMAIL_CONFIRM_REQUIRED');
  assert.equal(beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1', { birthDateConfirmed:false }).code, 'STUDENT_BIRTH_DATE_CONFIRM_REQUIRED');
  const mismatch = beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-11', 'SecurePass1');
  assert.equal(mismatch.code, 'STUDENT_BIRTH_DATE_MISMATCH');
  assert.equal(beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', `A1${'a'.repeat(127)}`).code, 'STUDENT_PASSWORD_POLICY');
  const duplicate = beginEnrollment(c, legacy.setupToken, 'used@example.com', '2005-05-10', 'SecurePass1');
  assert.equal(duplicate.code, 'STUDENT_EMAIL_IN_USE');

  const begun = beginEnrollment(c, legacy.setupToken, 'Mali@Example.com', '2005-05-10', 'SecurePass1');
  assert.equal(begun.status, 'success');
  assert.equal(begun.role, 'Student');
  assert.ok(begun.sessionToken);
  assert.equal(begun.email, 'mali@example.com');
  assert.equal(begun.emailVerified, false);
  assert.equal(emails.length, 0, 'first-login setup must not consume email quota');

  const studentRows = sheets.get('Students').rows;
  assert.equal(studentRows[1][studentRows[0].indexOf('Email')], 'mali@example.com');
  const authRows = sheets.get('StudentAuth').rows;
  const hash = authRows[1][authRows[0].indexOf('PasswordHash')];
  assert.equal(authRows[1][authRows[0].indexOf('VerifiedEmail')], 'mali@example.com');
  const emailVerifiedAtIndex = authRows[0].indexOf('EmailVerifiedAt');
  assert.equal(authRows[1][emailVerifiedAtIndex], '');
  assert.equal(c._findStudentAuthByVerifiedEmail('mali@example.com'), null,
    'email sign-in must remain disabled until email verification is recorded');
  studentRows[1][studentRows[0].indexOf('Email')] = 'changed-by-staff@example.com';
  assert.equal(
    beginEnrollment(c, c.handleLogin('3333333333333', '2004', 'student').setupToken, 'mali@example.com', '2004-04-09', 'FormerPass3').code,
    'STUDENT_EMAIL_IN_USE',
    'verified recovery email remains unique even if staff later changes the profile email'
  );
  assert.equal(beginEnrollment(c, concurrentSetup.setupToken, 'other@example.com', '2005-05-10', 'OtherPass2').code, 'STUDENT_SETUP_ALREADY_COMPLETED');
  assert.match(hash, /^hmac-sha256:/);
  assert.equal(hash.includes('SecurePass1'), false);
  assert.equal(c.completeStudentFirstLogin(legacy.setupToken, '000000').code, 'STUDENT_SETUP_EXPIRED');

  assert.equal(c.handleLogin('1111111111111', '2005', 'student').status, 'error');
  const passwordLogin = c.handleLogin('1111111111111', 'SecurePass1', 'student');
  assert.equal(passwordLogin.status, 'success');
  assert.equal(passwordLogin.emailVerified, false);
  assert.equal(c.handleLogin('MALI@EXAMPLE.COM', 'SecurePass1', 'student').status, 'error');

  const verification = c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  assert.equal(verification.status, 'success');
  assert.equal(emails.length, 1);
  const verified = c.verifyStudentEmail({ username:'MBS_001', role:'Student' }, emailCode(emails[0]));
  assert.equal(verified.status, 'success');
  assert.equal(verified.emailVerified, true);
  assert.ok(c._findStudentAuthByVerifiedEmail('MALI@EXAMPLE.COM'), 'verified email lookup must be case-insensitive');
  assert.equal(c.handleLogin('MALI@EXAMPLE.COM', 'SecurePass1', 'student').status, 'success');
});

test('student password recovery uses only the verified email and rotates the stored password', () => {
  const { c, emails } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1');
  c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  c.verifyStudentEmail({ username:'MBS_001', role:'Student' }, emailCode(emails[0]));

  const unknown = c.requestPasswordReset('missing@example.com', 'https://somchaimontha.github.io/rdf/', 'student');
  assert.equal(unknown.status, 'success');
  assert.equal(emails.length, 1, 'unknown email must not reveal account existence or send mail');

  const requested = c.requestPasswordReset('mali@example.com', 'https://evil.example/phish', 'student');
  assert.equal(requested.status, 'success');
  assert.equal(emails.length, 2);
  assert.match(emails[1].body, /https:\/\/somchaimontha\.github\.io\/rdf\/\?rt=/);
  const token = emails[1].body.match(/[?&]rt=([a-f0-9]+)/i)[1];
  const reset = c.confirmPasswordReset(token, 'NewSecure2');
  assert.deepEqual(JSON.parse(JSON.stringify(reset)), { status:'success', accountType:'student' });
  assert.equal(c.confirmPasswordReset(token, 'AnotherPass3').status, 'error', 'reset token must be single-use');
  assert.equal(c.handleLogin('1111111111111', 'SecurePass1', 'student').status, 'error');
  assert.equal(c.handleLogin('1111111111111', 'NewSecure2', 'student').status, 'success');
});

test('deferred student email OTP can be resent and delivery failures do not block account access', () => {
  const { c, emails, mailState, sheets } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  const begun = beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1');
  assert.equal(begun.status, 'success');
  assert.equal(emails.length, 0);
  const session = { username:'MBS_001', role:'Student' };
  assert.equal(c.requestStudentEmailVerification(session).status, 'success');
  const firstCode = emailCode(emails[0]);
  const resent = c.requestStudentEmailVerification(session);
  assert.equal(resent.status, 'success');
  assert.equal(emails.length, 2);
  const secondCode = emailCode(emails[1]);
  assert.notEqual(secondCode, firstCode);
  assert.equal(c.verifyStudentEmail(session, firstCode).code, 'STUDENT_VERIFICATION_INVALID');
  assert.equal(c.verifyStudentEmail(session, secondCode).status, 'success');

  const quotaSetup = setup();
  const quotaLegacy = quotaSetup.c.handleLogin('1111111111111', '2005', 'student');
  assert.equal(beginEnrollment(quotaSetup.c, quotaLegacy.setupToken, 'quota@gmail.com', '2005-05-10', 'SecurePass1').status, 'success');
  quotaSetup.mailState.quota = 0;
  const quotaResult = quotaSetup.c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  assert.equal(quotaResult.code, 'STUDENT_EMAIL_QUOTA_EXHAUSTED');
  assert.equal(quotaSetup.emails.length, 0);
  const logRows = quotaSetup.sheets.get('Logs').rows.flat().join(' ');
  assert.match(logRows, /STUDENT_EMAIL_VERIFICATION_FAILED/);
  assert.equal(quotaSetup.c.handleLogin('1111111111111', 'SecurePass1', 'student').status, 'success');

  quotaSetup.mailState.quota = 100;
  quotaSetup.mailState.fail = true;
  const failed = quotaSetup.c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  assert.equal(failed.code, 'STUDENT_EMAIL_SEND_FAILED');
  assert.equal(JSON.stringify(sheets.get('StudentAuth')?.rows || []).includes(firstCode), false, 'OTP must never be stored in plain text');
});

test('Google student sign-in requires a Google-verified email linked to completed student setup', () => {
  const { c, emails } = setup();
  let tokenInfo = { email:'mali@example.com', email_verified:'true' };
  c.UrlFetchApp = { fetch() { return { getContentText() { return JSON.stringify(tokenInfo); } }; } };

  assert.equal(c.loginWithGoogle('token-before-setup', 'student').code, 'STUDENT_GOOGLE_EMAIL_NOT_LINKED');
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1');
  assert.equal(c.loginWithGoogle('token-before-verification', 'student').code, 'STUDENT_GOOGLE_EMAIL_NOT_LINKED');
  c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  c.verifyStudentEmail({ username:'MBS_001', role:'Student' }, emailCode(emails[0]));

  const signedIn = c.loginWithGoogle('valid-token', 'student');
  assert.equal(signedIn.status, 'success');
  assert.equal(signedIn.role, 'Student');
  assert.equal(signedIn.stipNo, 'MBS_001');
  assert.equal(signedIn.email, 'mali@example.com');
  assert.ok(signedIn.sessionToken);

  tokenInfo = { email:'mali@example.com', email_verified:'false' };
  assert.equal(c.loginWithGoogle('unverified-token', 'student').code, 'GOOGLE_EMAIL_UNVERIFIED');
});

test('authorized staff can manage the recovery email without resetting the password', () => {
  const { c, sheets, properties, emails } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  beginEnrollment(c, legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1');
  c.requestStudentEmailVerification({ username:'MBS_001', role:'Student' });
  c.verifyStudentEmail({ username:'MBS_001', role:'Student' }, emailCode(emails[0]));

  c.requestPasswordReset('mali@example.com', 'https://somchaimontha.github.io/rdf/', 'student');
  assert.ok([...properties.keys()].some(key => key.startsWith('RESET_')), 'an outstanding reset token should exist before the email change');

  const authSheet = sheets.get('StudentAuth');
  const authHeaders = authSheet.rows[0];
  const authRow = authSheet.rows[1];
  const passwordHash = authRow[authHeaders.indexOf('PasswordHash')];
  const passwordSalt = authRow[authHeaders.indexOf('PasswordSalt')];
  const manager = { username:'staff@example.com', role:'Manager' };
  const summary = c.getStudentAccountForAdmin(manager, 'MBS_001');
  assert.equal(summary.status, 'success');
  assert.equal(summary.data.accountConfigured, true);
  assert.equal(summary.data.recoveryEmail, 'mali@example.com');
  assert.equal(JSON.stringify(summary).includes(passwordHash), false, 'account summary must never expose password hashes');

  const emailCountBeforeUpdate = emails.length;
  const updated = c.updateStudentAccountEmail(manager, 'MBS_001', 'NewRecovery@Gmail.com');
  assert.equal(updated.status, 'success');
  assert.equal(updated.passwordChanged, false);
  assert.equal(updated.resetEmailSent, false);
  assert.equal(updated.data.profileEmail, 'newrecovery@gmail.com');
  assert.equal(updated.data.recoveryEmail, 'newrecovery@gmail.com');
  assert.equal(emails.length, emailCountBeforeUpdate, 'admin email management must not send a password-reset email');
  assert.equal([...properties.keys()].some(key => key.startsWith('RESET_')), false, 'outstanding reset links must be revoked');
  assert.equal(authRow[authHeaders.indexOf('PasswordHash')], passwordHash);
  assert.equal(authRow[authHeaders.indexOf('PasswordSalt')], passwordSalt);
  assert.equal(authRow[authHeaders.indexOf('EmailManagedBy')], 'staff@example.com');
  assert.equal(c.handleLogin('1111111111111', 'SecurePass1', 'student').status, 'success');
  assert.equal(c.handleLogin('mali@example.com', 'SecurePass1', 'student').status, 'error');
  assert.equal(c.handleLogin('NEWRECOVERY@GMAIL.COM', 'SecurePass1', 'student').status, 'success');

  c.requestPasswordReset('mali@example.com', 'https://somchaimontha.github.io/rdf/', 'student');
  assert.equal(emails.length, emailCountBeforeUpdate, 'the previous email must no longer receive recovery mail');
  c.requestPasswordReset('newrecovery@gmail.com', 'https://somchaimontha.github.io/rdf/', 'student');
  assert.equal(emails.length, emailCountBeforeUpdate + 1, 'future recovery requests must use the new email');

  const denied = c.updateStudentAccountEmail({ username:'MBS_001', role:'Student' }, 'MBS_001', 'other@gmail.com');
  assert.equal(denied.code, 'ACCESS_DENIED');
  assert.equal(c.updateStudentAccountEmail(manager, 'MBS_001', 'used@example.com').code, 'STUDENT_EMAIL_IN_USE');

  const pending = c.updateStudentAccountEmail(manager, 'MBS_002', 'pending@gmail.com');
  assert.equal(pending.status, 'success');
  assert.equal(pending.data.accountConfigured, false);
  assert.equal(pending.data.profileEmail, 'pending@gmail.com');
  assert.equal(pending.data.recoveryEmail, '', 'pre-enrollment email remains subject to first-login verification');
  assert.equal(authSheet.rows.filter(row => row[0] === 'MBS_002').length, 0, 'email management must not create a password account');
});

test('first-login UI defers email OTP and exposes persistent verification reminders', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const auth = fs.readFileSync(path.join(root, 'assets/js/auth.js'), 'utf8');
  assert.match(html, /data-t="studentLoginIdentifier"/);
  assert.match(html, /role === 'student' \? 'studentLoginIdentifier' : 'username'/);
  assert.match(html, /id="googleLoginSection"[\s\S]*?data-t="studentLoginWithGoogle"/);
  assert.match(html, /handleGoogleLogin\(response\.credential, _currentRole\)/);
  assert.doesNotMatch(html, /API\.resendStudentFirstLoginCode\(setupToken\)/);
  assert.match(html, /studentSetupCreateAccount/);
  assert.match(auth, /API\.requestStudentEmailVerification\(\)/);
  assert.match(auth, /API\.verifyStudentEmail\(codeModal\.value\)/);
  assert.match(auth, /studentEmailVerificationBanner/);
  assert.match(auth, /student-email-unverified/);
  assert.match(html, /studentPasswordResetEmailLabel/);
  assert.match(html, /id="fpIdentifier"[\s\S]*?width:100%/);
  assert.match(html, /studentSetupProfileCard\(loginResult\)/);
  assert.match(html, /studentSetupExistingEmail/);
  assert.match(html, /\.student-setup-input\s*\{[\s\S]*?width:100%/);
  assert.match(html, /studentSetupBirthDateText\(existingBirthDate\)/);
  assert.match(html, /formatAppDate\(isoDate, 'en'\)/);
  assert.match(html, /formatAppDate\(isoDate, 'th'\)/);
  assert.match(html, /studentSetupBindPasswordToggle/);
  assert.match(html, /reviewStudentFirstLogin/);
  assert.match(html, /studentSetupReviewPasswordStored/);
});

test('student edit UI provides a separate admin account-email control', () => {
  const html = fs.readFileSync(path.join(root, 'student-form.html'), 'utf8');
  const api = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
  assert.match(html, /id="studentAccountEmailAdmin"/);
  assert.match(html, /id="studentAccountRecoveryEmail"[\s\S]*?style="width:100%"/);
  assert.match(html, /API\.updateStudentAccountEmail\(editStipNo, email\)/);
  assert.match(html, /formatAppDateTime\(data\.emailUpdatedAt, LANG\)/);
  assert.match(api, /updateStudentAccountEmail\(stipNo, email\)/);
});
