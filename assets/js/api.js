/* ── RDF API Calls ── */

/* ── Drive image URL normalizer ── */
function driveImgUrl(url, sz) {
  if (!url) return '';
  sz = sz || 'w400';
  // Already a thumbnail URL — just update sz
  if (url.includes('drive.google.com/thumbnail')) {
    return url.replace(/[?&]sz=[^&]*/g, '').replace(/\?$/, '') + (url.includes('?') ? '&sz=' + sz : '?sz=' + sz);
  }
  // Extract file ID from any Drive URL format
  const m = url.match(/\/d\/([^/?#&]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=${sz}`;
  return url; // Not a Drive URL — return as-is
}

function avatarUrl(name, size) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=1e3a8a&color=fff&bold=true&size=${size || 64}`;
}

function _getToken() {
  try { return (JSON.parse(localStorage.getItem('rdfUser')) || {}).sessionToken || ''; } catch { return ''; }
}

async function apiGet(params, timeoutMs) {
  const token = _getToken();
  const p = token ? { ...params, token } : { ...params };
  const url = RDF.GAS_URL + '?' + new URLSearchParams(p).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('การเชื่อมต่อหมดเวลา กรุณาลองใหม่');
    throw e;
  }
  clearTimeout(timer);
  const data = await res.json();
  if (data.status === 'error' && data.message === 'Unauthorized. Please login again.') {
    // Session expired — force re-login (only if NOT already on the login page)
    const path = window.location.pathname;
    const onLogin = path.endsWith('index.html') || path.endsWith('/') || path === '';
    if (!onLogin) {
      localStorage.removeItem('rdfUser');
      window.location.href = 'index.html?expired=1';
    }
  }
  return data;
}

async function apiPost(body, timeoutMs) {
  const token = _getToken();
  const b = token ? { ...body, token } : { ...body };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
  let res;
  try {
    res = await fetch(RDF.GAS_URL, {
      method: 'POST',
      body: JSON.stringify(b),
      headers: { 'Content-Type': 'text/plain' },
      signal: ctrl.signal
    });
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('การเชื่อมต่อหมดเวลา กรุณาลองใหม่');
    throw e;
  }
  clearTimeout(timer);
  const data = await res.json();
  if (data.status === 'error' && data.message === 'Unauthorized. Please login again.') {
    const path = window.location.pathname;
    const onLogin = path.endsWith('index.html') || path.endsWith('/') || path === '';
    if (!onLogin) {
      localStorage.removeItem('rdfUser');
      window.location.href = 'index.html?expired=1';
    }
  }
  return data;
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
  async loginWithGoogle(idToken)   { return apiPost({ action: 'loginWithGoogle', idToken }); },
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
  async mergeStudentRows(primaryRowIdx, mergeRowIdx) {
    return apiPost({ action: 'mergeStudentRows', primaryRowIdx, mergeRowIdx, reqUser: (getUser()||{}).username||'Admin' });
  },
  async getStudentsForPromotion()        { return apiGet({ action: 'getStudentsForPromotion' }); },
  async getPendingScholarshipRequests()  { return apiGet({ action: 'getPendingScholarshipRequests' }); },
  async promoteStudents(promotions, reqUser, promotionDate, sendEmailNotif) {
    return apiPost({ action: 'promoteStudents', promotions, reqUser, promotionDate,
      sendEmailNotif: sendEmailNotif === true });
  },
  async addUniTransfer(data, reqUser) {
    return apiPost({ action: 'addUniTransfer', data, reqUser });
  },
  async changeAdminPassword(username, currentPassword, newPassword) {
    return apiPost({ action: 'changeAdminPassword', username, currentPassword, newPassword });
  },
  async getPromotionHistory(batchID) {
    return apiGet({ action: 'getPromotionHistory', batchID: batchID || '' });
  },
  // Generic helpers for pages that call API.get / API.post directly
  async get(action, params) { return apiGet({ action, ...(params||{}) }); },
  async post(action, body)  { return apiPost({ action, ...body }); },
  // Client-side error/warning logger — fire-and-forget, never throws
  clientLog(userId, action, details) {
    apiPost({ action: 'clientLog', userId, action, details }).catch(() => {});
  },
};

// ── RDF Client Logger ─────────────────────────────────────────────────────
// Lightweight, async, non-blocking. Dedup is enforced both client-side
// (same message within 10 s) and server-side (same row within 60 s).
//
// Usage (from any page):
//   RDF.logError('student-form.html', 'saveStudent()', 'Failed to save: timeout');
//   RDF.logWarn('settings.html', 'loadAdmins()', 'No admins returned');
// ─────────────────────────────────────────────────────────────────────────
(function() {
  const _recentKeys = new Map(); // key → timestamp for client-side dedup (10 s)
  const DEDUP_MS = 10000;

  function _send(level, page, fn, message) {
    // Build canonical strings
    const action  = level;                               // 'ERROR' | 'WARNING'
    const details = `${message} (${page}${fn ? ' — ' + fn : ''})`;
    const user    = (() => { try { return (getUser()||{}).username || 'anonymous'; } catch(e){ return 'anonymous'; } })();
    const key     = user + '|' + action + '|' + details;

    // Client-side dedup: same key within DEDUP_MS → skip
    const now = Date.now();
    if (_recentKeys.has(key) && now - _recentKeys.get(key) < DEDUP_MS) return;
    _recentKeys.set(key, now);

    // Prune old keys to avoid memory leak (keep ≤ 50)
    if (_recentKeys.size > 50) {
      const oldest = [..._recentKeys.entries()]
        .sort((a, b) => a[1] - b[1]).slice(0, 20).map(e => e[0]);
      oldest.forEach(k => _recentKeys.delete(k));
    }

    // Fire-and-forget — never blocks or throws
    API.clientLog(user, action, details);
  }

  RDF.logError = (page, fn, message) => _send('ERROR',   page, fn, message);
  RDF.logWarn  = (page, fn, message) => _send('WARNING', page, fn, message);
})();

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
  const stipNo = student.StipNo || student.stipNo || '';
  const inst   = student.Institution || student.institution || '';
  return inst === 'UNI' && (stipNo.startsWith('MBS_') || stipNo.startsWith('VC_'));
}
