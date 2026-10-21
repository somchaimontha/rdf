# แผนพัฒนาระบบติดตามศิษย์เก่าแบบเชื่อมโยงครบวงจร

สถานะเอกสาร: **แผนดำเนินงานหลังการตรวจโครงสร้างรอบสอง**
ปรับปรุงล่าสุด: ตุลาคม 21 2569

เอกสารนี้แปลงเป้าหมายใน [ALUMNI_SURVEY_SYSTEM_DESIGN.md](ALUMNI_SURVEY_SYSTEM_DESIGN.md)
ให้เป็นลำดับพัฒนาที่นำไปสร้าง issue, commit, ทดสอบ และ deploy ได้จริง โดยยึดโค้ดปัจจุบันเป็น baseline
และไม่ถือว่าส่วนที่อยู่ในเอกสารออกแบบถูกติดตั้งแล้วจนกว่าจะผ่านเกณฑ์ตรวจรับของ release นั้น

## 1. ผลลัพธ์ที่ต้องได้

ระบบสุดท้ายต้องทำให้ข้อมูลหนึ่งคนเชื่อมกันด้วย `StipNo` โดยไม่สร้างฐานข้อมูลบุคคลซ้ำ และให้รอบติดตาม
แบบสอบถาม งานติดตาม ภาวะการทำงาน โปรไฟล์ และรายงาน ใช้ขอบเขตบุคคลชุดเดียวกัน

```text
Students (StipNo — ข้อมูลบุคคลหลัก)
└── TrackingParticipants (CycleID + StipNo — กลุ่มเป้าหมายที่ตรึงแล้ว)
    └── TrackingCases (งานติดตามหนึ่งคนต่อหนึ่งรอบ)
        ├── SurveyAssignments
        │   └── SurveyResponses → SurveyAnswers
        │       └── DataChangeProposals → ตรวจอนุมัติ → ข้อมูลหลัก
        ├── EmploymentFollowUps (CycleID + CaseID + visibility)
        └── EmploymentObservations (ข้อมูลยืนยัน ณ เวลานั้นแบบ append-only)
```

รายงานรอบติดตามต้องเริ่มจาก `TrackingParticipants` เสมอ ไม่เริ่มจาก follow-up หรือคำตอบแบบสอบถาม
เพราะผู้ที่ยังไม่เคยติดต่อและผู้ที่ยังไม่ตอบยังเป็นสมาชิกของกลุ่มเป้าหมาย

## 2. หลักการที่ห้ามละเมิด

1. `Students.StipNo` เป็นรหัสบุคคลหลักในช่วงเปลี่ยนผ่าน และ API เดิมต้องยังทำงานได้
2. การเผยแพร่รอบต้องตรึงกลุ่มเป้าหมาย และการลองซ้ำต้องไม่สร้าง participant, case หรือ assignment ซ้ำ
3. คำตอบแบบสอบถามเป็นหลักฐาน ไม่ใช่ข้อมูลโปรไฟล์โดยอัตโนมัติ
4. เฉพาะแบบ `identified` เท่านั้นที่เสนอแก้โปรไฟล์ได้ และเริ่มต้นด้วยการตรวจอนุมัติทุกครั้ง
5. หมายเหตุภายใน เจ้าของงาน และข้อมูล audit ห้ามส่งให้บัญชีศิษย์เก่า
6. รายงานรอบที่ปิดแล้วต้องสร้างซ้ำได้โดยได้ข้อมูลและ fingerprint เดิม
7. Migration ต้อง additive, idempotent, มี preview และย้อนกลับด้วย feature flag ได้
8. Backend production ต้องพร้อมและเข้ากันได้กับ frontend เดิมก่อน push GitHub Pages
9. UI ใหม่ทุกส่วนต้องรองรับ `th`/`en`, formatter วันที่ส่วนกลาง, RBAC และ accessibility

## 3. แผนรุ่นส่งมอบ

