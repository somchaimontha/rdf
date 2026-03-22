/* ── RDF OCR Module — Thai ID Card Scanner ──
   Uses Tesseract.js for client-side OCR
   Extracts: ID card number (13 digits), name, surname from Thai ID card
*/

let ocrStream = null;

function openOCRModal() {
  document.getElementById('ocrModal').classList.remove('hidden');
  startCamera();
}

function closeOCRModal() {
  stopCamera();
  document.getElementById('ocrModal').classList.add('hidden');
  document.getElementById('ocrResult').textContent = '';
  document.getElementById('ocrStatus').textContent = '';
}

async function startCamera() {
  const video = document.getElementById('ocrVideo');
  const statusEl = document.getElementById('ocrStatus');
  try {
    ocrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = ocrStream;
    video.play();
    statusEl.textContent = LANG === 'th' ? 'กล้องพร้อม — วางบัตรให้ตรงกรอบแล้วกดถ่ายรูป' : 'Camera ready — place ID card in frame and capture';
  } catch (e) {
    statusEl.textContent = LANG === 'th' ? 'ไม่สามารถเปิดกล้องได้: ' + e.message : 'Cannot access camera: ' + e.message;
  }
}

function stopCamera() {
  if (ocrStream) { ocrStream.getTracks().forEach(t => t.stop()); ocrStream = null; }
  const video = document.getElementById('ocrVideo');
  if (video) video.srcObject = null;
}

function captureAndProcess() {
  const video = document.getElementById('ocrVideo');
  const canvas = document.getElementById('ocrCanvas');
  const status = document.getElementById('ocrStatus');
  if (!video || !video.srcObject) { status.textContent = LANG === 'th' ? 'กล้องยังไม่พร้อม' : 'Camera not ready'; return; }

  const ctx = canvas.getContext('2d');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  status.textContent = LANG === 'th' ? '⏳ กำลังประมวลผล OCR...' : '⏳ Processing OCR...';
  document.getElementById('ocrCaptureBtn').disabled = true;

  // Tesseract OCR
  Tesseract.recognize(canvas, 'tha+eng', {
    logger: m => {
      if (m.status === 'recognizing text') {
        status.textContent = (LANG === 'th' ? 'กำลังอ่านข้อความ: ' : 'Reading: ') + Math.round(m.progress * 100) + '%';
      }
    }
  }).then(({ data: { text } }) => {
    document.getElementById('ocrCaptureBtn').disabled = false;
    const extracted = extractIDCardData(text);
    document.getElementById('ocrResult').innerHTML = formatOCRResult(extracted, text);
    status.textContent = LANG === 'th' ? '✅ อ่านข้อมูลเสร็จสิ้น กรุณาตรวจสอบข้อมูลด้านล่าง' : '✅ Done — please review extracted data below';
  }).catch(err => {
    document.getElementById('ocrCaptureBtn').disabled = false;
    status.textContent = (LANG === 'th' ? 'เกิดข้อผิดพลาด: ' : 'Error: ') + err.message;
  });
}

