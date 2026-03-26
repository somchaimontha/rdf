/**
 * RDF Scholarship Management System — Backend API
 * Google Apps Script Web App
 * Copy this entire file into your Apps Script editor and Deploy as Web App.
 */

const db = SpreadsheetApp.getActiveSpreadsheet();

// ─────────────────────────────────────────────
// ROUTING
// ─────────────────────────────────────────────
function doGet(e) {
  let result = { status: 'error', message: 'Unknown error' };
  try {
    if (!e || !e.parameter || !e.parameter.action)
      return createJsonResponse({ status: 'error', message: 'No action specified.' });

    const action = e.parameter.action;
    if      (action === 'login')          result = handleLogin(e.parameter.id, e.parameter.pass, e.parameter.role);
    else if (action === 'getStudents')    result = getStudentsData();
    else if (action === 'getStudent')     result = getStudentByStipNo(e.parameter.stipNo);
    else if (action === 'generateStipNo') result = { status:'success', stipNo: generateNextStipNo(e.parameter.institution) };
    else if (action === 'deleteStudent')  result = deleteStudentData(e.parameter.stipNo);
    else if (action === 'countBlankRows') result = countBlankStipNoRows();
    else if (action === 'getUniNames')    result = getUniNames();
    else if (action === 'ping')           result = { status: 'ok', timestamp: new Date().toISOString() };
    else if (action === 'getAdmins')          result = getAdmins();
    else if (action === 'getSystemSettings')  result = getSystemSettings();
    else if (action === 'getLogs')            result = getLogs(parseInt(e.parameter.limit)||200);
    else if (action === 'getApiKeyStatus')    result = getApiKeyStatus();
    else if (action === 'getActiveSessions')  result = getActiveSessions();
    else if (action === 'getStudentDocs')     result = getStudentDocs(e.parameter.stipNo);
    else result = { status: 'error', message: 'Invalid action: ' + action };
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }
  return createJsonResponse(result);
}

function doPost(e) {
  let result = { status: 'error', message: 'Unknown error' };
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const student = body.student;
    if      (action === 'saveStudent')   result = saveStudentData(student);
    else if (action === 'updateStudent') result = updateStudentData(student);
    else if (action === 'saveAdmin')    result = saveAdmin(body.admin, body.reqUser);
    else if (action === 'deleteAdmin')  result = deleteAdmin(body.username, body.reqUser);
    else if (action === 'saveSetting')  result = saveSetting(body.key, body.values, body.reqUser);
    else if (action === 'saveApiKey')   result = saveApiKey(body.key, body.reqUser);
    else if (action === 'parseOCRText') result = parseOCRText(body.ocrText);
    else if (action === 'clearSession') result = clearSession(body.username);
    else if (action === 'uploadPhoto')    result = uploadPhoto(body.base64, body.mimeType, body.filename, body.institution);
    else if (action === 'uploadDocument') result = uploadDocument(body.base64, body.mimeType, body.filename, body.institution, body.stipNo);
    else if (action === 'deletePhoto')    result = deletePhoto(body.fileId);
    else if (action === 'deleteFile')     result = deleteFile(body.fileId);
    else if (action === 'cleanBlankRows') result = cleanBlankStipNoRows(body.reqUser);
    else result = { status: 'error', message: 'Invalid POST action: ' + action };
  } catch (error) {
    result = { status: 'error', message: error.toString() };
  }
  return createJsonResponse(result);
}

function createJsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─────────────────────────────────────────────
// AUTH: LOGIN
// ─────────────────────────────────────────────
function handleLogin(id, pass, role) {
  if (role === 'admin') {
    const sheet = db.getSheetByName('Admins');
    if (!sheet) return { status:'error', message:'Admins sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const uCol = headers.indexOf('Username');
    const pCol = headers.indexOf('Password');
    const rCol = headers.indexOf('Role');
    const fnCol = headers.indexOf('FirstName');
    const lnCol = headers.indexOf('LastName');
    const picCol = headers.indexOf('ProfilePicURL');
    const stCol = headers.indexOf('Status');

    const lcCol = headers.indexOf('LoginCount');
    const llCol = headers.indexOf('LastLogin');
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[uCol].toString() === id && row[pCol].toString() === pass) {
        if (row[stCol] !== 'Active') return { status:'error', message:'Account is inactive.' };
        // Track login count and last login timestamp
        const now = new Date().toLocaleString('en-GB');
        const loginCount = (parseInt(row[lcCol]) || 0) + 1;
        if (lcCol >= 0) sheet.getRange(i + 1, lcCol + 1).setValue(loginCount);
        if (llCol >= 0) sheet.getRange(i + 1, llCol + 1).setValue(now);
        // Record session and detect duplicate
        const duplicateSession = _recordSession(id, row[rCol]);
        return {
          status: 'success', role: row[rCol],
          name: row[fnCol] + ' ' + row[lnCol],
          pic: row[picCol] || '',
          username: id,
          loginCount: loginCount,
          lastLogin: now,
          duplicateSession: duplicateSession
        };
      }
    }
    return { status:'error', message:'Invalid username or password.' };
  }

  if (role === 'student') {
    const sheet = db.getSheetByName('Students');
    if (!sheet) return { status:'error', message:'Students sheet not found.' };
    const data = sheet.getDataRange().getValues();
    const h = data[0];
    const col = {};
    h.forEach((v, i) => col[v] = i);

    const _sv = (row, colName) => (col[colName] !== undefined && row[col[colName]] !== undefined)
      ? row[col[colName]].toString().trim() : '';
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!_sv(row, 'StipNo') && !_sv(row, 'IDCard') && !_sv(row, 'EngFirstName')) continue; // skip empty rows
      const matchId = _sv(row, 'IDCard')    === id ||
                      _sv(row, 'StudentID') === id ||
                      _sv(row, 'Phone1')    === id;
      if (matchId && _sv(row, 'BirthYear') === pass) {
        const st = _sv(row, 'Status');
        if (st === 'Resigned' || st === 'Incomplete')
          return { status:'error', message:'Your account is not eligible to login.' };
        const fname = _sv(row, 'FirstName') || _sv(row, 'EngFirstName');
        const lname = _sv(row, 'LastName')  || _sv(row, 'EngLastName');
        return {
          status: 'success', role: 'Student',
          name: (fname + ' ' + lname).trim() || _sv(row, 'StipNo'),
          stipNo: _sv(row, 'StipNo')
        };
      }
    }
    return { status:'error', message:'Invalid student ID or birth year.' };
  }

  return { status:'error', message:'Invalid role.' };
}

// ─────────────────────────────────────────────
// GET ALL STUDENTS (LIST + STATS)
// ─────────────────────────────────────────────
function getStudentsData() {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  const data = sheet.getDataRange().getDisplayValues();
  const h = data[0];
  const col = {};
  h.forEach((v, i) => col[v] = i);

  const students = [];
  const stats = { MBS:0, VC:0, UNI:0, Alumni:0, Total:0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[col['StipNo']]) continue;
    const status = row[col['Status']] || 'Active';
    const inst   = row[col['Institution']] || '';
    // Safe column accessor: returns '' if column not found in sheet
    const _c = (name) => (col[name] !== undefined && row[col[name]] !== undefined)
      ? row[col[name]].toString().trim() : '';
    const student = {
      stipNo:       _c('StipNo'),
      idCard:       _c('IDCard'),
      studentId:    _c('StudentID'),
      institution:  inst,
      level:        _c('CurrentLevel'),
      title:        _c('Title'),
      fname:        _c('FirstName'),
      lname:        _c('LastName'),
      name:         (_c('Title') + _c('FirstName') + ' ' + _c('LastName')).trim() || '—',
      engTitle:     _c('EngTitle'),
      engFname:     _c('EngFirstName'),
      engLname:     _c('EngLastName'),
      phone:        _c('Phone1'),
      birthYear:    _c('BirthYear'),
      status:       status,
      pic:          _c('ProfilePicURL'),
      scholarshipYear: _c('ScholarshipYear'),
      entryYear:    _c('EntryYear')
    };
    students.push(student);
    stats.Total++;
    if (status === 'Graduated') {
      stats.Alumni++;
    } else {
      if (inst === 'MBS') stats.MBS++;
      else if (inst === 'VC') stats.VC++;
      else if (inst === 'UNI') stats.UNI++;
    }
  }
  return { status:'success', data:students, stats:stats };
}

// ─────────────────────────────────────────────
// GET SINGLE STUDENT
// ─────────────────────────────────────────────
// Fields that must be stored/returned as plain text (preserve leading zeros)
const TEXT_FIELDS = ['StipNo','IDCard','Phone1','Phone2','StudentID',
  'Parent1_IDCard','Parent2_IDCard','BirthDay','BirthMonth'];

function getStudentByStipNo(stipNo) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  // Use getDisplayValues() to preserve text-formatted cells (leading zeros)
  const data = sheet.getDataRange().getDisplayValues();
  const headers = data[0];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === stipNo.toString()) {
      const student = {};
      headers.forEach((h, j) => {
        student[h] = data[i][j] !== undefined ? data[i][j].toString() : '';
      });
      return { status:'success', data:student };
    }
  }
  return { status:'error', message:'Student not found: ' + stipNo };
}

