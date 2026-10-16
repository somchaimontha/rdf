# Repository instructions

## ข้อกำหนด i18n ภาษาไทยและอังกฤษ

งานที่เพิ่มหรือแก้ไขส่วนติดต่อผู้ใช้ต้องรองรับทั้งภาษาไทย (`th`) และภาษาอังกฤษ (`en`) ก่อนถือว่างานเสร็จสมบูรณ์

- ห้ามเพิ่มข้อความที่ผู้ใช้มองเห็นแบบภาษาเดียว ให้เพิ่ม key เดียวกันใน `T.th` และ `T.en` ที่ `assets/js/i18n.js`
- ข้อความใน HTML ให้ใช้ `data-t` ส่วน placeholder, tooltip, aria-label และ alt ให้ใช้ `data-t-placeholder`, `data-t-title`, `data-t-aria-label` และ `data-t-alt`
- ข้อความที่สร้างด้วย JavaScript ให้ใช้ `t(key)` หรือ `bi(th, en)` และใช้ formatter ส่วนกลางกับสถานะ ระดับชั้น ปีการศึกษา บทบาท และค่าที่มีรูปแบบตามภาษา
- ข้อความจาก API ที่แสดงต่อผู้ใช้ต้องผ่าน `localizeApiMessage()` เมื่อรองรับ ห้ามเปลี่ยนค่าที่จัดเก็บ รหัส ข้อมูลผู้ใช้ หรือข้อมูลที่ส่งกลับ API เพียงเพื่อการแปล
- การสลับภาษาต้องอัปเดตเนื้อหาที่สร้างแบบ dynamic โดยไม่โหลดข้อมูลซ้ำ และต้องรักษาค่าฟอร์ม ตัวกรอง ตัวเลือก และสถานะงานที่ยังไม่บันทึก
- เมื่อเพิ่ม key ให้ตรวจว่าพจนานุกรมไทยและอังกฤษมี key ตรงกัน และเพิ่มหรือปรับการทดสอบเมื่อเกิดพฤติกรรมใหม่
- ก่อน commit ให้รัน `node --test tests/i18n.test.cjs` และ `git diff --check` หากแก้การสลับภาษาหรือ DOM แบบ dynamic ให้รัน `node tests/i18n.browser.cjs 9222` ตามขั้นตอนใน `tests/README.md` ด้วย

## การแยกบัญชี Google Apps Script

เครื่องนี้ใช้ `clasp` กับหลายโครงการ ห้ามใช้คำสั่ง `clasp` แบบไม่ระบุผู้ใช้กับ repository นี้

- ทุกคำสั่ง Apps Script ของ RDF ต้องใช้ named credential `rdf` เช่น `clasp -u rdf status`, `clasp -u rdf push` และ `clasp -u rdf redeploy ...`
- ก่อน `push`, `version` หรือ `redeploy` ต้องรัน `clasp -u rdf show-authorized-user` และยืนยันว่าเป็นบัญชีเจ้าของโครงการ RDF
- ห้าม `clasp logout` หรือเขียนทับ credential `default` เพราะเป็นบัญชีของโครงการอื่นบนเครื่องเดียวกัน
- ต้อง deploy backend และตรวจ staging/production ให้ผ่านก่อน push frontend เพื่อป้องกัน frontend และ API คนละเวอร์ชัน
