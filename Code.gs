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
    else if (action === 'getUniNames')    result = getUniNames();
    else if (action === 'ping')           result = { status: 'ok', timestamp: new Date().toISOString() };
    else if (action === 'getAdmins')          result = getAdmins();
    else if (action === 'getSystemSettings')  result = getSystemSettings();
    else if (action === 'getLogs')            result = getLogs(parseInt(e.parameter.limit)||200);
    else if (action === 'getApiKeyStatus')    result = getApiKeyStatus();
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

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[uCol].toString() === id && row[pCol].toString() === pass) {
        if (row[stCol] !== 'Active') return { status:'error', message:'Account is inactive.' };
        return {
          status: 'success', role: row[rCol],
          name: row[fnCol] + ' ' + row[lnCol],
          pic: row[picCol] || '',
          username: id
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

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const matchId = row[col['IDCard']].toString() === id ||
                      row[col['StudentID']].toString() === id ||
                      row[col['Phone1']].toString() === id;
      if (matchId && row[col['BirthYear']].toString() === pass) {
        const st = row[col['Status']];
        if (st === 'Resigned' || st === 'Incomplete')
          return { status:'error', message:'Your account is not eligible to login.' };
        return {
          status: 'success', role: 'Student',
          name: row[col['FirstName']] + ' ' + row[col['LastName']],
          stipNo: row[col['StipNo']]
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
    const student = {
      stipNo:       row[col['StipNo']],
      idCard:       row[col['IDCard']],
      studentId:    row[col['StudentID']],
      institution:  inst,
      level:        row[col['CurrentLevel']],
      title:        row[col['Title']],
      fname:        row[col['FirstName']],
      lname:        row[col['LastName']],
      name:         (row[col['Title']]||'') + (row[col['FirstName']]||'') + ' ' + (row[col['LastName']]||''),
      phone:        row[col['Phone1']],
      status:       status,
      pic:          row[col['ProfilePicURL']],
      scholarshipYear: row[col['ScholarshipYear']] || '',
      entryYear:    row[col['EntryYear']] || ''
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
function getStudentByStipNo(stipNo) {
  const sheet = db.getSheetByName('Students');
  if (!sheet) return { status:'error', message:'Students sheet not found.' };
  const data = sheet.getDataRange().getValues();
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

  // Check duplicate IDCard
  if (d.IDCard) {
    for (let i = 1; i < allData.length; i++) {
      if (allData[i][col['IDCard']].toString() === d.IDCard.toString()) {
        return { status:'error', message:'ID Card ' + d.IDCard + ' already exists in the system.' };
      }
    }
  }

  // Auto-generate StipNo if empty
  if (!d.StipNo) d.StipNo = generateNextStipNo(d.Institution);

  // Check duplicate StipNo
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][col['StipNo']].toString() === d.StipNo.toString()) {
      return { status:'error', message:'Stip No. ' + d.StipNo + ' already exists.', duplicate:true };
    }
  }

  const now = new Date().toLocaleString('en-GB');
  const row = headers.map(h => {
    if (h === 'CreatedAt' || h === 'UpdatedAt') return now;
    return d[h] !== undefined ? d[h] : '';
  });

  sheet.appendRow(row);

  // Save university data
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

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const col = {};
  headers.forEach((h, i) => col[h] = i);

  for (let i = 1; i < data.length; i++) {
    if (data[i][col['StipNo']].toString() === d.StipNo.toString()) {
      const now = new Date().toLocaleString('en-GB');
      headers.forEach((h, j) => {
        if (h === 'UpdatedAt') {
          sheet.getRange(i + 1, j + 1).setValue(now);
        } else if (h !== 'StipNo' && h !== 'CreatedAt' && d[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(d[h]);
        }
      });

      if (d.Institution === 'UNI' && d.UniName) saveUniversityData(d);

      logAction(d.SavedBy || 'System', 'UPDATE_STUDENT', 'Updated StipNo: ' + d.StipNo);
      return { status:'success', message:'Student updated successfully.', stipNo: d.StipNo };
    }
  }
  return { status:'error', message:'Student not found.' };
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
// STIP NO. GENERATOR
// ─────────────────────────────────────────────
function generateNextStipNo(institution) {
  const sheet = db.getSheetByName('Students');
  const prefix = getStipPrefix(institution);

  if (!sheet || sheet.getLastRow() <= 1) return prefix + '001';

  const data = sheet.getDataRange().getValues();
  let maxNum = 0;
  for (let i = 1; i < data.length; i++) {
    const sno = data[i][0].toString();
    if (sno.startsWith(prefix)) {
      const num = parseInt(sno.replace(prefix, ''));
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