// ─────────────────────────────────────────────
// SAVE NEW STUDENT
// ─────────────────────────────────────────────
function saveStudentData(d) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };

  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  // Safe cell value accessor
  const _v = (row, colName) => {
    const idx = col[colName];
    return (idx !== undefined && row[idx] !== undefined) ? row[idx].toString().trim() : '';
  };

  // Auto-generate StipNo if empty
  if (!d.StipNo || !d.StipNo.toString().trim()) {
    d.StipNo = generateNextStipNo(d.Institution);
  }
  d.StipNo = d.StipNo.toString().trim();

  // Check duplicate StipNo — if CSV explicitly provides a StipNo that already exists,
  // treat it as an UPDATE request rather than an error.
  for (let i = 1; i < allData.length; i++) {
    const existStipNo = _v(allData[i], 'StipNo');
    if (existStipNo && existStipNo === d.StipNo) {
      // StipNo was explicitly provided (not auto-generated) → update the existing record
      var upd = updateStudentData(d);
      if (upd.status === 'success') upd._wasUpdated = true;
      return upd;
    }
  }

  // ── MERGE: update blank-StipNo row matching by IDCard, English name, or Thai name ──
  // Handles re-import of students who were previously saved without a StipNo.
  const dIdCard = (d.IDCard || '').toString().trim();
  const dEngFn  = (d.EngFirstName || '').toString().toLowerCase().trim();
  const dEngLn  = (d.EngLastName  || '').toString().toLowerCase().trim();
  const dFn     = (d.FirstName    || '').toString().toLowerCase().trim();
  const dLn     = (d.LastName     || '').toString().toLowerCase().trim();

  if (dIdCard.length >= 13 || dEngFn || dFn) {
    for (let i = 1; i < allData.length; i++) {
      if (_v(allData[i], 'StipNo')) continue; // skip rows that already have a StipNo

      // Match priority: IDCard (strongest) → Eng name → Thai name
      const exIdCard = _v(allData[i], 'IDCard');
      const idMatch  = dIdCard.length >= 13 && exIdCard === dIdCard;

      const exEngFn = _v(allData[i], 'EngFirstName').toLowerCase();
      const exEngLn = _v(allData[i], 'EngLastName').toLowerCase();
      const exFn    = _v(allData[i], 'FirstName').toLowerCase();
      const exLn    = _v(allData[i], 'LastName').toLowerCase();

      const engMatch  = dEngFn && dEngLn && exEngFn === dEngFn && exEngLn === dEngLn;
      const thaiMatch = dFn    && dLn    && exFn    === dFn    && exLn    === dLn;

      if (idMatch || engMatch || thaiMatch) {
        // Found matching blank-StipNo row → patch it with incoming data
        const now = new Date().toLocaleString('en-GB');
        const updatedRow = headers.map((h, j) => {
          if (h === 'CreatedAt') return allData[i][j]; // preserve original creation date
          if (h === 'UpdatedAt') return now;
          // Overwrite with incoming value if non-empty; otherwise keep existing
          const incoming = d[h] !== undefined ? d[h].toString() : '';
          const existing = allData[i][j] !== undefined ? allData[i][j].toString() : '';
          return (incoming !== '') ? incoming : existing;
        });
        const range = sheet.getRange(i + 1, 1, 1, headers.length);
        const formats = [headers.map(h => TEXT_FIELDS.includes(h) ? '@' : '')];
        range.setNumberFormats(formats);
        range.setValues([updatedRow]);

        if (d.Institution === 'UNI' && d.UniName) saveUniversityData(d);
        const matchType = idMatch ? 'IDCard' : (engMatch ? 'EngName' : 'ThaiName');
        logAction(d.SavedBy || 'System', 'MERGE_STUDENT',
          'Merged blank-StipNo row ' + (i + 1) + ' via ' + matchType + ' → StipNo: ' + d.StipNo);
        return { status:'success', message:'Student merged with existing record.', stipNo: d.StipNo, merged:true };
      }
    }
  }

  // Check duplicate IDCard — only reject if the existing row ALREADY has a StipNo
  // (blank-StipNo rows are handled by MERGE above; if we reach here, no merge found)
  if (dIdCard.length >= 13) {
    for (let i = 1; i < allData.length; i++) {
      if (_v(allData[i], 'IDCard') !== dIdCard) continue;
      const exStipNo = _v(allData[i], 'StipNo');
      if (exStipNo) {
        return { status:'error', message:'ID Card ' + dIdCard + ' already exists. (StipNo: ' + exStipNo + ')' };
      }
    }
  }

  // ── CREATE NEW ROW ──
  const now = new Date().toLocaleString('en-GB');
  const row = headers.map(h => {
    if (h === 'CreatedAt' || h === 'UpdatedAt') return now;
    return (d[h] !== undefined && d[h] !== null) ? d[h] : '';
  });

  const newRowIdx = sheet.getLastRow() + 1;
  const newRange  = sheet.getRange(newRowIdx, 1, 1, headers.length);
  const formats   = [headers.map(h => TEXT_FIELDS.includes(h) ? '@' : '')];
  newRange.setNumberFormats(formats);
  newRange.setValues([row]);

  if (d.Institution === 'UNI' && d.UniName) saveUniversityData(d);
  logAction(d.SavedBy || 'System', 'ADD_STUDENT', 'Added StipNo: ' + d.StipNo);
  return { status:'success', message:'Student saved successfully.', stipNo: d.StipNo };
}