| รุ่น | เป้าหมาย | Dependency | เงื่อนไข Go/No-Go หลัก |
|---|---|---|---|
| R0 | ความปลอดภัยของข้อมูลและรายงานปัจจุบันที่ไม่ทำให้เข้าใจผิด | ไม่มี | ไม่สร้าง orphan, ไม่เปิดเผย internal note, ไม่ตัดผู้ไม่เคยติดตามออก |
| R1 | กลุ่มเป้าหมายและ case กลาง | R0 | หนึ่ง participant/case ต่อ `CycleID + StipNo` ภายใต้ retry/concurrency |
| R2 | Profile 360, case workspace และรายงานรายรอบจาก cohort เดียวกัน | R1 | หน้าจอและ export ได้จำนวนคนชุดเดียวกัน |
| R3 | รุ่นแบบสอบถาม ชุดหลายแบบ และ privacy ที่บังคับจริง | R1 | คำตอบเดิมอ่านจากรุ่นเดิมและไม่มีข้อมูลลับรั่ว |
| R4 | คำตอบเสนอแก้ข้อมูลและรายงานย้อนหลังจริง | R2, R3 | อนุมัติซ้ำไม่เขียนซ้ำ และรายงานปิดรอบไม่เปลี่ยนภายหลัง |
| R5 | การแจ้งเตือน รายงานทางการ ประสิทธิภาพ และเลิก legacy | R4 | workflow ครบวงจรผ่าน staging และ rollback ได้ |

ห้ามข้าม R0 และ R1 เพื่อเริ่มจากหน้าจอใหม่ เพราะจะทำให้ UI ใหม่อ้างข้อมูลที่ยังไม่มี referential integrity
หรือกลุ่มเป้าหมายกลางรองรับ

## 4. R0 — ความปลอดภัยและความถูกต้องขั้นต่ำ

### งานข้อมูลและ Backend

- เพิ่ม integrity preview แบบอ่านอย่างเดียว เพื่อตรวจ:
  - `Students.StipNo` ซ้ำ
  - `CustomFieldValues`, `EmploymentFollowUps`, `SurveyAssignments` และ `SurveyResponses` ที่ไม่มี student
  - assignment ซ้ำที่ `CampaignID + StipNo`
  - response มากกว่าหนึ่งรายการต่อ assignment
- เพิ่ม `MigrationLedger` สำหรับเก็บ migration key, รุ่น, สถานะ, จำนวนแถว, checksum, ผู้รัน และเวลา
- เพิ่ม feature mode `legacy`, `dual_read`, `unified` โดยค่าเริ่มต้นยังเป็น `legacy`
- ปิดการ merge ต่าง `StipNo` ชั่วคราวเมื่อพบข้อมูลลูก จนกว่าจะมี atomic re-key service
- เปลี่ยน delete นักเรียนที่มีข้อมูลลูกเป็น archive หรือปฏิเสธพร้อม dependency preview
- แยก follow-up เป็น `PublicNote` และ `InternalNote` พร้อม server-shaped DTO ตาม role
- เมื่อเจ้าของ assignment เปิดแบบสอบถามครั้งแรก ให้ตั้ง `OpenedAt` และสถานะ `opened` แบบ idempotent

### งานรายงานเร่งด่วน

- เก็บ `cycleId`, `institution`, `asOfMonth`, `from` และ `to` ไว้ตลอดการเลือกรอบ การสลับภาษา และ export
- ช่วงวันที่ follow-up ต้องกรองกิจกรรม ไม่ใช่ตัดบุคคลที่ไม่มีกิจกรรมออก
- ระบุรายงานเดิมให้ชัดว่าเป็น “สถานะปัจจุบัน ณ เดือนคำนวณ” จนกว่าจะมี historical observation
- เพิ่ม `CycleID` และ scope ที่ใช้จริงในข้อมูลลงทะเบียนรายงาน แม้ยังอยู่ในโหมด legacy

### API ที่เสนอ

- `previewStudentDependencies(stipNo)`
- `previewTrackingIntegrity()`
- `archiveStudentIdentity(stipNo, expectedRevision)`
- `getEmploymentReport(filters)` ให้รับ `cycleId` แบบ backward compatible

### เกณฑ์ตรวจรับ R0

- รอบที่มีบุคคล 100 คนและไม่มี follow-up ต้องยังแสดง eligible 100 คน
- การเลือกรอบ MBS ต้องไม่แสดงสถาบันอื่นโดยไม่ได้ร้องขอ
- response สำหรับ Student ต้องไม่มี internal note, assignee, createdBy หรือ updatedBy
- merge/delete ที่จะสร้าง orphan ต้องไม่สำเร็จ
- เปิดแบบสอบถามซ้ำหลายครั้งต้องเพิ่ม opened count เพียงหนึ่งครั้ง
- ชุดทดสอบเดิมทั้งหมดผ่านและเพิ่ม regression tests สำหรับทั้งห้ากรณีข้างต้น

