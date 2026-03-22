/**
 * RDF Scholarship Management System — Database Setup
 * Run this function ONCE in Google Apps Script to create all sheets and columns.
 * WARNING: Running again will CLEAR existing data. Use with caution.
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const dbStructure = {
    "SystemSettings": [
      "SettingKey", "SettingValue", "Description", "UpdatedAt"
    ],
    "Admins": [
      "AdminID", "Username", "Password", "Role", "SubRole",
      "Title", "FirstName", "LastName", "ProfilePicURL", "Status", "CreatedAt"
    ],
    "Students": [
      // Identification
      "StipNo", "IDCard", "BirthYear", "StudentID", "Status",
      // Academic
      "Institution", "OtherInstitution", "CurrentLevel", "ScholarshipYear",
      "EntryYear", "EntryTerm", "Major", "Department", "OldSchool",
      // University (filled when Institution = UNI)
      "UniName", "UniDuration", "UniProvince", "UniFaculty", "UniMajor",
      // Personal
      "Title", "FirstName", "LastName", "HasNoSurname",
      "EngTitle", "EngFirstName", "EngLastName",
      "Nickname", "Sex", "Nationality", "Religion",
      "Talent", "Weight", "Height", "BloodType", "Disease",
      // Contact
      "Phone1", "Phone2",
      // Address (split fields)
      "Village", "HouseNo", "Moo", "Tambon", "Amphoe", "Province",
      // Family
      "ParentStatus", "ParentStatusOther",
      "Parent1_IDCard", "Parent1_Title", "Parent1_FirstName", "Parent1_LastName",
      "Parent2_IDCard", "Parent2_Title", "Parent2_FirstName", "Parent2_LastName",
      // Extra
      "ProfilePicURL", "Remarks", "CreatedAt", "UpdatedAt"
    ],
    "UniversityData": [
      "StipNo", "UniName", "CourseDuration", "Province", "Faculty", "Major", "UpdatedAt"
    ],
    "AcademicRecords": [
      "RecordID", "StipNo", "AcademicYear", "Term", "GPA", "Status", "RecordedBy", "Timestamp"
    ],
    "MonthlyReports": [
      "ReportID", "StipNo", "Month", "Year", "Content",
      "File1", "File2", "File3", "File4", "File5",
      "File6", "File7", "File8", "File9", "File10",
      "SubmittedAt", "ReadBy", "ReadAt", "Status"
    ],
    "Alumni": [
      "StipNo", "GraduationYear", "Occupation", "Workplace", "IsDataComplete", "Remarks", "UpdatedAt"
    ],
    "EditPermissions": [
      "StipNo", "CanEdit", "SetBy", "SetAt", "Scope"
    ],
    "PromotionLog": [
      "StipNo", "FromLevel", "ToLevel", "PromotedAt", "ConfirmedBy", "Notes"
    ],
    "Logs": [
      "Timestamp", "UserID", "Action", "Details"
    ]
  };

  // Colors
  const headerBg   = "#1e3a8a";
  const headerFont  = "#ffffff";

  for (const [sheetName, headers] of Object.entries(dbStructure)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    } else {
      // Warn before clearing (comment out clear() if you want to preserve data)
      // sheet.clear();
    }

    // Write headers only if row 1 is empty
    if (sheet.getRange(1, 1).getValue() === '') {
      const range = sheet.getRange(1, 1, 1, headers.length);
      range.setValues([headers]);
      range.setFontWeight("bold");
      range.setBackground(headerBg);
      range.setFontColor(headerFont);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
    }
  }

  // Seed Super Admin if Admins sheet is empty
  const adminSheet = ss.getSheetByName("Admins");
  if (adminSheet.getLastRow() <= 1) {
    adminSheet.appendRow([
      "ADM_001", "admin", "1234", "SuperAdmin", "All",
      "นาย", "ผู้ดูแล", "ระบบ", "", "Active",
      new Date().toLocaleString('en-GB')
    ]);
  }

  // Seed default system settings if empty
  const settingsSheet = ss.getSheetByName("SystemSettings");
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ["FOUNDATION_NAME_EN", "Dr. Robert Dyckerhoff Foundation", "Foundation name in English", new Date().toLocaleString('en-GB')],
      ["FOUNDATION_NAME_TH", "มูลนิธิ ดร.โรเบิร์ต ไดเกอร์ฮอฟฟ์", "Foundation name in Thai", ""],
      ["LOGO_URL", "https://raw.githubusercontent.com/somchaimontha/rdf/refs/heads/main/RDF%20original%20s%20(2).png", "Logo image URL", ""],
      ["ALLOW_STUDENT_EDIT", "true", "Allow students to edit their own data", ""],
      ["ACADEMIC_YEAR", "2024", "Current academic year (C.E.)", ""]
    ];
    defaultSettings.forEach(row => settingsSheet.appendRow(row));
  }

  SpreadsheetApp.getUi().alert('✅ Database setup complete!\n\nSheets created:\n' +
    Object.keys(dbStructure).join('\n'));
}