// ─────────────────────────────────────────────
// UPDATE EXISTING STUDENT
// ─────────────────────────────────────────────
function updateStudentData(d) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  if (!d.StipNo) return { status:'error', message:'StipNo required for update.' };

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  const dStipNo = d.StipNo.toString().trim();

  for (let i = 1; i < data.length; i++) {
    const existStipNo = (col['StipNo'] !== undefined && data[i][col['StipNo']] !== undefined)
      ? data[i][col['StipNo']].toString().trim() : '';
    if (existStipNo !== dStipNo) continue;

    // Build updated row using setValues (single API call — much faster than per-cell)
    const now = new Date().toLocaleString('en-GB');
    const updatedRow = headers.map((h, j) => {
      if (h === 'StipNo' || h === 'CreatedAt') return data[i][j]; // immutable fields
      if (h === 'UpdatedAt') return now;
      // Only overwrite if incoming value is defined (allows partial updates)
      return (d[h] !== undefined && d[h] !== null) ? d[h] : data[i][j];
    });
    const range = sheet.getRange(i + 1, 1, 1, headers.length);
    const formats = [headers.map(h => TEXT_FIELDS.includes(h) ? '@' : '')];
    range.setNumberFormats(formats);
    range.setValues([updatedRow]);

    if (d.Institution === 'UNI' && d.UniName) saveUniversityData(d);
    logAction(d.SavedBy || 'System', 'UPDATE_STUDENT', 'Updated StipNo: ' + d.StipNo);
    return { status:'success', message:'Student updated successfully.', stipNo: d.StipNo, _wasUpdated: true };
  }
  return { status:'error', message:'Student not found: ' + d.StipNo };
}

// ─────────────────────────────────────────────
// DELETE STUDENT
// ─────────────────────────────────────────────
function deleteStudentData(stipNo) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };

  const data = sheet.getDataRange().getValues();
  const stipCol = data[0].indexOf('StipNo');

  for (let i = 1; i < data.length; i++) {
    if (data[i][stipCol].toString() === stipNo.toString()) {
      sheet.deleteRow(i + 1);
      logAction('Admin', 'DELETE_STUDENT', 'Deleted StipNo: ' + stipNo);
      return { status:'success', message:'Student deleted successfully.' };
    }
  }
  return { status:'error', message:'Student not found.' };
}

// ─────────────────────────────────────────────
// UNIVERSITY DATA
// ─────────────────────────────────────────────
function saveUniversityData(d) {
  const sheet = db.getSheetByName('UniversityData');
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const stipCol = headers.indexOf('StipNo');

  // Map university fields
  const uniMap = {
    StipNo: d.StipNo, UniName: d.UniName, CourseDuration: d.UniDuration,
    Province: d.UniProvince, Faculty: d.UniFaculty, Major: d.UniMajor
  };

  for (let i = 1; i < data.length; i++) {
    if (data[i][stipCol].toString() === d.StipNo.toString()) {
      headers.forEach((h, j) => {
        if (uniMap[h] !== undefined) sheet.getRange(i + 1, j + 1).setValue(uniMap[h]);
      });
      return;
    }
  }
  sheet.appendRow(headers.map(h => uniMap[h] || ''));
}

function getUniNames() {
  const sheet = db.getSheetByName('UniversityData');
  if (!sheet) return { status:'success', data:[] };
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const nameCol = h.indexOf('UniName');
  if (nameCol < 0) return { status:'success', data:[] };
  const names = [...new Set(
    data.slice(1).map(r => r[nameCol]).filter(v => v && v.toString().trim())
  )];
  return { status:'success', data: names };
}

// ─────────────────────────────────────────────
// CLEANUP: BLANK STIPNO GARBAGE ROWS
// ─────────────────────────────────────────────
/**
 * Count (GET) or delete (POST) rows that have blank StipNo
 * AND no identifying data (no IDCard, no names).
 * These are garbage rows from previous bad imports.
 */