### Rollback

ปิด feature flag ใหม่และกลับไปใช้ reader เดิมได้ โดย R0 ห้ามลบหรือเปลี่ยนหัวคอลัมน์เดิม

## 5. R1 — TrackingParticipants และ TrackingCases

### Schema แบบ additive

เพิ่ม `TrackingParticipants`:

- `ParticipantID`, `CycleID`, `StipNo`
- `CohortKey` ซึ่งคำนวณจาก `CycleID + StipNo`
- inclusion reason และ audience snapshot ที่ผ่าน validation
- `Status`, `CohortRevision`, `Active`
- audit fields

เพิ่ม `TrackingCases`:

- `CaseID`, `ParticipantID`, `CycleID`, `StipNo`
- `OwnerUserID`, `Priority`, `State`, `Outcome`
- `NextActionAt`, `Revision`, `Active`
- audit fields

เพิ่มคอลัมน์ nullable ใน `EmploymentFollowUps`:

- `CycleID`, `ParticipantID`, `CaseID`
- `Visibility`
- `SourceType`, `SourceID`

เนื่องจาก Google Sheets ไม่มี unique/FK constraint ต้องตรวจ `CohortKey` และการอ้างอิงทั้งหมดภายใต้
`LockService` พร้อม integrity check หลังเขียน

### Publish flow ใหม่

```text
preview audience
→ ตรวจ revision ของ cycle
→ lock
→ ตรึง participants
→ สร้าง cases
→ สร้าง assignments จาก participants
→ บันทึกผล publish
→ unlock
```

- รอบที่ไม่เปิดแบบสอบถามต้องสร้าง participants และ cases เช่นเดียวกัน
- การ publish ซ้ำต้องคืน ID และจำนวนเดิม
- ความล้มเหลวกลางทางต้อง retry แล้ว converge ไปยังผลลัพธ์เดียวกัน
- การเพิ่มหรือยกเว้น participant หลังเผยแพร่ต้องเป็น revision ที่มีเหตุผลและ audit ไม่แก้ audience เงียบ ๆ

### Migration

- รอบที่มี survey assignment เดิม: backfill participant จาก assignment เมื่อระบุได้แน่นอน
- รอบเก่าที่ไม่มี survey: ระบุ `legacy_unfrozen` ห้ามอ้างว่าเป็น snapshot ทางประวัติศาสตร์
- follow-up เก่า: เชื่อมรอบเฉพาะเมื่อระบุได้แน่นอน หากกำกวมให้อยู่ migration review queue
- เก็บ legacy columns/readers ไว้ระหว่าง `dual_read`

### API ที่เสนอ

- `previewTrackingCycleAudience(cycleDraft)`
- `publishTrackingCycle(cycleId, expectedRevision)`
- `getTrackingCycleWorkspace(cycleId, filters, cursor)`
- `addTrackingParticipant(cycleId, stipNo, reason, expectedRevision)`
- `exemptTrackingParticipant(participantId, reason, expectedRevision)`

### เกณฑ์ตรวจรับ R1

- มี participant และ case เพียงหนึ่งรายการต่อ `CycleID + StipNo`
- จำนวน participant เท่ากับจำนวน case ยกเว้นรายการ migration ที่ระบุสถานะชัดเจน
- การแก้ `Students` หลัง publish ไม่เปลี่ยน cohort เดิม
- concurrent publish และ retry ไม่สร้างรายการซ้ำ
- ผู้ไม่เคยติดต่อยังอยู่ใน workspace และรายงาน
- migration รอบที่สองได้ `created=0` และ `changed=0`

## 6. R2 — Profile 360, Case Workspace และรายงานจาก cohort

### Profile 360

เพิ่มส่วน “การติดตามและศิษย์เก่า” ในโปรไฟล์:

- ภาวะการทำงานปัจจุบัน แหล่งที่มา และวันที่ยืนยันล่าสุด
- รอบและ case ที่เปิดอยู่ ผู้รับผิดชอบ และงานถัดไปสำหรับเจ้าหน้าที่
- แบบสอบถามที่รอตอบ กำลังตอบ ส่งแล้ว หรือหมดเขต
- ข้อเสนอแก้ข้อมูลที่กำลังรอตรวจ
- timeline สาธารณะ และ timeline ภายในแยกตามสิทธิ์

