/* ── RDF Config ── */
const RDF = {
  GAS_URL: "https://script.google.com/macros/s/AKfycbyJwHM-vyqSddDfqSu1puLc86E42O6Pxjg4PHRfhuCSvc4fcmuNp1YS85OvYMWdAlc2/exec",
  LOGO_URL: "https://raw.githubusercontent.com/somchaimontha/rdf/refs/heads/main/RDF%20original%20s%20(2).png",
  FOUNDATION_TH: "มูลนิธิ ดร.โรเบิร์ต ไดเกอร์ฮอฟฟ์ ประเทศไทย",
  FOUNDATION_EN: "Dr. Robert Dyckerhoff Foundation — Thailand",
  VERSION: "2.0.0",
  DEFAULT_LANG: "th",
  INSTITUTION_LABELS: { MBS:"Maesariang Boripat Suksa School", VC:"Vocational College", UNI:"University", OTHER:"อื่นๆ" },
  INST_COLORS: { MBS:"#1d4ed8", VC:"#ea580c", UNI:"#7c3aed", OTHER:"#64748b" },
  STATUS_LABELS_TH: {
    Active:"กำลังศึกษา", Graduated:"สำเร็จการศึกษา", Suspended:"พักการเรียน",
    Incomplete:"ไม่สำเร็จการศึกษา", Resigned:"ลาออกจากทุน",
    University:"ต่อมหาวิทยาลัย", Other:"อื่นๆ"
  },
  STATUS_LABELS_EN: {
    Active:"Active", Graduated:"Graduated", Suspended:"Suspended",
    Incomplete:"Incomplete", Resigned:"Resigned", University:"Promoted to Uni", Other:"Other"
  },
  STATUS_COLORS: {
    Active:"badge-green", Graduated:"badge-purple", Suspended:"badge-orange",
    Incomplete:"badge-red", Resigned:"badge-red", University:"badge-blue", Other:"badge-gray"
  },
  /* ── Majors/Departments — admin can extend these via Settings ── */
  MAJORS: {
    MBS: [
      'วิทยาศาสตร์-คณิตศาสตร์',
      'วิทยาศาสตร์',
      'ภาษาอังกฤษ',
      'ดิจิทัล',
      'ศิลป์คำนวณ',
      'ศิลป์ภาษาอังกฤษ',
      'ศิลป์ภาษาจีน',
      'ศิลป์ภาษาญี่ปุ่น',
      'ศิลป์ทั่วไป'
    ],
    VC: [
      'ช่างยนต์',
      'ช่างไฟฟ้า',
      'ช่างก่อสร้าง',
      'เทคโนโลยีสารสนเทศ',
      'การบัญชี'
    ]
  },
  DEPARTMENTS: {
    VC: [
      'ช่างยนต์',
      'ช่างไฟฟ้า',
      'ช่างก่อสร้าง',
      'เทคโนโลยีสารสนเทศ',
      'การบัญชี'
    ]
  }
};

/* ── Profile Completion Sections ── */
RDF.PROFILE_SECTIONS = [
  { key:'identity', label_th:'ข้อมูลระบุตัวตน',      label_en:'Identity',         fields:['IDCard','Title','FirstName','LastName','BirthYear'],                        weight:25 },
  { key:'academic', label_th:'ข้อมูลการศึกษา',        label_en:'Academic',         fields:['Institution','CurrentLevel','ScholarshipYear','EntryYear'],                 weight:20 },
  { key:'personal', label_th:'ข้อมูลส่วนตัว',         label_en:'Personal',         fields:['Sex','Nationality','Religion','Phone1'],                                    weight:20 },
  { key:'address',  label_th:'ที่อยู่และติดต่อ',      label_en:'Contact & Address', fields:['Province','Amphoe','Tambon'],                                              weight:15 },
  { key:'family',   label_th:'ข้อมูลครอบครัว',        label_en:'Family',           fields:['ParentStatus','Parent1_FirstName','Parent1_LastName'],                     weight:10 },
  { key:'photo',    label_th:'รูปโปรไฟล์',            label_en:'Profile Photo',    fields:['ProfilePicURL'],                                                           weight:10 },
];

function calcProfileCompletion(student) {
  if (!student) return { pct:0, sections:[], color:'#ef4444' };
  let totalW = 0, earnedW = 0;
  const sections = RDF.PROFILE_SECTIONS.map(sec => {
    const missing = sec.fields.filter(f => !student[f] || student[f].toString().trim() === '');
    const filled  = sec.fields.length - missing.length;
    totalW  += sec.weight;
    earnedW += (sec.fields.length ? (filled / sec.fields.length) : 1) * sec.weight;
    return { ...sec, filled, total: sec.fields.length, pct: sec.fields.length ? Math.round(filled/sec.fields.length*100) : 100, missing };
  });
  const pct = Math.round(earnedW / totalW * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return { pct, sections, color };
}

/* ── Number Formatting Utilities ── */
function fmtPhone(p) {
  if (!p) return '—';
  const s = String(p).replace(/\D/g, '');
  if (s.length === 10) return s.slice(0,3) + '-' + s.slice(3,6) + '-' + s.slice(6);
  if (s.length === 9)  return s.slice(0,2) + '-' + s.slice(2,5) + '-' + s.slice(5);
  return String(p);
}

function fmtIDCard(id) {
  if (!id) return '—';
  const s = String(id).replace(/\D/g, '');
  if (s.length === 13) return `${s[0]}-${s.slice(1,5)}-${s.slice(5,10)}-${s.slice(10,12)}-${s[12]}`;
  return String(id);
}

/* ── Age Calculation ── */
function calcAgeFromDOB(year, month, day) {
  if (!year) return null;
  const y = parseInt(year), m = parseInt(month)||1, d = parseInt(day)||1;
  if (isNaN(y)) return null;
  const today = new Date();
  const birth = new Date(y, m-1, d);
  let age = today.getFullYear() - birth.getFullYear();
  const mo = today.getMonth() - birth.getMonth();
  if (mo < 0 || (mo === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

/* ── Thai month names ── */
RDF.MONTHS_TH = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                 'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
RDF.MONTHS_EN = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];
