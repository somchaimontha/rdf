const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/i18n.js'), 'utf8');
function setup(saved, blocked = false) {
  const events = [];
  const element = (attrs, textContent) => ({ attrs, textContent,
    getAttribute(key) { return this.attrs[key]; },
    setAttribute(key, value) { this.attrs[key] = value; } });
  const label = element({ 'data-t': 'loginBtn' }, 'เข้าสู่ระบบ');
  const input = element({ 'data-t': 'searchPlaceholder', 'data-t-attr': 'placeholder' }, '');
  input.value = 'ข้อมูลที่ยังไม่ได้บันทึก';
  const unknown = element({ 'data-t': 'unknown.key' }, 'Original label');
  const button = element({}, 'EN');
  const context = { RDF: { DEFAULT_LANG: 'th' },
    localStorage: { getItem() { if (blocked) throw Error(); return saved; }, setItem() { if (blocked) throw Error(); } },
    document: { documentElement: {}, querySelectorAll: () => [label, input, unknown],
      getElementById: () => button, addEventListener() {}, dispatchEvent: e => events.push(e) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source + ';globalThis.dictionary = T;', context);
  return { context, events, label, input, unknown, button };
}
test('invalid saved language and unavailable storage are safe', () => {
  for (const blocked of [false, true]) {
    const { context } = setup('invalid', blocked);
    assert.equal(context.LANG, 'th');
    context.setLang('en');
    assert.equal(context.t('loginBtn'), 'Login');
    context.setLang('invalid');
    assert.equal(context.LANG, 'th');
  }
});
test('switch updates labels, metadata, attributes and event without changing input', () => {
  const { context: c, events, label, input, unknown, button } = setup('th');
  c.setLang('en');
  assert.equal(label.textContent, c.t('loginBtn'));
  assert.equal(input.attrs.placeholder, c.t('searchPlaceholder'));
  assert.equal(input.value, 'ข้อมูลที่ยังไม่ได้บันทึก');
  assert.equal(unknown.textContent, 'Original label');
  assert.equal(c.document.documentElement.lang, 'en');
  assert.equal(button.textContent, 'TH');
  assert.equal(button.attrs.lang, 'th');
  assert.equal(events.length, 1);
  c.setLang('en');
  assert.equal(events.length, 1);
  c.setLang('th');
  assert.equal(label.textContent, 'เข้าสู่ระบบ');
  assert.equal(c.getLocale(), 'th-TH');
});
test('both dictionaries cover every literal translation key in HTML and shared JS', () => {
  const { context: c } = setup('th');
  assert.deepEqual(Object.keys(c.dictionary.th).sort(), Object.keys(c.dictionary.en).sort());
  const files = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  files.push(...fs.readdirSync(path.join(root, 'assets/js')).filter(f => f.endsWith('.js') && f !== 'i18n.js').map(f => 'assets/js/' + f));
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const match of content.matchAll(/(?:\bt\(['"]([^'"]+)['"]\)|data-t(?:-(?:placeholder|title|aria-label|alt))?=['"]([^'"]+)['"])/g)) {
      for (const lang of ['th', 'en']) assert.ok(Object.hasOwn(c.dictionary[lang], match[1] || match[2]), `${file}: ${lang}: ${match[1] || match[2]}`);
    }
    if (file.endsWith('.js')) new vm.Script(content, { filename: file });
    if (file.endsWith('.html')) for (const match of content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1], { filename: file });
  }
});

test('English dictionary contains no untranslated Thai interface strings', () => {
  const { context: c } = setup('th');
  for (const [key, value] of Object.entries(c.dictionary.en)) {
    assert.equal(/[ก-๙]/.test(value), false, key);
  }
});

test('canonical Thai levels, academic years, signature roles, and API messages localize safely', () => {
  const { context: c } = setup('th');
  assert.equal(c.formatLevel('มัธยมศึกษาปีที่ 4 (Grade 10)', 'en'), 'Grade 10');
  assert.equal(c.formatLevel('ปวช. ชั้นปีที่ 2', 'en'), 'Vocational Certificate — Year 2');
  assert.equal(c.formatLevel('ปวส. ชั้นปีที่ 1', 'en'), 'Higher Vocational Certificate — Year 1');
  assert.equal(c.formatLevel('ชั้นปีที่ 3', 'en'), "Bachelor's Degree — Year 3");
  assert.equal(c.formatAcademicYear(2025, 'en'), '2568 B.E. / 2025 C.E.');
  assert.equal(c.formatAcademicYear(2568, 'th'), 'ปีการศึกษา 2568');
  assert.equal(c.formatSignatoryRole('ผู้ตรวจสอบข้อมูล', 'en'), 'Data Reviewer');
  assert.equal(c.localizeApiMessage('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'loginFailed', 'en'), 'Incorrect username or password.');
  assert.equal(c.localizeApiMessage('ข้อมูลไม่ครบ / Missing fields', 'error', 'en'), 'Missing fields');
  assert.equal(c.localizeApiMessage('ข้อความใหม่จากเซิร์ฟเวอร์', 'error', 'en'), 'Error');
});

test('known dynamic English views do not contain the previous Thai-only labels', () => {
  const checks = {
    'students.html': ['ปวช. Yr.', '>ปีสุดท้าย</span>', '<span>อนุมัติทุน ม.</span>', 'tags.push(`ค้นหา:', 'tags.push(`ปีการศึกษา '],
    'academic-results.html': ["textContent = 'อัปเดต: '", "title=\"${isEN?'ลบผลการเรียน':'ลบผลการเรียน'}\"", '> ล้างกลุ่มนี้', '>ไม่พบข้อมูลผลการเรียน</td>'],
    'academic-terms.html': ['title="แก้ไข"', 'title="แจ้งเตือน"', 'title="ลบ"', 'sel.innerHTML = `<option value="">— เลือกปีการศึกษา —</option>`', '>ไม่พบนักเรียนที่กำลังศึกษาในสถานศึกษานี้</div>'],
  };
  for (const [file, snippets] of Object.entries(checks)) {
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const snippet of snippets) assert.equal(content.includes(snippet), false, `${file}: ${snippet}`);
  }
});

test('report capture restores screen language even when capture fails', () => {
  const { context: c, events } = setup('th');
  const reports = fs.readFileSync(path.join(root, 'reports.html'), 'utf8');
  const captureSource = reports.slice(reports.indexOf('function captureReportCharts('), reports.indexOf('function doRptPrint('));
  const renderedLanguages = [];
  c.buildAllCharts = () => renderedLanguages.push(c.LANG);
  c._CHARTS = { status: { stop() {}, update() {} } };
  c._captureChart = () => { assert.equal(c.LANG, 'en'); throw new Error('capture failed'); };
  vm.runInContext(captureSource, c);
  assert.throws(() => c.captureReportCharts(['status'], 'en'), /capture failed/);
  assert.equal(c.LANG, 'th');
  assert.deepEqual(renderedLanguages, ['en', 'th']);
  assert.equal(events.length, 0);
});