ใช้ `getStudent360(stipNo, cycleId?)` เป็น permission-shaped read model เพื่อลดการโหลด API ซ้ำ
Student ต้องได้รับเฉพาะข้อมูลของตนและฟิลด์สาธารณะ ส่วนเจ้าหน้าที่เห็นข้อมูลตาม permission และ institution scope

### Case Workspace

ปรับ `tracking-management.html` เป็น master/detail workspace:

- กรอง state, owner, priority, survey status, ความครบถ้วนข้อมูล และกำหนดงาน
- มอบหมายงานรายคนหรือหลายคนโดยมี preview
- เพิ่ม follow-up, next action, outcome, ปิด/เปิด case และยกเว้นพร้อมเหตุผล
- ใช้ stable user ID เป็น owner และใช้ชื่อเพื่อแสดงผลเท่านั้น
- ใช้ optimistic concurrency ผ่าน `expectedRevision`

### รายงานรอบติดตาม

เพิ่ม `getTrackingCycleReport(cycleId, filters, cursor)` โดย:

- เริ่มจาก `TrackingParticipants`
- join case, current employment, follow-up และ survey progress ผ่าน participant
- แยกรายการกิจกรรมออกจากหนึ่งแถวหลักต่อบุคคล เพื่อไม่ให้จำนวนคนคูณซ้ำ
- แสดงผู้ไม่มี follow-up และผู้ยังไม่ตอบเสมอ
- ระบุว่า employment เป็น current-state จนกว่า R4 จะเปิด historical mode

ขยาย `ReportRegistry` แบบ additive ด้วย `CycleID`, `CampaignID`, `CohortRevision`, `CutoffAt`,
`SourceWatermarkJSON` และ `ReportSchemaVersion`

### API ที่เสนอ

- `getStudent360(stipNo, cycleId)`
- `getTrackingCase(caseId)`
- `updateTrackingCase(caseId, patch, expectedRevision)`
- `saveCaseFollowUp(caseId, input, expectedRevision)`
- `bulkAssignTrackingCases(input, previewOnly)`
- `getTrackingCycleReport(cycleId, filters, cursor)`

### เกณฑ์ตรวจรับ R2

- profile, workspace, screen report และ export ใช้ cohort และ revision เดียวกัน
- สองคนแก้ case พร้อมกันต้องได้ conflict ไม่ใช่ last-write-wins
- ปิด case ต้องมี outcome และเปิดใหม่ต้องมีเหตุผล
- filter/pagination ไม่เปลี่ยน denominator
- Student เปิดแบบที่ถูกมอบหมายจากโปรไฟล์ได้โดยตรง
- สลับภาษาแล้ว re-render จาก cache โดยไม่เรียก API ซ้ำและไม่เสีย filter/panel state
- keyboard, focus, dialog และ mobile layout ผ่าน accessibility tests

## 7. R3 — Versioning, Survey Sets และ Privacy

### Schema และ compatibility

- เพิ่ม `FormVersionID`, `FormID`, `Version` โดยแยก storage schema version ออกจาก content version
- เพิ่ม `SurveySections`
- เพิ่ม `SurveySets`, `SurveySetVersions`, `SurveySetItems`
- ให้ campaign อ้าง `SetVersionID` ที่ immutable และรองรับหลาย form ต่อ cycle
- ให้ response อ้าง `FormVersionID`
- เก็บ legacy `FormID` และ URL `assignmentId` ให้ใช้งานได้ระหว่างเปลี่ยนผ่าน

สร้าง version 1 snapshot สำหรับ form ที่เผยแพร่แล้ว และเชื่อม campaign/response เดิมโดยไม่แก้คำตอบแบบ destructive

### Response reliability

- บังคับ `AllowDraft` และ `AllowEditAfterSubmit` ฝั่ง Backend
- รับ `expectedRevision` และ idempotency key ตอน save/submit
- เก็บ response revision history แทนการเขียนทับหลักฐานเดิม
- กำหนด unique เชิง application สำหรับ assignment/form version และ answer/question/matrix row
- แก้ matrix analytics ให้นับผู้ตอบและแยก row/column ถูกต้อง

### Privacy modes

- `identified`: เชื่อมบุคคลได้เฉพาะผู้มีสิทธิ์
- `confidential`: ติดตาม completion ภายในได้ แต่ individual result/export ห้ามคืนชื่อหรือ `StipNo`
- `anonymous`: response ห้ามมี `StipNo`, assignment link หรือ token ที่ผู้ดูผลย้อนกลับตัวบุคคลได้

