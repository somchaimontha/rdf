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
          pic: row[picCol] || ''
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
