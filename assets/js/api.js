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

/* ── Check if student has "ทุนต่อ" (continued scholarship) ── */
function isContinuedScholarship(student) {
  const stipNo = student.stipNo || '';
  const inst   = student.institution || '';
  return inst === 'UNI' && (stipNo.startsWith('MBS_') || stipNo.startsWith('VC_'));
}