### เกณฑ์ตรวจรับ R3

- เปลี่ยนคำถามที่เผยแพร่แล้วต้องสร้าง version ใหม่
- คำตอบเก่าแสดง prompt/options จาก version เดิมเสมอ
- หนึ่ง cycle ใช้หลาย form ผ่าน set version ได้
- retry/concurrency ไม่สร้าง response หรือ answer ซ้ำ
- privacy tests ตรวจ API, cache, export, logs และหน้าจอแล้วไม่พบข้อมูลรั่ว
- role ที่มี `viewSurveyResults` ไม่สามารถข้ามข้อจำกัด response mode ได้

## 8. R4 — Survey-to-Profile และข้อมูลย้อนหลัง

### Field Binding และ Proposal

เพิ่ม:

- `SurveyFieldBindings` ผูก question version กับ target ที่อนุญาตอย่างชัดเจน
- `DataChangeProposals`
- proposal review/audit records
- provenance เช่น `SourceResponseID`, response revision, binding ID, old-value hash และ target revision

ห้ามเดา target จาก label หรือ `QuestionKey` เพียงอย่างเดียว

```text
submit immutable response
→ สร้าง proposal แบบ idempotent
→ เจ้าหน้าที่ตรวจ old/new/source
→ ตรวจ target revision/hash
→ approve/reject/conflict
→ เขียนผ่าน canonical validation service
→ บันทึก reviewer และ provenance
```

- key ป้องกัน proposal ซ้ำ: `ResponseID + Revision + BindingID`
- เริ่มต้น review-by-default ทุก field
- confidential/anonymous ห้ามสร้าง proposal
- stale proposal ต้องเป็น conflict และห้ามเขียนทับข้อมูลใหม่กว่า

### Historical Employment

เพิ่ม `EmploymentObservations` แบบ append-only สำหรับสถานะที่ยืนยันตามบุคคล รอบ วันที่ และแหล่งข้อมูล
ส่วน `CustomFieldValues` ยังคงเป็น current profile projection

- import สถานะปัจจุบันเป็น baseline observation ที่มีป้ายกำกับว่าเป็นข้อมูล ณ วัน migration
- ห้ามอ้าง baseline นี้ว่าเป็นข้อมูลย้อนหลังที่เกิดก่อน migration
- เมื่อปิดรอบ เก็บ cutoff, cohort revision, observation watermark และ report manifest

### เกณฑ์ตรวจรับ R4

- submit ไม่แก้ `Students` หรือ `CustomFieldValues` โดยตรง
- submit/retry เดิมไม่สร้าง proposal ซ้ำ
- approve ซ้ำไม่เขียนข้อมูลซ้ำ
- conflict ป้องกันการทับข้อมูลที่ถูกแก้หลังสร้าง proposal
- ทุกค่าที่อนุมัติตรวจย้อนกลับถึง response, answer, reviewer และเวลาได้
- แก้โปรไฟล์หลังปิดรอบแล้วสร้างรายงานรอบเดิมได้ hash เดิม
- screen, PDF และ Excel อ่าน snapshot/manifests ชุดเดียวกัน

## 9. R5 — Notifications, Official Reports และ Cutover

### Notifications

เพิ่ม event builders ใน notification feed กลาง:

- `survey.assigned`, `survey.due_soon`, `survey.overdue`, `survey.submitted`
- `case.due`, `case.overdue`
- `proposal.pending`, `proposal.conflict`
- `cycle.closing`, `cycle.closed`

event ID ต้องมาจาก source ID และ revision เพื่อไม่แจ้งซ้ำ และ deep link ต้องพาไปยัง `cycleId`, `caseId`
หรือ `assignmentId` ที่ถูกต้อง การตรวจ ownership/RBAC ต้องทำฝั่ง Backend

### รายงานและ Export

- Operations: งานค้าง ติดต่อไม่ได้ ใกล้ครบกำหนด และรอตรวจ
- Outcomes: ภาวะการทำงานและความครบถ้วนข้อมูล
- Survey aggregate: สรุปตาม privacy mode
- Data quality: orphan, conflict และรายการที่ต้องทบทวน
- Excel แยก Participants, Cases, FollowUps, Employment และ Survey Summary
- คำตอบรายบุคคลส่งออกได้เฉพาะ permission และ response mode ที่อนุญาต
- ลงทะเบียน `CycleID`, cohort revision, snapshot/cutoff, watermark, ภาษา และชุด fields ใน `ReportRegistry`