function extractIDCardData(rawText) {
  const result = {};
  const clean = rawText.replace(/\n/g, ' ').replace(/\s+/g, ' ');

  // Extract 13-digit ID number (Thai ID cards have format: x xxxx xxxxx xx x)
  const idMatch = clean.match(/\b(\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d)\b/) ||
                  clean.match(/\b\d{13}\b/);
  if (idMatch) result.idCard = idMatch[0].replace(/[\s-]/g, '');

  // Extract name (Thai: look for ชื่อ or Name)
  const nameMatch = clean.match(/(?:ชื่อ|Name)[:\s]+([ก-๙a-zA-Z]+(?:\s+[ก-๙a-zA-Z]+)?)/i);
  if (nameMatch) result.firstName = nameMatch[1].trim();

  // Extract surname (นามสกุล or Last Name or Surname)
  const surnameMatch = clean.match(/(?:นามสกุล|Last\s*Name|Surname)[:\s]+([ก-๙a-zA-Z]+(?:\s+[ก-๙a-zA-Z]+)?)/i);
  if (surnameMatch) result.lastName = surnameMatch[1].trim();

  // Extract date of birth (วันเกิด or Date of Birth: dd mmm yyyy)
  const dobMatch = clean.match(/(\d{1,2})\s+(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(\d{4})/);
  if (dobMatch) {
    const beYear = parseInt(dobMatch[2]);
    result.birthYear = beYear > 2500 ? beYear - 543 : beYear;
  }

  // Title (คำนำหน้า)
  if (/นาย/.test(clean)) result.title = 'นาย';
  else if (/นางสาว/.test(clean)) result.title = 'นางสาว';
  else if (/นาง/.test(clean)) result.title = 'นาง';

  return result;
}

function formatOCRResult(data, raw) {
  const lang = LANG;
  let html = '<div class="space-y-2 text-sm">';
  if (data.idCard)    html += `<div><strong>${lang==='th'?'เลขบัตร':'ID Card'}:</strong> <span class="text-blue-700 font-bold">${data.idCard}</span></div>`;
  if (data.title)     html += `<div><strong>${lang==='th'?'คำนำหน้า':'Title'}:</strong> ${data.title}</div>`;
  if (data.firstName) html += `<div><strong>${lang==='th'?'ชื่อ':'First Name'}:</strong> ${data.firstName}</div>`;
  if (data.lastName)  html += `<div><strong>${lang==='th'?'นามสกุล':'Last Name'}:</strong> ${data.lastName}</div>`;
  if (data.birthYear) html += `<div><strong>${lang==='th'?'ปีเกิด (ค.ศ.)':'Birth Year'}:</strong> ${data.birthYear}</div>`;
  if (!Object.keys(data).length) html += `<p class="text-red-500">${lang==='th'?'ไม่พบข้อมูลที่ต้องการ กรุณาถ่ายรูปอีกครั้ง':'No data found — please try again'}</p>`;
  html += `<button onclick="applyOCRData(${JSON.stringify(data).replace(/"/g,"'")})" class="btn btn-primary btn-sm mt-2">
    ${lang==='th'?'✓ ใช้ข้อมูลนี้':'✓ Use this data'}
  </button>`;
  html += '</div>';
  return html;
}

function applyOCRData(data) {
  if (data.idCard)    { const el = document.getElementById('f_idcard');    if (el) el.value = data.idCard; }
  if (data.title)     { const el = document.getElementById('f_title');     if (el) el.value = data.title; }
  if (data.firstName) { const el = document.getElementById('f_fname');     if (el) el.value = data.firstName; }
  if (data.lastName)  { const el = document.getElementById('f_lname');     if (el) el.value = data.lastName; }
  if (data.birthYear) { const el = document.getElementById('f_birthYear'); if (el) el.value = data.birthYear; }
  closeOCRModal();
  Swal.fire({
    title: LANG === 'th' ? 'นำเข้าข้อมูลสำเร็จ' : 'Data Applied',
    text: LANG === 'th' ? 'กรุณาตรวจสอบและแก้ไขข้อมูลก่อนบันทึก' : 'Please verify data before saving',
    icon: 'success', confirmButtonColor: '#1e3a8a', timer: 3000
  });
}

/* ── OCR Modal HTML (inject into page) ── */
function injectOCRModal() {
  if (document.getElementById('ocrModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
  <div id="ocrModal" class="hidden fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
      <div class="bg-rdfBlue text-white p-4 flex justify-between items-center" style="background:var(--rdf-blue)">
        <h3 class="font-bold text-base flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          ${LANG==='th'?'สแกนบัตรประชาชน (OCR)':'Scan ID Card (OCR)'}
        </h3>
        <button onclick="closeOCRModal()" class="text-white opacity-75 hover:opacity-100 text-xl font-bold">&times;</button>
      </div>
      <div class="p-4">
        <div class="relative bg-black rounded-xl overflow-hidden mb-3" style="aspect-ratio:16/9">
          <video id="ocrVideo" class="w-full h-full object-cover" autoplay muted playsinline></video>
          <canvas id="ocrCanvas" class="hidden"></canvas>
          <!-- Card guide overlay -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="border-2 border-yellow-400 rounded-lg opacity-75" style="width:85%;aspect-ratio:1.586"></div>
          </div>
        </div>
        <p id="ocrStatus" class="text-xs text-gray-500 mb-3 text-center min-h-4"></p>
        <div class="flex gap-2 mb-3">
          <button id="ocrCaptureBtn" onclick="captureAndProcess()" class="btn btn-primary btn-full">
            📷 ${LANG==='th'?'ถ่ายและอ่านข้อมูล':'Capture & Scan'}
          </button>
          <button onclick="closeOCRModal()" class="btn btn-secondary">${LANG==='th'?'ยกเลิก':'Cancel'}</button>
        </div>
        <div id="ocrResult" class="bg-blue-50 rounded-lg p-3 text-sm min-h-8 border border-blue-100"></div>
      </div>
    </div>
  </div>`);
}

document.addEventListener('DOMContentLoaded', injectOCRModal);