function countBlankStipNoRows() {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const col = {};
  h.forEach((v, i) => col[v] = i);
  const _v = (row, name) => {
    const idx = col[name];
    return (idx !== undefined && row[idx] !== undefined) ? row[idx].toString().trim() : '';
  };
  let count = 0;
  for (let i = 1; i < data.length; i++) {
    if (_v(data[i], 'StipNo')) continue; // has StipNo — keep
    const hasId   = _v(data[i], 'IDCard').length >= 5;
    const hasName = _v(data[i], 'FirstName') || _v(data[i], 'LastName') ||
                    _v(data[i], 'EngFirstName') || _v(data[i], 'EngLastName');
    if (!hasId && !hasName) count++;
  }
  return { status:'success', count };
}

function cleanBlankStipNoRows(reqUser) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const h = data[0];
  const col = {};
  h.forEach((v, i) => col[v] = i);
  const _v = (row, name) => {
    const idx = col[name];
    return (idx !== undefined && row[idx] !== undefined) ? row[idx].toString().trim() : '';
  };

  // Collect row numbers to delete (iterate backwards to keep indices valid)
  const toDelete = [];
  for (let i = 1; i < data.length; i++) {
    if (_v(data[i], 'StipNo')) continue; // has StipNo — keep
    const hasId   = _v(data[i], 'IDCard').length >= 5;
    const hasName = _v(data[i], 'FirstName') || _v(data[i], 'LastName') ||
                    _v(data[i], 'EngFirstName') || _v(data[i], 'EngLastName');
    if (!hasId && !hasName) toDelete.push(i + 1); // 1-based row number
  }

  // Delete from bottom to top to preserve row numbers
  for (let i = toDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(toDelete[i]);
  }

  logAction(reqUser || 'Admin', 'CLEAN_BLANK_ROWS',
    'Deleted ' + toDelete.length + ' blank-StipNo rows with no identifying data');
  return { status:'success', deleted: toDelete.length };
}

// ─────────────────────────────────────────────
// STIP NO. GENERATOR
// ─────────────────────────────────────────────
function generateNextStipNo(institution) {
  const sheet = db.getSheetByName('Students');
  const prefix = getStipPrefix(institution);

  if (!sheet || sheet.getLastRow() <= 1) return prefix + '001';

  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const sno = (data[i][0] !== undefined) ? data[i][0].toString().trim() : '';
    if (!sno) continue;
    // Match prefix-based: MBS_123, VC_045, etc.
    if (sno.startsWith(prefix)) {
      const num = parseInt(sno.substring(prefix.length));
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
    // Also consider plain numeric StipNos (legacy data without prefix)
    if (/^\d+$/.test(sno)) {
      const num = parseInt(sno);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  }
  return prefix + String(maxNum + 1).padStart(3, '0');
}

function getStipPrefix(institution) {
  const map = { MBS:'MBS_', VC:'VC_', UNI:'UNI_', OTHER:'OTH_' };
  return map[institution] || 'RDF_';
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────
function logAction(userId, action, details) {
  try {
    const sheet = db.getSheetByName('Logs');
    if (sheet) sheet.appendRow([new Date().toLocaleString('en-GB'), userId, action, details]);
  } catch (e) {}
}

// ─────────────────────────────────────────────
// ADMIN MANAGEMENT
// ─────────────────────────────────────────────
function getAdmins() {
  const sheet = db.getSheetByName('Admins');
  if (!sheet) return { status:'error', message:'Admins sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const admins = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    const obj = {};
    headers.forEach((h, j) => {
      if (h !== 'Password') obj[h] = row[j] !== undefined ? row[j].toString() : '';
    });
    admins.push(obj);
  }
  return { status:'success', data: admins };
}

function saveAdmin(adminData, reqUser) {
  if (!adminData || !adminData.Username) return { status:'error', message:'Username required.' };
  const sheet = db.getSheetByName('Admins');
  if (!sheet) return { status:'error', message:'Admins sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const uCol = headers.indexOf('Username');
  const pCol = headers.indexOf('Password');

  let existingRow = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol].toString() === adminData.Username.toString()) {
      existingRow = i + 1; break;
    }
  }

  if (existingRow > 0) {
    headers.forEach((h, j) => {
      if (h === 'Password') { if (adminData.Password) sheet.getRange(existingRow, j+1).setValue(adminData.Password); }
      else if (adminData[h] !== undefined) sheet.getRange(existingRow, j+1).setValue(adminData[h]);
    });
    logAction(reqUser||'Admin', 'UPDATE_ADMIN', 'Updated: ' + adminData.Username);
  } else {
    const now = new Date().toLocaleString('en-GB');
    const newRow = headers.map(h => {
      if (h === 'CreatedAt') return now;
      if (h === 'Status' && !adminData.Status) return 'Active';
      return adminData[h] !== undefined ? adminData[h] : '';
    });
    sheet.appendRow(newRow);
    logAction(reqUser||'Admin', 'ADD_ADMIN', 'Added: ' + adminData.Username);
  }
  return { status:'success' };
}