### Performance และ Legacy Retirement

- รวม API ที่อ่าน cycle/forms/campaigns ซ้ำเป็น workspace read model
- lazy-load analytics และรายการขนาดใหญ่
- cache ต้องแยกตาม session, role, person และ revision
- ใช้ dual-read parity อย่างน้อยหนึ่งรอบสมบูรณ์ก่อนเปิด `unified`
- เลิก `EMPLOYMENT_TRACKING_PERIODS` fallback และ legacy endpoints หลัง telemetry สะอาดแล้วเท่านั้น
- ไม่ลบ legacy sheets/data ใน release เดียวกับ cutover

### เกณฑ์ตรวจรับ R5

- notification เดียวกันไม่เกิดซ้ำจาก source revision เดิม
- deep link เปิด object ที่ถูกต้องและไม่ข้ามสิทธิ์
- closed-cycle report, export และ QR อ้าง snapshot เดียวกัน
- ไม่มีจำนวนคนคูณจากหลายงาน หลาย follow-up หรือหลายคำตอบ
- legacy และ unified counts ที่อธิบายไม่ได้ต้องเป็นศูนย์ก่อน cutover
- ซ้อม rollback บน staging สำเร็จ

## 10. Test Matrix ที่ต้องเพิ่ม

แยกชุดทดสอบใหม่ตามหน้าที่:

- `tests/tracking-integrity.test.cjs`
- `tests/tracking-cycles.test.cjs`
- `tests/survey-privacy.test.cjs`
- `tests/survey-bindings.test.cjs`
- `tests/rbac-matrix.test.cjs`
- `tests/migration.test.cjs`
- `tests/historical-reports.test.cjs`

| กลุ่ม | กรณีบังคับ |
|---|---|
| Integrity | orphan/duplicate, merge re-key, archive ที่มี dependency |
| Cohort | publish/retry/concurrency, participant ที่ไม่มี activity, explicit add/exempt |
| Ownership/RBAC | ทุก role × endpoint ทั้ง allow และ deny รวม IDOR ด้วย ID ของผู้อื่น |
| Survey | opened, draft policy, edit policy, expected revision, matrix analytics |
| Privacy | identified/confidential/anonymous ครอบคลุม API/export/cache/log |
| Binding | proposal idempotency, approve ซ้ำ, stale conflict, provenance |
| Historical | ปิดรอบแล้วแก้ current data แต่ snapshot/hash เดิมไม่เปลี่ยน |
| i18n/date | key parity, UTC ข้ามวัน, date-only ไม่เลื่อน, report language แยกจาก screen language |
| Browser | language switch ไม่ refetch, รักษา form/filter/modal, keyboard/focus/mobile/deep link |
| Export | จำนวนคนไม่ซ้ำ, แยก sheets, formula injection, permission/privacy |

ทุก release ต้องผ่านอย่างน้อย:

```sh
node --test tests/*.test.cjs
node --test tests/i18n.test.cjs
git diff --check
git diff --cached --check
```

หากแก้ DOM แบบ dynamic, ภาษา, วันที่, profile, survey, tracking หรือ report ต้องรัน browser suite ตาม
[tests/README.md](tests/README.md):

```sh
node tests/i18n.browser.cjs 9222
```

## 11. Migration และ Rollback Gate

ก่อนเปลี่ยน schema production ทุกครั้ง:

1. สำรอง Spreadsheet และบันทึก sheet/header/row counts
2. รัน preview แบบ read-only
3. ตรวจ duplicate, orphan, invalid reference และ conflicting key
4. รัน migration บนสำเนา production ใน staging
5. รัน migration ซ้ำทันทีและต้องได้ `created=0`, `changed=0`
6. ตรวจ counts/checksum และสุ่มตรวจข้อมูลรายบุคคล
7. ซ้อมปิด feature flag หรือกลับ reader เดิม
8. จึงดำเนินการ production

Rollback schema ให้ปิด feature/read path ใหม่ ห้ามลบคอลัมน์หรือชีตเพื่อย้อน migration ส่วนการ restore ข้อมูลจาก backup
ทำเฉพาะ incident ที่ได้รับอนุมัติและมีหลักฐานตรวจสอบแล้ว

