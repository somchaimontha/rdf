/* ── RDF Bilingual System (Thai Primary) ── */

window.LANG = localStorage.getItem('rdfLang') || RDF.DEFAULT_LANG;

const T = {
  th: {
    /* System */
    appName: "ระบบจัดการข้อมูลทุนการศึกษา",
    foundation: "มูลนิธิ ดร.โรเบิร์ต ไดเกอร์ฮอฟฟ์ ประเทศไทย",
    foundationShort: "มูลนิธิฯ Dr. Robert Dyckerhoff",
    loading: "กำลังโหลดข้อมูล...", saving: "กำลังบันทึก...",
    connecting: "กำลังเชื่อมต่อระบบ...", deleting: "กำลังลบข้อมูล...",
    /* Auth */
    loginTitle: "เข้าสู่ระบบ", loginSubtitle: "กรุณาเข้าสู่ระบบเพื่อใช้งาน",
    username: "ชื่อผู้ใช้ / เลขบัตรประชาชน", password: "รหัสผ่าน",
    loginAs: "เข้าสู่ระบบในฐานะ", loginBtn: "เข้าสู่ระบบ",
    loginHint: "นักเรียน: เลขบัตร/รหัสนักเรียน/เบอร์โทร | รหัสผ่าน: ปีเกิด ค.ศ.",
    roleAdmin: "ผู้ดูแลระบบ", roleStudent: "นักเรียนทุน",
    logout: "ออกจากระบบ", logoutConfirm: "ยืนยันการออกจากระบบ?",
    loginFailed: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    /* Nav */
    backToDashboard: "กลับหน้าหลัก", backToList: "กลับรายชื่อ",
    /* Dashboard */
    dashboard: "หน้าหลัก", welcome: "ยินดีต้อนรับ",
    totalStudents: "นักเรียนทั้งหมด",
    mbsStudents: "นักเรียน MBS", vcStudents: "นักศึกษา VC",
    uniStudents: "นักศึกษามหาวิทยาลัย", alumni: "ศิษย์เก่า",
    menuStudents: "จัดการประวัตินักเรียน",
    menuStudentsDesc: "เพิ่ม แก้ไข ดู และพิมพ์ประวัตินักเรียน",
    menuAcademic: "ผลการเรียน",
    menuAcademicDesc: "บันทึกและดูผลการเรียนรายภาคเรียน",
    menuSettings: "ตั้งค่าระบบ",
    menuSettingsDesc: "จัดการผู้ดูแลและตั้งค่าระบบ",
    /* Student List */
    studentList: "รายชื่อนักเรียนทุน",
    addStudent: "เพิ่มนักเรียนใหม่", refresh: "รีเฟรช",
    search: "ค้นหา...", searchPlaceholder: "ค้นหาชื่อ, รหัสทุน, เลขบัตร...",
    advancedSearch: "ค้นหาขั้นสูง", hideAdvSearch: "ซ่อนการค้นหาขั้นสูง",
    allInstitutions: "ทุกสถานศึกษา", allStatus: "ทุกสถานะ",
    allLevels: "ทุกระดับชั้น", allYears: "ทุกปีการศึกษา",
    scholarshipYear: "ปีการศึกษา (พ.ศ.)",
    academicYear: "ปีการศึกษา", institution: "สถานศึกษา",
    level: "ระดับชั้น", status: "สถานะ",
    resetSearch: "รีเซ็ต", searchBtn: "ค้นหา",
    showing: "แสดง", of: "จาก", records: "รายการ",
    noData: "ไม่พบข้อมูล", noDataHint: "ลองเพิ่มนักเรียนหรือเปลี่ยนตัวกรอง",
    /* Table Headers */
    stipNo: "รหัสทุน", namePhoto: "รูป / ชื่อ-สกุล",
    instLevel: "สถานศึกษา / ชั้นปี", phone: "โทรศัพท์",
    actions: "จัดการ",
    /* Actions */
    view: "ดูข้อมูล", edit: "แก้ไข", print: "พิมพ์", delete: "ลบ",
    deleteConfirm: "ยืนยันการลบ?", deleteWarn: "ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้",
    confirmDelete: "ใช่ ลบเลย", cancel: "ยกเลิก", save: "บันทึก",
    saving: "กำลังบันทึก...", saved: "บันทึกสำเร็จ",
    updated: "อัปเดตสำเร็จ", deleted: "ลบสำเร็จ", error: "เกิดข้อผิดพลาด",
    /* Form */
    addStudentTitle: "เพิ่มนักเรียนใหม่", editStudentTitle: "แก้ไขข้อมูล: ",
    bulkInsert: "นำเข้าข้อมูลจำนวนมาก", templateDL: "ดาวน์โหลดแบบฟอร์ม",
    importCSV: "นำเข้าไฟล์ CSV",
    secA: "ก. ข้อมูลการระบุตัวตน", secB: "ข. ข้อมูลการศึกษา",
    secC: "ค. ข้อมูลส่วนตัว", secD: "ง. ข้อมูลติดต่อและที่อยู่",
    secE: "จ. ข้อมูลครอบครัว", secF: "ฉ. หมายเหตุเพิ่มเติม",
    /* Form Labels */
    scholarshipStatus: "สถานะทุนการศึกษา",
    stipNoLabel: "รหัสทุน (Stip No.)", idCard: "เลขบัตรประชาชน (13 หลัก)",
    birthYear: "ปีเกิด (ค.ศ.)", birthYearHint: "ใช้เป็นรหัสผ่านนักเรียน",
    institutionLabel: "สถานที่ศึกษา", otherInst: "ระบุชื่อสถานศึกษา",
    currentLevel: "ระดับชั้นที่กำลังศึกษา", studentId: "รหัสนักเรียน/นักศึกษา",
    scholarshipYearLabel: "ปีการศึกษาที่ได้รับทุน (ค.ศ.)",
    entryYear: "ปีการศึกษาที่เข้าเรียน (ค.ศ.)", entryTerm: "ภาคเรียนที่เข้า",
    major: "แผนการเรียน / สาขาวิชา", department: "แผนกวิชา",
    oldSchool: "สถานศึกษาเดิม (ก่อนรับทุน)",
    /* University */
    uniSection: "ข้อมูลมหาวิทยาลัย", uniName: "ชื่อมหาวิทยาลัย",
    courseDuration: "ระยะเวลาหลักสูตร (ปี)", uniProvince: "จังหวัดที่ตั้ง",
    faculty: "คณะ", uniMajor: "สาขาวิชา",
    /* Personal */
    uploadPhoto: "อัปโหลดรูปภาพ", photoHint: "JPG/PNG ขนาดไม่เกิน 2MB",
    driveUrl: "หรือวาง Google Drive URL",
    scanIdCard: "สแกนบัตรประชาชน (OCR)", scanHint: "ถ่ายรูปบัตรเพื่อดึงข้อมูลอัตโนมัติ",
    titleLabel: "คำนำหน้า", firstName: "ชื่อ", lastName: "นามสกุล",
    noSurname: "ไม่มีนามสกุล", engTitle: "คำนำหน้า (อังกฤษ)",
    engFirstName: "ชื่อภาษาอังกฤษ", engLastName: "นามสกุลภาษาอังกฤษ",
    nickname: "ชื่อเล่น", gender: "เพศ", nationality: "สัญชาติ",
    religion: "ศาสนา", talent: "ความสามารถพิเศษ",
    weight: "น้ำหนัก (กก.)", height: "ส่วนสูง (ซม.)",
    bloodType: "หมู่เลือด", disease: "โรคประจำตัว",
    /* Contact */
    phone1: "หมายเลขโทรศัพท์ 1", phone2: "หมายเลขโทรศัพท์ 2",
    currentAddress: "ที่อยู่ปัจจุบัน",
    village: "ชื่อหมู่บ้าน", houseNo: "บ้านเลขที่",
    moo: "หมู่ที่", tambon: "ตำบล/แขวง",
    amphoe: "อำเภอ/เขต", province: "จังหวัด",
    /* Family */
    parentStatus: "สถานภาพบิดา-มารดา", specifyStatus: "ระบุสถานภาพ",
    father: "บิดา (พ่อ)", mother: "มารดา / ผู้ปกครอง",
    parentIdCard: "เลขบัตรประชาชน (ถ้ามี)",
    /* Profile */
    personalInfo: "ข้อมูลประวัติส่วนตัว",
    academicInfo: "ข้อมูลการศึกษา", contactInfo: "ข้อมูลติดต่อ",
    familyInfo: "ข้อมูลครอบครัว", uniInfo: "ข้อมูลมหาวิทยาลัย",
    additionalNotes: "หมายเหตุ", editHistory: "ประวัติการแก้ไข",
    printProfile: "พิมพ์ประวัติ", printDate: "พิมพ์เมื่อ:",
    /* Validation */
    required: "จำเป็น", invalidId: "เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก หรือขึ้นต้น G)",
    fillRequired: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน",
    /* Status TH */
    statusActive: "กำลังศึกษา", statusGraduated: "สำเร็จการศึกษา",
    statusSuspended: "พักการเรียน", statusIncomplete: "ไม่สำเร็จการศึกษา",
    statusResigned: "ลาออกจากทุน", statusUni: "ต่อมหาวิทยาลัย",
    statusOther: "อื่นๆ",
    /* Special */
    continuedScholarship: "ทุนต่อ", alumniGroup: "ศิษย์เก่า",
    /* Misc */
    year: "ปี", term: "ภาคเรียน", male: "ชาย", female: "หญิง",
    unknown: "ไม่ทราบ", none: "ไม่มี", other: "อื่นๆ",
    yes: "ใช่", no: "ไม่ใช่", confirm: "ยืนยัน", close: "ปิด",
    success: "สำเร็จ", warning: "แจ้งเตือน", info: "ข้อมูล",
    network_error: "ไม่สามารถเชื่อมต่อฐานข้อมูลได้",
  },
  en: {
    appName: "Scholarship Management System",
    foundation: "Dr. Robert Dyckerhoff Foundation — Thailand",
    foundationShort: "Dr. Robert Dyckerhoff Foundation",
    loading: "Loading...", saving: "Saving...",
    connecting: "Connecting...", deleting: "Deleting...",
    loginTitle: "System Login", loginSubtitle: "Please login to continue",
    username: "Username / ID Card", password: "Password",
    loginAs: "Login As", loginBtn: "Login",
    loginHint: "Student: ID Card / Student ID / Phone | Password: Birth Year (C.E.)",
    roleAdmin: "Administrator", roleStudent: "Scholarship Student",
    logout: "Logout", logoutConfirm: "Confirm Logout?",
    loginFailed: "Invalid username or password",
    backToDashboard: "Back to Dashboard", backToList: "Back to List",
    dashboard: "Dashboard", welcome: "Welcome",
    totalStudents: "Total Students",
    mbsStudents: "MBS Students", vcStudents: "VC Students",
    uniStudents: "University Students", alumni: "Alumni",
    menuStudents: "Student Profiles",
    menuStudentsDesc: "Add, edit, view and print student profiles",
    menuAcademic: "Academic Records",
    menuAcademicDesc: "Manage grades and academic records",
    menuSettings: "System Settings",
    menuSettingsDesc: "Manage admins and system configuration",
    studentList: "Student List",
    addStudent: "Add Student", refresh: "Refresh",
    search: "Search...", searchPlaceholder: "Search name, Stip No., ID...",
    advancedSearch: "Advanced Search", hideAdvSearch: "Hide Advanced Search",
    allInstitutions: "All Institutions", allStatus: "All Status",
    allLevels: "All Levels", allYears: "All Years",
    scholarshipYear: "Academic Year",
    academicYear: "Academic Year", institution: "Institution",
    level: "Level", status: "Status",
    resetSearch: "Reset", searchBtn: "Search",
    showing: "Showing", of: "of", records: "records",
    noData: "No data found", noDataHint: "Try adding a student or changing filters",
    stipNo: "Stip No.", namePhoto: "Photo / Name",
    instLevel: "Institution / Level", phone: "Phone",
    actions: "Actions",
    view: "View", edit: "Edit", print: "Print", delete: "Delete",
    deleteConfirm: "Confirm Delete?", deleteWarn: "This action cannot be undone",
    confirmDelete: "Yes, Delete", cancel: "Cancel", save: "Save",
    saving: "Saving...", saved: "Saved!", updated: "Updated!", deleted: "Deleted!", error: "Error",
    addStudentTitle: "Add New Student", editStudentTitle: "Edit Student: ",
    bulkInsert: "Bulk Insert", templateDL: "Download Template", importCSV: "Import CSV",
    secA: "A. Identification", secB: "B. Academic Information",
    secC: "C. Personal Information", secD: "D. Contact & Address",
    secE: "E. Family Information", secF: "F. Additional Notes",
    scholarshipStatus: "Scholarship Status",
    stipNoLabel: "Stip No.", idCard: "ID Card Number (13 digits)",
    birthYear: "Birth Year (C.E.)", birthYearHint: "Used as student login password",
    institutionLabel: "Institution", otherInst: "Specify Institution",
    currentLevel: "Current Level", studentId: "Student ID",
    scholarshipYearLabel: "Scholarship Year (C.E.)",
    entryYear: "Entry Year (C.E.)", entryTerm: "Entry Term",
    major: "Study Plan / Major", department: "Department",
    oldSchool: "Previous School",
    uniSection: "University Details", uniName: "University Name",
    courseDuration: "Course Duration (years)", uniProvince: "Province",
    faculty: "Faculty", uniMajor: "Major / Program",
    uploadPhoto: "Upload Photo", photoHint: "JPG/PNG max 2MB",
    driveUrl: "Or paste Google Drive URL",
    scanIdCard: "Scan ID Card (OCR)", scanHint: "Take a photo to auto-fill data",
    titleLabel: "Title", firstName: "First Name", lastName: "Last Name",
    noSurname: "No Surname", engTitle: "Title (English)",
    engFirstName: "First Name (English)", engLastName: "Last Name (English)",
    nickname: "Nickname", gender: "Gender", nationality: "Nationality",
    religion: "Religion", talent: "Special Talents",
    weight: "Weight (kg)", height: "Height (cm)",
    bloodType: "Blood Type", disease: "Congenital Disease",
    phone1: "Phone 1", phone2: "Phone 2",
    currentAddress: "Current Address",
    village: "Village Name", houseNo: "House No.",
    moo: "Moo (Village No.)", tambon: "Sub-district",
    amphoe: "District", province: "Province",
    parentStatus: "Parents Status", specifyStatus: "Specify Status",
    father: "Father", mother: "Mother / Guardian",
    parentIdCard: "ID Card (optional)",
    personalInfo: "Personal Information",
    academicInfo: "Academic Information", contactInfo: "Contact Information",
    familyInfo: "Family Information", uniInfo: "University Information",
    additionalNotes: "Additional Notes", editHistory: "Edit History",
    printProfile: "Print Profile", printDate: "Printed on:",
    required: "Required", invalidId: "Invalid ID card (13 digits or starts with G)",
    fillRequired: "Please fill in all required fields",
    statusActive: "Active", statusGraduated: "Graduated",
    statusSuspended: "Suspended", statusIncomplete: "Incomplete",
    statusResigned: "Resigned", statusUni: "Promoted to University", statusOther: "Other",
    continuedScholarship: "Continued", alumniGroup: "Alumni",
    year: "Year", term: "Term", male: "Male", female: "Female",
    unknown: "Unknown", none: "None", other: "Other",
    yes: "Yes", no: "No", confirm: "Confirm", close: "Close",
    success: "Success", warning: "Warning", info: "Information",
    network_error: "Cannot connect to database",
  }
};

function t(key) { return T[LANG][key] || T['th'][key] || key; }

function setLang(lang) {
  LANG = lang;
  localStorage.setItem('rdfLang', lang);
  document.querySelectorAll('[data-t]').forEach(el => {
    const key = el.getAttribute('data-t');
    const attr = el.getAttribute('data-t-attr');
    if (attr) { el.setAttribute(attr, t(key)); }
    else { el.textContent = t(key); }
  });
  // Update lang button
  const btn = document.getElementById('langBtn');
  if (btn) btn.textContent = lang === 'th' ? 'EN' : 'TH';
}

function toggleLang() { setLang(LANG === 'th' ? 'en' : 'th'); }

// Apply on load
document.addEventListener('DOMContentLoaded', () => setLang(LANG));