function deleteAdmin(username, reqUser) {
  if (!username) return { status:'error', message:'Username required.' };
  const sheet = db.getSheetByName('Admins');
  if (!sheet) return { status:'error', message:'Admins sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const uCol = data[0].indexOf('Username');
  for (let i = 1; i < data.length; i++) {
    if (data[i][uCol].toString() === username.toString()) {
      sheet.deleteRow(i + 1);
      logAction(reqUser||'Admin', 'DELETE_ADMIN', 'Deleted: ' + username);
      return { status:'success' };
    }
  }
  return { status:'error', message:'Admin not found.' };
}

// ─────────────────────────────────────────────
// SYSTEM SETTINGS
// ─────────────────────────────────────────────
function getSystemSettings() {
  const sheet = db.getSheetByName('SystemSettings');
  if (!sheet) return { status:'success', data:{} };
  const data = sheet.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[0]) continue;
    try   { settings[row[0]] = JSON.parse(row[1]); }
    catch  { settings[row[0]] = row[1]; }
  }
  return { status:'success', data: settings };
}

function saveSetting(key, values, reqUser) {
  if (!key) return { status:'error', message:'Key required.' };
  const sheet = db.getSheetByName('SystemSettings');
  if (!sheet) return { status:'error', message:'SystemSettings sheet not found.' };
  const data = sheet.getDataRange().getValues();
  const jsonVal = JSON.stringify(values);
  const now = new Date().toLocaleString('en-GB');
  let found = false;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0].toString() === key) {
      sheet.getRange(i+1, 2).setValue(jsonVal);
      sheet.getRange(i+1, 3).setValue(now);
      found = true; break;
    }
  }
  if (!found) sheet.appendRow([key, jsonVal, now]);
  logAction(reqUser||'Admin', 'SAVE_SETTING', 'Key: ' + key);
  return { status:'success' };
}

// ─────────────────────────────────────────────
// SESSION MANAGEMENT
// Active sessions stored in Script Properties as JSON
// ─────────────────────────────────────────────
function _getSessions() {
  const props = PropertiesService.getScriptProperties();
  try { return JSON.parse(props.getProperty('ACTIVE_SESSIONS') || '{}'); }
  catch (e) { return {}; }
}
function _saveSessions(sessions) {
  PropertiesService.getScriptProperties().setProperty('ACTIVE_SESSIONS', JSON.stringify(sessions));
}
function _recordSession(username, role) {
  const sessions = _getSessions();
  // Check for duplicate (active within last 5 hours)
  const existing = sessions[username];
  const now = Date.now();
  const SESSION_TTL_MS = 5 * 60 * 60 * 1000;
  const duplicate = existing && (now - existing.loginTime) < SESSION_TTL_MS;
  sessions[username] = { role, loginTime: now, lastSeen: now };
  _saveSessions(sessions);
  return duplicate;
}
function getActiveSessions() {
  const sessions = _getSessions();
  const now = Date.now();
  const SESSION_TTL_MS = 5 * 60 * 60 * 1000;
  // Return only active sessions (within 5 hours), clean up stale ones
  const active = {};
  let changed = false;
  Object.keys(sessions).forEach(u => {
    if ((now - sessions[u].loginTime) < SESSION_TTL_MS) {
      active[u] = sessions[u];
    } else {
      changed = true;
    }
  });
  if (changed) _saveSessions(active);
  return { status: 'success', sessions: active };
}
function clearSession(username) {
  if (!username) return { status: 'error', message: 'No username.' };
  const sessions = _getSessions();
  delete sessions[username];
  _saveSessions(sessions);
  return { status: 'success' };
}

// ─────────────────────────────────────────────
// API KEY MANAGEMENT
// Keys stored securely in Script Properties (never in Sheets)
// ─────────────────────────────────────────────
function getApiKeyStatus() {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('GEMINI_API_KEY');
  if (!key) return { status:'success', set: false, masked: '' };
  const masked = key.length > 8
    ? key.substring(0, 4) + '***' + key.substring(key.length - 4)
    : '***';
  return { status:'success', set: true, masked };
}

function saveApiKey(key, reqUser) {
  if (!key || key.trim().length < 10) return { status:'error', message:'API Key ไม่ถูกต้อง' };
  const props = PropertiesService.getScriptProperties();
  props.setProperty('GEMINI_API_KEY', key.trim());
  logAction(reqUser||'Admin', 'SAVE_SETTING', 'GEMINI_API_KEY updated');
  return { status:'success' };
}

