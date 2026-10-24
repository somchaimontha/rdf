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
      ['MBS_001','1111111111111','2005','5','10','S001','Active','มะลิ','ใจดี','Mali','Jaidee','0811111111','','',''],
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
  let uuid = 0;
  const props = {
    getProperty(key) { return properties.has(key) ? properties.get(key) : null; },
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
    MailApp:{ sendEmail(to, subject, body) { emails.push({ to, subject, body }); }, getRemainingDailyQuota() { return 100; } },
    Logger:{ log() {} }, console,
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), context);
  return { c:context, sheets, properties, emails };
}

function emailCode(message) {
  const match = message.body.match(/verification code is:\s*(\d{6})/i);
  assert.ok(match, 'verification email must contain a six-digit code');
  return match[1];
}

test('legacy student login requires verified first-login enrollment before issuing a session', () => {
  const { c, sheets, emails } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  assert.equal(legacy.status, 'setup_required');
  assert.ok(legacy.setupToken);
  assert.equal(legacy.sessionToken, undefined);
  const concurrentSetup = c.handleLogin('1111111111111', '2005', 'student');
  assert.equal(concurrentSetup.status, 'setup_required');
  assert.equal(c.handleLogin('3333333333333', '2004', 'student').status, 'setup_required', 'former students remain eligible');
  assert.equal(c.handleLogin('4444444444444', '2003', 'student').status, 'setup_required', 'students with incomplete records can fix their profile');

  const mismatch = c.beginStudentFirstLogin(legacy.setupToken, 'mali@example.com', '2005-05-11', 'SecurePass1');
  assert.equal(mismatch.code, 'STUDENT_BIRTH_DATE_MISMATCH');
  assert.equal(c.beginStudentFirstLogin(legacy.setupToken, 'mali@example.com', '2005-05-10', `A1${'a'.repeat(127)}`).code, 'STUDENT_PASSWORD_POLICY');
  const duplicate = c.beginStudentFirstLogin(legacy.setupToken, 'used@example.com', '2005-05-10', 'SecurePass1');
  assert.equal(duplicate.code, 'STUDENT_EMAIL_IN_USE');

  const begun = c.beginStudentFirstLogin(legacy.setupToken, 'Mali@Example.com', '2005-05-10', 'SecurePass1');
  assert.equal(begun.status, 'success');
  assert.equal(emails.length, 1);
  const completed = c.completeStudentFirstLogin(legacy.setupToken, emailCode(emails[0]));
  assert.equal(completed.status, 'success');
  assert.equal(completed.role, 'Student');
  assert.ok(completed.sessionToken);

  const studentRows = sheets.get('Students').rows;
  assert.equal(studentRows[1][studentRows[0].indexOf('Email')], 'mali@example.com');
  const authRows = sheets.get('StudentAuth').rows;
  const hash = authRows[1][authRows[0].indexOf('PasswordHash')];
  assert.equal(authRows[1][authRows[0].indexOf('VerifiedEmail')], 'mali@example.com');
  studentRows[1][studentRows[0].indexOf('Email')] = 'changed-by-staff@example.com';
  assert.equal(
    c.beginStudentFirstLogin(c.handleLogin('3333333333333', '2004', 'student').setupToken, 'mali@example.com', '2004-04-09', 'FormerPass3').code,
    'STUDENT_EMAIL_IN_USE',
    'verified recovery email remains unique even if staff later changes the profile email'
  );
  assert.equal(c.beginStudentFirstLogin(concurrentSetup.setupToken, 'other@example.com', '2005-05-10', 'OtherPass2').code, 'STUDENT_SETUP_ALREADY_COMPLETED');
  assert.match(hash, /^hmac-sha256:/);
  assert.equal(hash.includes('SecurePass1'), false);
  assert.equal(c.completeStudentFirstLogin(legacy.setupToken, emailCode(emails[0])).code, 'STUDENT_SETUP_EXPIRED');

  assert.equal(c.handleLogin('1111111111111', '2005', 'student').status, 'error');
  assert.equal(c.handleLogin('1111111111111', 'SecurePass1', 'student').status, 'success');
});

test('student password recovery uses only the verified email and rotates the stored password', () => {
  const { c, emails } = setup();
  const legacy = c.handleLogin('1111111111111', '2005', 'student');
  c.beginStudentFirstLogin(legacy.setupToken, 'mali@example.com', '2005-05-10', 'SecurePass1');
  c.completeStudentFirstLogin(legacy.setupToken, emailCode(emails[0]));

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