## 12. ลำดับ Deploy ต่อหนึ่ง Release

### Staging

1. รัน automated tests และตรวจ diff
2. ตรวจบัญชี RDF ก่อนทุกคำสั่ง Apps Script:

   ```sh
   clasp -u rdf show-authorized-user
   clasp -u rdf status
   ```

3. push/version/redeploy Backend staging ด้วย `-u rdf`
4. ตรวจ health, permission, schema preview และ migration บน staging copy
5. ทดสอบ local frontend แบบ live กับ staging
6. ทดสอบเส้นทาง cycle → participant/case → survey → proposal → profile/report ตามขอบเขต release
7. ตรวจ logs ว่าไม่มี exception หรือข้อมูลลับ

### Production และ GitHub Pages

1. ยืนยัน authorized user ด้วย `clasp -u rdf show-authorized-user` อีกครั้ง
2. deploy Backend production รุ่นที่ผ่าน staging
3. ตรวจ production health และ backward compatibility กับ frontend รุ่นเดิม
4. เปิด feature ใหม่ในโหมดที่กำหนด โดย migration เริ่มจาก preview
5. commit และ push frontend หลัง Backend ผ่านแล้วเท่านั้น
6. รอ GitHub Pages deploy สำเร็จ
7. เปิด `https://somchaimontha.github.io/rdf/?v=<release-id>` และตรวจว่า asset/API version ตรงกับ commit
8. smoke test login, profile, tracking, survey, employment report และหน้าตรวจสอบรายงาน

หลักฐานต่อ release ต้องผูก Git commit, `RDF.VERSION`, Apps Script version, schema version, migration run ID,
report snapshot/cutoff และผลทดสอบเข้าด้วยกัน

## 13. Definition of Done ส่วนกลาง

งานหนึ่งรายการถือว่าเสร็จเมื่อ:

- schema/API/UI/documentation สอดคล้องกัน และไม่มีข้อความว่า “พร้อมใช้” ก่อน deploy จริง
- Backend ตรวจ permission, ownership, validation, revision และ idempotency
- UI มีข้อความทั้ง `T.th`/`T.en` และใช้ attribute translation ตาม `AGENTS.md`
- วันที่ผู้ใช้เห็นผ่าน `formatAppDate()`, `formatAppMonth()` หรือ `formatAppDateTime()`
- language switch ไม่โหลดข้อมูลซ้ำและรักษาค่าฟอร์ม ตัวกรอง pagination modal และ draft
- accessibility ใช้คีย์บอร์ดได้ มี label/error/focus trap/focus restore และไม่ใช้สีอย่างเดียว
- API สำหรับ Student ไม่ส่ง internal field แม้หน้าเว็บจะไม่ได้ render
- migration เป็น additive/idempotent และมี preview, audit, backup และ rollback path
- unit/integration/browser tests ที่เกี่ยวข้องผ่าน พร้อม `git diff --check`
- Backend staging และ production ผ่านก่อน frontend GitHub Pages

## 14. งานชุดแรกที่ควรเริ่ม

แบ่งเป็น commit/PR ขนาดเล็กตามลำดับนี้:

1. **R0-01 Integrity preview** — เพิ่มตัวตรวจ orphan/duplicate แบบ read-only และ unit tests
2. **R0-02 Identity guard** — ป้องกัน merge/delete ที่มี dependency พร้อม dependency preview
3. **R0-03 Follow-up privacy** — แยก public/internal DTO และเพิ่ม Student privacy tests
4. **R0-04 Report scope correction** — รักษา cycle/institution และไม่ตัดผู้ไม่มีกิจกรรม
5. **R0-05 Survey opened/revision guard** — บันทึก opened และเพิ่ม backend policy tests
6. **R1-01 Schema preview** — เพิ่ม preview สำหรับ Participants/Cases/MigrationLedger แบบ additive
7. **R1-02 Idempotent publish** — ตรึง participant/case/assignment ภายใต้ lock
8. **R1-03 Dual-read workspace** — เปรียบเทียบ legacy กับ unified ก่อนเปิดใช้งานจริง

หลัง R1-03 ผ่านจึงเริ่ม Profile 360 และ case workspace เพื่อให้ UI ใหม่ตั้งอยู่บนข้อมูลกลางที่เชื่อถือได้