// ─────────────────────────────────────────────
// AI OCR PARSE — Gemini API (Free tier) via UrlFetchApp
// Setup: Settings → API Keys tab → วาง Gemini API Key
//        หรือ Apps Script → Script Properties → GEMINI_API_KEY
// Get free key: https://aistudio.google.com/app/apikey
// ─────────────────────────────────────────────
function parseOCRText(ocrText) {
  if (!ocrText) return { status:'error', message:'No OCR text provided.' };
  const props = PropertiesService.getScriptProperties();
  const apiKey = props.getProperty('GEMINI_API_KEY');
  if (!apiKey) return { status:'error', message:'ยังไม่ได้ตั้งค่า Gemini API Key ไปที่ Settings → API Keys เพื่อเพิ่ม key ฟรีจาก Google AI Studio' };

  const prompt = 'สกัดข้อมูลจาก OCR text ของบัตรประชาชนไทย ตอบกลับเป็น JSON เท่านั้น ไม่มีข้อความอื่น\n' +
    'fields: idCard (เลข 13 หลักตัวเลข ไม่มี -), title (นาย/นางสาว/นาง/เด็กชาย/เด็กหญิง), ' +
    'firstName (ภาษาไทย), lastName (ภาษาไทย), birthYear (ค.ศ. เช่น 2000)\n' +
    'ถ้าหาไม่พบให้ใส่ null\nOCR text:\n' + ocrText.substring(0, 2000);

  try {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey;
    const resp = UrlFetchApp.fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 256 }
      }),
      muteHttpExceptions: true
    });
    const body = JSON.parse(resp.getContentText());
    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const jsonText = text.trim().replace(/^```json\n?|```$/g,'').trim();
      const parsed = JSON.parse(jsonText);
      Object.keys(parsed).forEach(k => { if (parsed[k] === null) delete parsed[k]; });
      return { status:'success', data: parsed };
    }
    const errMsg = body?.error?.message || 'AI response format unexpected.';
    return { status:'error', message: errMsg };
  } catch(e) {
    return { status:'error', message: e.toString() };
  }
}

// ─────────────────────────────────────────────
// GOOGLE DRIVE — FILE MANAGEMENT
// Root: https://drive.google.com/drive/folders/1SjpBFnfKHsh60I8UQddcWyGE7ffi6Isl
//
// Auto-created structure:
//   📁 RDF (root)
//   ├── 📁 Photos
//   │   ├── 📁 MBS  ← profile photos for MBS students
//   │   ├── 📁 VC
//   │   └── 📁 UNI
//   └── 📁 Documents
//       ├── 📁 MBS  ← documents for MBS students
//       ├── 📁 VC
//       └── 📁 UNI
// ─────────────────────────────────────────────
const DRIVE_FOLDER_ID        = '1SjpBFnfKHsh60I8UQddcWyGE7ffi6Isl';
const PHOTO_MAX_BYTES        = 1 * 1024 * 1024;   // 1 MB
const DOCUMENT_MAX_BYTES     = 5 * 1024 * 1024;   // 5 MB
const ALLOWED_PHOTO_TYPES    = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/**
 * Get or create a named sub-folder inside a parent folder.
 * Reuses existing folder to avoid duplicates.
 */
function _getOrCreateFolder(parentFolderId, name) {
  const parent = DriveApp.getFolderById(parentFolderId);
  const iter   = parent.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return parent.createFolder(name);
}

/**
 * Resolve the correct sub-folder for a given type ('Photos'/'Documents')
 * and institution ('MBS'/'VC'/'UNI').  Creates folders on first use.
 */
function _resolveFolder(type, institution) {
  const validTypes = ['Photos', 'Documents'];
  const validInst  = ['MBS', 'VC', 'UNI'];
  const typeFolder = _getOrCreateFolder(DRIVE_FOLDER_ID, validTypes.includes(type) ? type : 'Photos');
  const instName   = validInst.includes(institution) ? institution : 'Other';
  return _getOrCreateFolder(typeFolder.getId(), instName);
}

/**
 * Upload a profile photo to Drive → Photos/<institution>/<filename>
 * Params: base64Data (string), mimeType, filename, institution ('MBS'|'VC'|'UNI')
 * Returns: { status, url, fileId, path }
 */
function uploadPhoto(base64Data, mimeType, filename, institution) {
  if (!base64Data) return { status:'error', message:'No image data.' };
  if (!mimeType)   mimeType = 'image/jpeg';
  if (!filename)   filename = 'photo_' + Date.now() + '.jpg';
  institution = institution || 'Other';

  // Type check
  if (!ALLOWED_PHOTO_TYPES.includes(mimeType))
    return { status:'error', message:'ประเภทไฟล์ไม่รองรับ — รองรับ JPG, PNG, WEBP เท่านั้น' };
  // Size check (base64 → approx decoded bytes = length × 0.75)
  const approxBytes = Math.round(base64Data.length * 0.75);
  if (approxBytes > PHOTO_MAX_BYTES)
    return { status:'error', message:'รูปภาพใหญ่เกิน 1 MB — กรุณาบีบอัดก่อนอัปโหลด (approx ' + Math.round(approxBytes/1024) + ' KB)' };

  try {
    const folder  = _resolveFolder('Photos', institution);
    const decoded = Utilities.base64Decode(base64Data);
    const blob    = Utilities.newBlob(decoded, mimeType, filename);
    const file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const url    = 'https://drive.google.com/uc?export=view&id=' + fileId;
    const path   = 'Photos/' + institution + '/' + filename;
    return { status:'success', url, fileId, path };
  } catch(e) {
    return { status:'error', message: e.toString() };
  }
}

