/* ── RDF API Calls ── */

async function apiGet(params) {
  const url = RDF.GAS_URL + '?' + new URLSearchParams(params).toString();
  const res = await fetch(url);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(RDF.GAS_URL, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'text/plain' }
  });
  return res.json();
}

const API = {
  async getStudents()          { return apiGet({ action: 'getStudents' }); },
  async getStudent(stipNo)     { return apiGet({ action: 'getStudent', stipNo }); },
  async generateStipNo(inst)   { return apiGet({ action: 'generateStipNo', institution: inst }); },
  async deleteStudent(stipNo)  { return apiGet({ action: 'deleteStudent', stipNo }); },
  async getUniNames()          { return apiGet({ action: 'getUniNames' }); },
  async saveStudent(data)      { return apiPost({ action: 'saveStudent',   student: data }); },
  async updateStudent(data)    { return apiPost({ action: 'updateStudent', student: data }); },
  async getAdmins()               { return apiGet({ action: 'getAdmins' }); },
  async saveAdmin(data)            { return apiPost({ action: 'saveAdmin',   admin: data,   reqUser: (getUser()||{}).username||'' }); },
  async deleteAdmin(username)      { return apiPost({ action: 'deleteAdmin', username,      reqUser: (getUser()||{}).username||'' }); },
  async getSystemSettings()        { return apiGet({ action: 'getSystemSettings' }); },
  async saveSetting(key, values)   { return apiPost({ action: 'saveSetting', key, values,   reqUser: (getUser()||{}).username||'' }); },
  async getLogs(limit)             { return apiGet({ action: 'getLogs', limit: limit || 200 }); },
  async parseOCRText(text)                    { return apiPost({ action: 'parseOCRText', ocrText: text }); },
  async parseDocumentAI(base64, mimeType)     { return apiPost({ action: 'parseDocumentAI', base64, mimeType }); },
  async getApiKeyStatus()          { return apiGet({ action: 'getApiKeyStatus' }); },
  async saveApiKey(key)            { return apiPost({ action: 'saveApiKey', key, reqUser: (getUser()||{}).username||'' }); },
  async getActiveSessions()        { return apiGet({ action: 'getActiveSessions' }); },
  async clearSession(username)     { return apiPost({ action: 'clearSession', username }); },
  async uploadPhoto(base64, mimeType, filename, institution)              { return apiPost({ action: 'uploadPhoto',    base64, mimeType, filename, institution }); },
  async uploadDocument(base64, mimeType, filename, institution, stipNo)  { return apiPost({ action: 'uploadDocument', base64, mimeType, filename, institution, stipNo }); },
  async getStudentDocs(stipNo)                                           { return apiGet({ action: 'getStudentDocs', stipNo }); },
  async deletePhoto(fileId)   { return apiPost({ action: 'deletePhoto', fileId }); },
  async deleteFile(fileId)    { return apiPost({ action: 'deleteFile',  fileId }); },
  async countBlankRows()      { return apiGet({ action: 'countBlankRows' }); },
  async cleanBlankRows()      { return apiPost({ action: 'cleanBlankRows', reqUser: (getUser()||{}).username||'Admin' }); },
  async findDuplicates()      { return apiGet({ action: 'findDuplicates' }); },
  async mergeStudents(primaryStipNo, mergeStipNo) {
    return apiPost({ action: 'mergeStudents', primaryStipNo, mergeStipNo, reqUser: (getUser()||{}).username||'Admin' });
  },
};

/* ── Shared Loader ── */
function showLoader(show, text) {
  const el = document.getElementById('loader');
  if (!el) return;
  if (text) { const t = document.getElementById('loaderText'); if (t) t.textContent = text; }
  el.classList.toggle('hidden', !show);
}

/* ── Status badge HTML ── */
function statusBadge(status, lang) {
  const labels = lang === 'en' ? RDF.STATUS_LABELS_EN : RDF.STATUS_LABELS_TH;
  const color  = RDF.STATUS_COLORS[status] || 'badge-gray';
  return `<span class="badge ${color}">${labels[status] || status}</span>`;
}

/* ── Institution label ── */
function instLabel(code) { return RDF.INSTITUTION_LABELS[code] || code || '—'; }

/* ── Convert CE year to BE (Thai) ── */
function ceToBe(year) { return year ? parseInt(year) + 543 : '—'; }
function beToce(year) { return year ? parseInt(year) - 543 : '—'; }

/* ── Academic year list from students ── */
function getAcademicYears(students) {
  const years = new Set();
  students.forEach(s => {
    if (s.scholarshipYear) years.add(s.scholarshipYear);
    if (s.entryYear) years.add(s.entryYear);
  });
  return [...years].sort((a,b) => b - a);
}

/* ── DB Connection Status ── */
let _dbCheckTimer = null;

async function checkDBConnection() {
  const el  = document.getElementById('dbStatus');
  const txt = document.getElementById('dbStatusText');
  if (!el || !txt) return;

  el.className = 'db-status checking';
  txt.textContent = (typeof LANG !== 'undefined' && LANG === 'en') ? 'Checking...' : 'กำลังตรวจสอบ...';

  const t0 = Date.now();
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res   = await fetch(RDF.GAS_URL + '?action=ping', { signal: ctrl.signal });
    clearTimeout(timer);
    const data  = await res.json();
    const ms    = Date.now() - t0;
    if (data.status === 'ok') {
      el.className = 'db-status online';
      const label  = (typeof LANG !== 'undefined' && LANG === 'en') ? 'Connected' : 'เชื่อมต่อแล้ว';
      txt.textContent = `${label} (${ms} ms)`;
    } else {
      throw new Error('bad response');
    }
  } catch(e) {
    el.className = 'db-status offline';
    txt.textContent = (typeof LANG !== 'undefined' && LANG === 'en') ? 'Cannot connect' : 'ไม่สามารถเชื่อมต่อได้';
  }
}

function initDBStatus() {
  checkDBConnection();
  if (_dbCheckTimer) clearInterval(_dbCheckTimer);
  _dbCheckTimer = setInterval(checkDBConnection, 60000); // re-check every 60s
}

/* ── Check if student has "ทุนต่อ" (continued scholarship) ── */
function isContinuedScholarship(student) {
  const stipNo = student.stipNo || '';
  const inst   = student.institution || '';
  return inst === 'UNI' && (stipNo.startsWith('MBS_') || stipNo.startsWith('VC_'));
}