/**
 * Upload a document to Drive → Documents/<institution>/<filename>
 * Params: base64Data (string), mimeType, filename, institution, stipNo
 * Returns: { status, url, fileId, path }
 */
function uploadDocument(base64Data, mimeType, filename, institution, stipNo) {
  if (!base64Data) return { status:'error', message:'No file data.' };
  if (!mimeType)   mimeType = 'application/octet-stream';
  if (!filename)   filename = (stipNo ? stipNo + '_' : '') + 'doc_' + Date.now();
  institution = institution || 'Other';

  // Type check
  if (!ALLOWED_DOCUMENT_TYPES.includes(mimeType))
    return { status:'error', message:'ประเภทไฟล์ไม่รองรับ — รองรับ PDF, JPG, PNG เท่านั้น' };
  // Size check
  const approxBytes = Math.round(base64Data.length * 0.75);
  if (approxBytes > DOCUMENT_MAX_BYTES)
    return { status:'error', message:'ไฟล์ใหญ่เกิน 5 MB (' + Math.round(approxBytes/1024/1024*10)/10 + ' MB)' };

  try {
    const folder  = _resolveFolder('Documents', institution);
    const decoded = Utilities.base64Decode(base64Data);
    const blob    = Utilities.newBlob(decoded, mimeType, filename);
    const file    = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const fileId = file.getId();
    const url    = 'https://drive.google.com/file/d/' + fileId + '/view';
    const path   = 'Documents/' + institution + '/' + filename;
    return { status:'success', url, fileId, path };
  } catch(e) {
    return { status:'error', message: e.toString() };
  }
}

/**
 * Move a Drive file to trash (soft-delete).
 * Works for both photos and documents.
 */
function deleteFile(fileId) {
  if (!fileId) return { status:'error', message:'No file ID provided.' };
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
    return { status:'success' };
  } catch(e) {
    return { status:'error', message: e.toString() };
  }
}

// Keep old name as alias for backward compatibility
function deletePhoto(fileId) { return deleteFile(fileId); }

/**
 * List uploaded documents for a student in Drive → Documents/<inst>/
 * Matches files whose name starts with "<stipNo>_"
 * Returns: { status, data: [{fileId, name, url, mimeType, size, createdAt}] }
 */
function getStudentDocs(stipNo) {
  if (!stipNo) return { status:'error', message:'No stipNo provided.' };
  const validInst = ['MBS','VC','UNI','Other'];
  const results = [];
  try {
    const root = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const docIter = root.getFoldersByName('Documents');
    if (!docIter.hasNext()) return { status:'success', data:[] };
    const docFolder = docIter.next();
    for (const inst of validInst) {
      const instIter = docFolder.getFoldersByName(inst);
      if (!instIter.hasNext()) continue;
      const instFolder = instIter.next();
      const files = instFolder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        const name = f.getName();
        if (name.startsWith(stipNo + '_')) {
          results.push({
            fileId:    f.getId(),
            name:      name,
            url:       'https://drive.google.com/file/d/' + f.getId() + '/view',
            mimeType:  f.getMimeType(),
            size:      f.getSize(),
            createdAt: Utilities.formatDate(f.getDateCreated(), 'Asia/Bangkok', 'dd/MM/yyyy HH:mm')
          });
        }
      }
    }
    return { status:'success', data: results };
  } catch(e) {
    return { status:'error', message: e.toString() };
  }
}

function getLogs(limit) {
  const sheet = db.getSheetByName('Logs');
  if (!sheet || sheet.getLastRow() <= 1) return { status:'success', data:[] };
  const data = sheet.getDataRange().getValues();
  const result = [];
  const start = Math.max(1, data.length - parseInt(limit));
  for (let i = data.length - 1; i >= start; i--) {
    const row = data[i];
    if (!row[0]) continue;
    result.push({
      timestamp: row[0] ? row[0].toString() : '',
      user:      row[1] ? row[1].toString() : '',
      action:    row[2] ? row[2].toString() : '',
      details:   row[3] ? row[3].toString() : ''
    });
  }
  return { status:'success', data: result };
}
