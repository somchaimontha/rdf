// Real Chrome DOM smoke test with isolated API and external-library fixtures.
// Start Chrome with --headless=new --remote-debugging-port=0 and set RDF_CHROME_PORT.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `
window.__calls = []; window.__errors = []; window.__RDF_LOCAL_FIXTURE__ = true;
addEventListener('error', e => __errors.push(e.message));
addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));
localStorage.setItem('rdfLang', new URLSearchParams(location.search).get('testLang') || 'th');
localStorage.removeItem('rdfRbacPermissions');
if (location.pathname.endsWith('/index.html')) localStorage.removeItem('rdfUser');
else localStorage.setItem('rdfUser', JSON.stringify({name:'Test Admin',username:'test',role:'SuperAdmin',sessionToken:'fixture',loginTime:Date.now()}));
window.tailwind = {};
window.lucide = {createIcons(){}};
window.google = {accounts:{id:{initialize(){},prompt(){}},oauth2:{initTokenClient(){return {requestAccessToken(){}};}}}};
window.Chart = class { static register(){}; constructor(el, cfg){this.data=cfg.data;this.options=cfg.options;} destroy(){} stop(){} update(){} toBase64Image(){return '';} };
window.Chart.defaults = {font:{},plugins:{legend:{labels:{}}}};
window.Swal = {fire:async(...args)=>({isConfirmed:false}),mixin(){return this;},showLoading(){},close(){}};
window.XLSX = {utils:{}};
window.QRCode = class { constructor(element){const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;element.appendChild(canvas);} };
window.QRCode.CorrectLevel = {M:0};
window.fetch = async (url, options) => {
 const requestBody = options?.body ? JSON.parse(options.body) : null;
 const requestUrl = new URL(url, location.href);
 const action = requestBody ? requestBody.action : requestUrl.searchParams.get('action');
 __calls.push(action);
 if (action==='getStudents' && location.pathname.endsWith('/dashboard.html')) await new Promise(resolve=>setTimeout(resolve,3000));
 const student = {stipNo:'MBS_001',fname:'ทดสอบ',lname:'นักเรียน',engFname:'Test',engLname:'Student',institution:'MBS',level:'มัธยมศึกษาปีที่ 4 (Grade 10)',status:'Active',scholarshipYear:2025,entryYear:2025,phone:'0800000000',idCard:'1234567890123'};
 let data = {status:'success',data:[],rows:[],students:[],pending:[],sessions:{},stats:{Total:1,MBS:1}};
 if (action==='ping') data.status='ok';
 if (action==='getDashboardStats') data.stats={MBS:28,VC:15,UNI:3,Alumni:128,Total:174};
 if (action==='getStudents') data.data=[student];
 if (action==='getStudentsForPromotion') data.groups=[{institution:'MBS',level:student.level,students:[{StipNo:'MBS_001',Title:'นาย',FirstName:'ทดสอบ',LastName:'นักเรียน',EngFirstName:'Test',EngLastName:'Student'}]}];
 if (action==='getSystemSettings') data.data={
   STUDENT_GRADES:[{stipNo:'MBS_001',acadYear:2568,semester:'1',gpa:3.5,updatedAt:'2026-01-15T12:00:00Z'}],
   NOTIFICATIONS:[
     {id:'N_ALL',type:'general',audienceKey:'all',titleTH:'ประกาศทั้งหมด',titleEN:'Everyone notice',bodyTH:'รายละเอียด',bodyEN:'Details',link:'dashboard.html',sentBy:'Admin',sentAt:'2026-09-10T08:00:00Z'},
     {id:'N_ADMIN',type:'general',audienceKey:'admin',titleTH:'ประกาศผู้ดูแล',titleEN:'Admin notice',bodyTH:'รายละเอียด',bodyEN:'Details',link:'settings.html',sentBy:'Admin',sentAt:'2026-09-10T09:00:00Z'},
     {id:'N_MBS',type:'exam',audienceKey:'MBS',titleTH:'ประกาศ MBS',titleEN:'MBS notice',bodyTH:'รายละเอียด',bodyEN:'Details',link:'academic-terms.html',sentBy:'Admin',sentAt:'2026-09-10T10:00:00Z'},
     {id:'N_UNI',type:'exam',audienceKey:'UNI',titleTH:'ประกาศ UNI',titleEN:'UNI notice',bodyTH:'รายละเอียด',bodyEN:'Details',link:'academic-terms.html',sentBy:'Admin',sentAt:'2026-09-10T11:00:00Z'}
   ],
   SIGNATURE_BLOCK:[
     {role:'Data Recorder',name:'Stored Account Name',position:'Administrator',signatureDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg=='},
     {role:'Data Reviewer',name:'Review Officer',position:'Reviewer',signatureDataUrl:''}
   ]
 };
 if (action==='getNotificationFeed') data={status:'success',schemaVersion:'1.0.0',data:[{eventId:'employment.followup_due_soon.fixture',moduleId:'employment',eventType:'followup_due_soon',count:1,sampleTH:'นายทดสอบ นักเรียน',sampleEN:'Mr Test Student',dateFrom:'2026-03-20',dateTo:'2026-03-27',href:'reports.html?view=employment&source=notification&followUp=due_soon'}]};
 if (action==='getStudent') data.data={StipNo:'MBS_001',FirstName:'ทดสอบ',LastName:'นักเรียน',EngFirstName:'Test',EngLastName:'Student',Institution:'MBS',CurrentLevel:student.level,Status:'Active',ScholarshipYear:2025};
 if (action==='getAdmins') data.data=[{Username:'test',FirstName:'Test',LastName:'Admin',Role:'SuperAdmin',Status:'Active',LoginCount:1}];
 if (action==='generateStipNo') data.stipNo='MBS_002';
 if (action==='getDynamicFormSchema') data={status:'success',setupRequired:false,schemaVersion:'1.1.0',sections:[{sectionId:'sec_profile',sectionKey:'extra_profile',nameTH:'ข้อมูลเพิ่มเติม',nameEN:'Additional Information',descriptionTH:'ข้อมูลที่กำหนดจากระบบ',descriptionEN:'System-configured information',displayOrder:1,visibilityRules:{logic:'AND',conditions:[]},cardinality:'single',active:true},{sectionId:'sec_work',sectionKey:'employment_history',nameTH:'ประวัติการทำงาน',nameEN:'Employment History',descriptionTH:'',descriptionEN:'',displayOrder:2,visibilityRules:{logic:'AND',conditions:[]},cardinality:'repeatable',active:true}],fields:[{fieldId:'fld_note',fieldKey:'extra_note',labelTH:'ข้อความเพิ่มเติม',labelEN:'Additional note',fieldType:'text',sectionId:'sec_profile',displayOrder:1,required:false,visible:true,editable:true,canEdit:true,visibleRoles:['SuperAdmin'],editableRoles:['SuperAdmin'],visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_start',fieldKey:'start_month',labelTH:'เดือนเริ่มต้น',labelEN:'Start month',fieldType:'month',sectionId:'sec_work',displayOrder:1,required:false,visible:true,editable:true,canEdit:true,visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_end',fieldKey:'end_month',labelTH:'เดือนสิ้นสุด',labelEN:'End month',fieldType:'month',sectionId:'sec_work',displayOrder:2,required:false,visible:true,editable:true,canEdit:true,visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_duration',fieldKey:'employment_duration',labelTH:'ระยะเวลาทำงาน',labelEN:'Employment duration',fieldType:'calculated_duration',sectionId:'sec_work',displayOrder:3,required:false,visible:true,editable:false,canEdit:false,calculationType:'month_range_duration',calculationConfig:{startFieldId:'fld_start',endFieldId:'fld_end',useCurrentMonth:true},visibilityRules:{logic:'AND',conditions:[]}}],options:[],values:location.pathname.endsWith('/student-profile.html')?[{valueId:'val_1',fieldId:'fld_note',recordId:'single',value:'Fixture value'},{valueId:'val_2',fieldId:'fld_start',recordId:'rec_work_1',value:'2025-01'},{valueId:'val_3',fieldId:'fld_end',recordId:'rec_work_1',value:'2025-12'}]:[]};
 if (action==='getDynamicFieldAdminData') data={status:'success',setupRequired:false,schemaVersion:'1.1.0',setup:{status:'success',ready:true,schemaVersion:'1.1.0',sheets:[{name:'FormSections',exists:true,missingHeaders:[],rowCount:1}]},sections:[{sectionId:'sec_profile',sectionKey:'extra_profile',nameTH:'ข้อมูลเพิ่มเติม',nameEN:'Additional Information',descriptionTH:'',descriptionEN:'',displayOrder:1,visibilityRules:{logic:'AND',conditions:[]},visibleRoles:['SuperAdmin'],cardinality:'single',collapsible:true,active:true}],fields:[{fieldId:'fld_note',fieldKey:'extra_note',labelTH:'ข้อความเพิ่มเติม',labelEN:'Additional note',fieldType:'text',sectionId:'sec_profile',displayOrder:1,required:false,visible:true,editable:true,active:true,archived:false,valueCount:1,visibleRoles:['SuperAdmin'],editableRoles:['SuperAdmin'],visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_start',fieldKey:'start_month',labelTH:'เดือนเริ่มต้น',labelEN:'Start month',fieldType:'month',sectionId:'sec_profile',displayOrder:2,active:true,archived:false,valueCount:0,visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_end',fieldKey:'end_month',labelTH:'เดือนสิ้นสุด',labelEN:'End month',fieldType:'month',sectionId:'sec_profile',displayOrder:3,active:true,archived:false,valueCount:0,visibilityRules:{logic:'AND',conditions:[]}},{fieldId:'fld_duration',fieldKey:'employment_duration',labelTH:'ระยะเวลาทำงาน',labelEN:'Employment duration',fieldType:'calculated_duration',sectionId:'sec_profile',displayOrder:4,editable:false,active:true,archived:false,valueCount:0,calculationType:'month_range_duration',calculationConfig:{startFieldId:'fld_start',endFieldId:'fld_end',useCurrentMonth:true},visibilityRules:{logic:'AND',conditions:[]}}],options:[]};
 if (action==='previewDynamicFieldSetup') data={status:'success',ready:true,schemaVersion:'1.1.0',sheets:[]};
 if (action==='previewEmploymentHistorySetup') data={status:'success',launchMode:'enabled',ready:true,safeToInstall:false,setupRequired:false,schemaVersion:'1.1.0',missingSections:[],missingFields:[],conflicts:[],candidateSections:[],legacy:{rowsWithEmployment:1,rowsMissingStipNo:0}};
 if (action==='previewLegacyEmploymentMigration') data={status:'success',launchMode:'enabled',schemaReady:true,total:1,ready:1,migrated:0,possibleDuplicate:0,missingStudent:0,rows:[{sourceRow:2,sourceKey:'Alumni:v1:fixture',stipNo:'MBS_001',nameTH:'นายทดสอบ นักเรียน',nameEN:'Mr Test Student',occupation:'Coordinator',workplace:'RDF Foundation',status:'ready',existingRecordId:''}]};
 if (action==='getEmploymentReport') data={status:'success',launchMode:'enabled',setupRequired:false,schemaVersion:'1.1.0',asOfMonth:'2026-03',reportDate:'2026-03-20',canManageFollowUps:true,legacyRowsPendingMigration:0,summary:{eligiblePeople:1,reportedPeople:1,employmentRecords:1,followUpRecords:1,dueFollowUps:1,overdueFollowUps:0,byStatus:{employed_full_time:1}},data:[{stipNo:'MBS_001',nameTH:'นายทดสอบ นักเรียน',nameEN:'Mr Test Student',institution:'MBS',studentStatus:'University',currentAcademicYear:'2569',scholarshipApprovalStatus:'Rejected',universityScholarship:'No',universityName:'มหาวิทยาลัยเชียงใหม่',universityNameEN:'Chiang Mai University',continuingEducationWithoutRdf:true,employmentStatus:'employed_full_time',histories:[{recordId:'rec_work_1',employerName:'RDF Foundation',workplaceLocation:'Mae Sariang',workplaceProvince:'Mae Hong Son',jobTitle:'Coordinator',employmentType:'full_time',industry:'Education',startMonth:'2025-01',endMonth:'',durationMonths:15,current:true,verificationStatus:'verified',source:'self_reported',updatedAt:'2026-03-18T08:00:00Z'}],followUps:[{followUpId:'fup_fixture',employmentRecordId:'rec_work_1',contactDate:'2026-03-10',contactMethod:'phone',outcome:'follow_up_needed',nextFollowUpDate:'2026-03-20',assignedTo:'Test Admin',notes:'Fixture follow-up',updatedAt:'2026-03-20T09:00:00Z'}]}]};
 const reportDefs={employment_status:['a','b','1','RDF-EMP-20260320-11111111','รายงานภาวะการทำงานของศิษย์เก่า','Alumni Employment Status Report'],scholarship_statistics:['d','e','2','RDF-SCH-20260320-22222222','รายงานสถิติทุนการศึกษา','Scholarship Statistics Report'],promotion_results:['f','g','3','RDF-PRO-20260320-33333333','รายงานเลื่อนชั้นและผู้สำเร็จการศึกษา','Promotion and Graduation Report'],academic_results:['h','i','4','RDF-ACA-20260320-44444444','รายงานผลการศึกษา','Academic Results Report']};
 const reportDef=(type)=>reportDefs[type]||reportDefs.employment_status;
 const reportTypeByToken=(token)=>Object.keys(reportDefs).find(type=>reportDefs[type][0]===token[0]||reportDefs[type][1]===token[0])||'employment_status';
 if (action==='issueReportReference') {
   const type=requestBody?.report?.reportType||'employment_status';
   const d=reportDef(type);
   data={status:'success',reused:false,verificationToken:d[0].repeat(64),report:{reportId:'rpt_'+d[2].repeat(32),referenceNo:d[3],reportType:type,subjectTH:d[4],subjectEN:d[5],createdAt:'2026-03-20T10:00:00Z',qrVersion:1,active:true}};
 }
 if (action==='regenerateReportQr') {
   const type=Object.keys(reportDefs).find(key=>requestBody?.reportId==='rpt_'+reportDefs[key][2].repeat(32))||'employment_status';
   const d=reportDef(type);
   data={status:'success',verificationToken:d[1].repeat(64),report:{reportId:'rpt_'+d[2].repeat(32),referenceNo:d[3],reportType:type,subjectTH:d[4],subjectEN:d[5],createdAt:'2026-03-20T10:00:00Z',qrVersion:2,active:true}};
 }
 if (action==='getReportVerification') {
   const type=reportTypeByToken(requestUrl.searchParams.get('verificationToken')||'');const d=reportDef(type);
   data={status:'success',authenticationRequired:true,report:{referenceNo:d[3],reportType:type,subjectTH:d[4],subjectEN:d[5],active:true}};
 }
 if (action==='getReportVerificationDetails') {
   const token=requestUrl.searchParams.get('verificationToken')||'',type=reportTypeByToken(token),d=reportDef(type);
   data={status:'success',report:{reportId:'rpt_'+d[2].repeat(32),referenceNo:d[3],reportType:type,subjectTH:d[4],subjectEN:d[5],createdAt:'2026-03-20T10:00:00Z',qrVersion:token[0]===d[1]?2:1,active:true,rowCount:1,createdBy:'test',lastExportedAt:'2026-03-20T10:00:00Z',exportCount:1,contentHash:'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'}};
 }
 return {ok:true,json:async()=>data};
};
`;
const server = http.createServer((req,res)=>{
 const file = path.join(root, new URL(req.url,'http://localhost').pathname);
 if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
 try {
  let content = fs.readFileSync(file);
  if (file.endsWith('.html')) {
   content = content.toString().replace(/<script\b[^>]*src=["']https?:[^>]*><\/script>/gi,'')
     .replace(/<link\b[^>]*href=["']https?:[^>]*>/gi,'')
     .replace(/<script src="assets\/js\/tamper-guard.js"><\/script>/g,'')
     .replace('<head>','<head><script>'+fixture+'</script>');
  }
  res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/css');res.end(content);
 } catch {res.writeHead(404).end();}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const port=process.env.RDF_CHROME_PORT || process.argv[2];
 assert.ok(port,'Set RDF_CHROME_PORT to the Chrome debugging port');
 const target=await (await fetch('http://127.0.0.1:'+port+'/json/new?about:blank',{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);let id=0;const pending=new Map();
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
 await new Promise(resolve=>ws.onopen=resolve);
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;};
 try {
  await send('Network.enable');
  await send('Network.setBlockedURLs',{urls:['https://*']});
  for (const initialLang of ['th','en']) for (const file of ['index.html','dashboard.html','students.html','student-form.html','student-profile.html','reports.html','academic-results.html','academic-terms.html','promotion.html','settings.html','custom-fields.html','report-verification.html']) {
   const pageUrl=base+'/'+file+'?testLang='+initialLang+(file==='student-profile.html'?'&stipNo=MBS_001':'')+(file==='report-verification.html'?'&token='+'a'.repeat(64):'');
   await send('Page.navigate',{url:pageUrl});
   const deadline=Date.now()+10000;
   while (true) {
     let ready=false;
     try { ready=await evaluate(`location.href===${JSON.stringify(pageUrl)} && document.readyState==='complete' && typeof setLang==='function'`); } catch (_) { /* Navigation replaces the execution context. */ }
     if (ready) break;
     assert.ok(Date.now()<deadline,file+' did not finish loading');
     await delay(50);
   }
   await delay(50);
   const startup=await evaluate('({lang:document.documentElement.lang, saved:localStorage.getItem("rdfLang"), url:location.href, errors:window.__errors, ready:document.readyState})');
   assert.equal(startup.lang,initialLang,file+' saved language '+JSON.stringify(startup));
   const quickCounts = file === 'dashboard.html'
     ? await evaluate(`['statMBS','statVC','statUNI','statAlumni'].map(id=>document.getElementById(id).textContent)`)
     : null;
   if (file !== 'index.html' && file !== 'report-verification.html') {
     const notificationDom=await evaluate(`({panels:document.querySelectorAll('#notifPanel').length,badges:document.querySelectorAll('#notifBadge').length,bells:document.querySelectorAll('#notifBellBtn').length,legacy:document.querySelectorAll('#notifBell').length})`);
     assert.deepEqual(notificationDom,{panels:1,badges:1,bells:1,legacy:0},file+' must use one shared notification center');
     await evaluate(`_refreshNotifBell()`);
   }
   if(file==='settings.html') {
     await evaluate('Promise.all([loadOverview(), loadActiveSessions(), loadStudentEditableFields(), loadRbacPermissions()])');
     await evaluate(`document.querySelector('#studentFieldsGrid input').click(); openAdminModal(); document.getElementById('m_fname').value='Unsaved Admin';`);
   }
   if(file==='custom-fields.html') {
     await evaluate(`openFieldEditor(adminData.fields[0]);document.getElementById('fld_label_th').value='ค่าที่ยังไม่บันทึก';document.querySelector('#fld_visible_roles input').click();`);
   }
   if(file==='reports.html') await evaluate('openRptPrintModal()');
   if(file==='academic-results.html') await evaluate('openPrintModal()');
   const before=await evaluate(`(async()=>{
     if (location.pathname.endsWith('student-form.html')) {document.getElementById('f_institution').value='MBS';onInstitutionChange();document.getElementById('f_level').selectedIndex=2;}
     await new Promise(resolve => setTimeout(resolve, 50));
     const el=document.querySelector('input[type="text"]:not([readonly]):not([disabled])');if(el) el.value='Unsaved ไทย English';
     window.__beforeInputs=[...document.querySelectorAll('input[id],select[id],textarea[id]')].map(e=>[e.id,e.value,e.checked]);
     return {calls:__calls.length,errors:__errors.slice()};
   })()`);
   const result=await evaluate(`(async()=>{
     document.getElementById('langBtn').click();
     await new Promise(resolve => setTimeout(resolve, 0));
     const en=document.documentElement.lang;
     const missing=[...document.querySelectorAll('[data-t]')].filter(e=>!e.getAttribute('data-t-attr') && e.textContent!==t(e.getAttribute('data-t'))).map(e=>e.getAttribute('data-t'));
     const enInputs=[...document.querySelectorAll('input[id],select[id],textarea[id]')].map(e=>[e.id,e.value,e.checked]);
     document.getElementById('langBtn').click();
     await new Promise(resolve => setTimeout(resolve, 0));
     return {en,th:document.documentElement.lang,calls:__calls.length,errors:__errors,missing,enInputs,beforeInputs:__beforeInputs};
   })()`);
   assert.equal(result.en,initialLang==='th'?'en':'th',file);assert.equal(result.th,initialLang,file);
   assert.deepEqual(result.errors,[],file+' runtime errors');
   assert.equal(result.calls,before.calls,file+' must not refetch on switch');
   assert.deepEqual(result.enInputs,result.beforeInputs,file+' form values must remain unchanged');
   assert.deepEqual(result.missing,[],file+' stale translations');
   if(file==='settings.html') {
     const signaturePad=await evaluate(`(async()=>{await loadGeneralSettings();sigBlockState=[{role:'Data Recorder',name:'Stored Account Name',position:'Administrator',signatureDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL9WQAAAABJRU5ErkJggg=='},{role:'Data Reviewer',name:'Review Officer',position:'Reviewer',signatureDataUrl:''}];renderSigEditor();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const canvas=document.getElementById('sigCanvas_0');canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};const initial=reportSignatureDataUrl(sigBlockState[0]).startsWith('data:image/png;base64,');clearSignaturePad(0);const cleared=!sigBlockState[0].signatureDataUrl;canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:5,clientY:10,pointerId:1,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:50,clientY:30,pointerId:1,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{clientX:50,clientY:30,pointerId:1,bubbles:true}));const redrawn=reportSignatureDataUrl(sigBlockState[0]).startsWith('data:image/png;base64,');clearSignaturePad(0,true);return {pads:document.querySelectorAll('.signature-pad-canvas').length,initial,cleared,redrawn,retryFocused:document.activeElement===canvas,clearLabel:[...document.querySelectorAll('.signature-pad-actions button')].some(button=>button.textContent.trim()===t('stSigClear')),retryLabel:[...document.querySelectorAll('.signature-pad-actions button')].some(button=>button.textContent.trim()===t('stSigRetry'))};})()`);
     assert.equal(signaturePad.pads,2,'shared signature settings must render one drawing pad per signatory');
     assert.equal(signaturePad.initial,true,'saved PNG signatures must load from the shared setting');
     assert.equal(signaturePad.cleared,true,'clear must remove the current signature without deleting the signatory');
     assert.equal(signaturePad.redrawn,true,'mouse, touch, or stylus drawing must capture a fresh PNG signature');
     assert.equal(signaturePad.retryFocused,true,'try again must clear and return focus to the drawing surface');
     assert.equal(signaturePad.clearLabel,true,'signature clear action must be localized');
     assert.equal(signaturePad.retryLabel,true,'signature retry action must be localized');
     await send('Emulation.setDeviceMetricsOverride',{width:360,height:520,deviceScaleFactor:1,mobile:true});
     const adminModal=await evaluate(`(()=>{const box=document.querySelector('#adminModal .modal-box'),body=document.querySelector('#adminModal .modal-body'),footer=document.querySelector('#adminModal .modal-footer'),boxRect=box.getBoundingClientRect(),footerRect=footer.getBoundingClientRect(),buttons=[...footer.querySelectorAll('button')].map(button=>button.getBoundingClientRect());return {open:!document.getElementById('adminModal').classList.contains('hidden'),boxTop:boxRect.top,boxBottom:boxRect.bottom,footerBottom:footerRect.bottom,viewport:innerHeight,viewportWidth:innerWidth,overflow:getComputedStyle(body).overflowY,scrollable:body.scrollHeight>body.clientHeight,horizontalOverflow:body.scrollWidth>body.clientWidth+1,buttonsVisible:buttons.every(rect=>rect.left>=0&&rect.right<=innerWidth+1&&rect.top>=0&&rect.bottom<=innerHeight+1)};})()`);
     assert.equal(adminModal.open,true,'admin modal remains open for responsive validation');
     assert.equal(adminModal.viewportWidth,360,'responsive admin test must use the mobile viewport');
     assert.ok(adminModal.boxTop>=0&&adminModal.boxBottom<=adminModal.viewport+1,'admin modal must fit inside a small viewport');
     assert.ok(adminModal.footerBottom<=adminModal.viewport+1,'admin modal actions must stay visible');
     assert.equal(adminModal.overflow,'auto','admin modal body must own vertical scrolling');
     assert.equal(adminModal.scrollable,true,'long admin form must scroll inside the modal');
     assert.equal(adminModal.horizontalOverflow,false,'admin modal must not require horizontal scrolling');
     assert.equal(adminModal.buttonsVisible,true,'admin modal cancel and save actions must remain visible');
     await send('Emulation.clearDeviceMetricsOverride');
     await evaluate('closeAdminModal()');
   }
   if(file==='dashboard.html') {
     const customFieldsShortcut=await evaluate(`!![...document.querySelectorAll('.menu-card')].find(card=>card.getAttribute('onclick')?.includes('custom-fields.html'))`);
     assert.equal(customFieldsShortcut,false,'advanced custom-field builder must live under settings instead of the dashboard');
     const startupCalls=await evaluate(`({quick:__calls.filter(a=>a==='getDashboardStats').length,students:__calls.filter(a=>a==='getStudents').length,pending:__calls.filter(a=>a==='getPendingScholarshipRequests').length,counts:['statMBS','statVC','statUNI','statAlumni'].map(id=>document.getElementById(id).textContent)})`);
     assert.equal(startupCalls.quick,1,'dashboard must request quick stats once');
     assert.equal(startupCalls.students,1,'dashboard must share the student request');
     assert.equal(startupCalls.pending,1,'dashboard must share the pending-request call');
     assert.deepEqual(quickCounts,['28','15','3','128'],'quick stats must render before full student data');
     if (initialLang === 'en') {
       const notifications=await evaluate(`(()=>{
         const original=getUser();
         const pending=[{StipNo:'MBS_010',FirstName:'อนุมัติ',LastName:'ทุน',EngFirstName:'Approval',EngLastName:'Student',UniName:'มหาวิทยาลัยทดสอบ',UniNameEN:'Test University',SchApprovalStatus:'Pending'}];
         const students=[
           {stipNo:'MBS_011',fname:'พัก',lname:'เรียน',engFname:'Suspended',engLname:'Student',institution:'MBS',level:'มัธยมศึกษาปีที่ 5 (Grade 11)',status:'Suspended'},
           {stipNo:'MBS_012',fname:'ข้อมูล',lname:'ไม่ครบ',engFname:'Incomplete',engLname:'Student',institution:'MBS',level:'มัธยมศึกษาปีที่ 4 (Grade 10)',status:'Active'},
           {stipNo:'MBS_013',fname:'เรียนต่อ',lname:'มหาวิทยาลัย',engFname:'University',engLname:'Candidate',institution:'MBS',level:'มัธยมศึกษาปีที่ 6 (Grade 12)',status:'Graduated',uniName:'มหาวิทยาลัยทดสอบ',uniScholarship:'Yes'}
         ];
         const staffKinds=role=>{
           setUser({...original,role});_notifCurrentUser=getUser();
           return _buildStaffNotifications(getUser(),pending,students).map(item=>item.id.split(':')[0]).sort();
         };
         const superAdmin=staffKinds('SuperAdmin');
         setUser({...original,role:'Manager'});const managerCanManage=RBAC.has('manageNotifications');
         const finance=staffKinds('Finance');
         const financeCanManage=RBAC.has('manageNotifications');
         const dormTeacher=staffKinds('DormTeacher');
         setUser({...original,role:'Student',stipNo:'MBS_001'});_notifCurrentUser=getUser();
         const own=_buildStudentNotifications(getUser(),{StipNo:'MBS_001',FirstName:'ทดสอบ',Status:'Active'}).map(item=>item.id.split(':')[0]);
         const broadcasts=[
           {id:'all',audienceKey:'all',titleEN:'All',link:'dashboard.html'},
           {id:'admin',audienceKey:'admin',titleEN:'Admin',link:'settings.html'},
           {id:'mbs',audienceKey:'MBS',titleEN:'MBS',link:'academic-terms.html'},
           {id:'uni',audienceKey:'UNI',titleEN:'UNI',link:'academic-terms.html'}
         ];
         const studentBroadcasts=_buildBroadcastNotifications(getUser(),broadcasts,{Institution:'MBS'}).map(item=>({id:item.id,href:item.href}));
         const operational=_buildOperationalNotifications([{eventId:'employment.followup_overdue.test',eventType:'followup_overdue',count:2,sampleTH:'ตัวอย่าง',sampleEN:'Example',dateFrom:'2026-03-18',dateTo:'2026-03-20'}]).map(item=>({id:item.id,href:item.href,title:item.title}));
         setUser(original);_notifCurrentUser=original;
         localStorage.removeItem(_notifReadKey());
         _notifSource={user:original,isStudent:false,pending,students,ownStudent:null};_notifLoaded=true;_notifLoadFailed=false;_rebuildNotifItems();_renderNotifPanel();
         document.getElementById('notifBellBtn').click();
         const open=document.getElementById('notifPanel').classList.contains('open');
         const details=[...document.querySelectorAll('.notif-item')].every(el=>el.querySelector('.notif-title')&&el.querySelector('.notif-desc')&&el.getAttribute('href'));
         const beforeUnread=document.querySelectorAll('.notif-item.unread').length;
         document.getElementById('notifMarkAllBtn').click();
         const afterUnread=document.querySelectorAll('.notif-item.unread').length;
         return {superAdmin,managerCanManage,finance,financeCanManage,dormTeacher,own,studentBroadcasts,operational,open,details,beforeUnread,afterUnread};
       })()`);
       assert.deepEqual(notifications.superAdmin,['approval','incomplete','suspended','university'],'SuperAdmin notification permissions');
       assert.equal(notifications.managerCanManage,true,'Manager can manage system notifications by default');
       assert.deepEqual(notifications.finance,['suspended'],'Finance notification permissions');
       assert.equal(notifications.financeCanManage,false,'Finance cannot manage system notifications by default');
       assert.deepEqual(notifications.dormTeacher,['incomplete','suspended'],'DormTeacher notification permissions');
       assert.deepEqual(notifications.own,['own-profile'],'Student must only receive their own profile notification');
       assert.deepEqual(notifications.studentBroadcasts,[{id:'broadcast:all',href:'dashboard.html'},{id:'broadcast:mbs',href:'dashboard.html'}],'Student broadcasts must match their institution and safe destinations');
       assert.deepEqual(notifications.operational.map(item=>({id:item.id,href:item.href})),[{id:'operational:employment.followup_overdue.test',href:'reports.html?view=employment&source=notification&followUp=overdue'}],'operational alerts must use the shared bell and safe report routes');
       assert.match(notifications.operational[0].title,/2/,'operational alert title must include the aggregate count');
       assert.equal(notifications.open,true,'bell must open the notification list');
       assert.equal(notifications.details,true,'each notification must show details and a destination');
       assert.ok(notifications.beforeUnread>0,'new notifications must be unread');
       assert.equal(notifications.afterUnread,0,'mark all read must clear unread state');
     }
   }
   if(file==='index.html') {
     const googleLogin=await evaluate(`({configured:typeof _gClientId==='string'&&_gClientId===RDF.GOOGLE_CLIENT_ID&&_gClientId.length>0,button:getComputedStyle(document.getElementById('googleBtnWrap')).display,warning:getComputedStyle(document.getElementById('googleNotCfg')).display})`);
     assert.equal(googleLogin.configured,true,'Google Client ID bootstrap');
     assert.notEqual(googleLogin.button,'none','Google login remains available while settings load');
     assert.equal(googleLogin.warning,'none','configured Google login must not show missing-ID warning');
     const loginReturn=await evaluate(`(()=>{const original=location.href;history.replaceState({},'',
       'index.html?next='+encodeURIComponent('report-verification.html?token='+'a'.repeat(64)));const valid=authLoginDestination();history.replaceState({},'','index.html?next='+encodeURIComponent('https://attacker.example/'));const blocked=authLoginDestination();history.replaceState({},'',original);return {valid,blocked};})()`);
     assert.match(loginReturn.valid,/^report-verification\.html\?token=/,'login may return to the same-origin verification page');
     assert.equal(loginReturn.blocked,'dashboard.html','login return must reject external redirects');
     const dynamic=await evaluate(`(async()=>{
       const holder=document.createElement('div');
       holder.innerHTML='<button><i id="test-icon"></i><span data-t="save">initial</span></button><input value="Keep ไทย" data-t-placeholder="searchPlaceholder" data-t-title="save">';
       document.body.appendChild(holder);
       await new Promise(resolve=>setTimeout(resolve,0));
       const ok=holder.querySelector('span').textContent===t('save') && holder.querySelector('input').placeholder===t('searchPlaceholder') && holder.querySelector('input').title===t('save') && holder.querySelector('input').value==='Keep ไทย' && !!holder.querySelector('#test-icon');
       holder.remove();return ok;
     })()`);
     assert.equal(dynamic,true,'async labels, attributes, and icons');
   }
   if(file==='reports.html') {
     await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
     const primaryView=await evaluate(`(()=>{const tabs=[...document.querySelectorAll('.report-view-tab')];return {view:document.getElementById('reportsWorkspace').dataset.reportView,employment:getComputedStyle(document.getElementById('employmentReportSection')).display,scholarship:getComputedStyle(document.getElementById('scholarshipReports')).display,print:getComputedStyle(document.querySelector('[data-report-action="scholarship"]')).display,widths:tabs.map(tab=>tab.getBoundingClientRect().width),heights:tabs.map(tab=>tab.getBoundingClientRect().height),labels:tabs.map(tab=>tab.textContent),source:document.getElementById('scholarshipDataSummary').textContent};})()`);
     assert.equal(primaryView.view,'scholarship','scholarship statistics must be the default primary view');
     assert.equal(primaryView.employment,'none','secondary employment report must not obscure scholarship statistics');
     assert.notEqual(primaryView.scholarship,'none','scholarship statistics must be visible first');
     assert.notEqual(primaryView.print,'none','scholarship report action must be available in the primary workflow');
     assert.ok(Math.abs(primaryView.widths[0]-primaryView.widths[1])<=1,'report menu buttons must have equal width');
     assert.ok(Math.abs(primaryView.heights[0]-primaryView.heights[1])<=1,'report menu buttons must have equal height');
     assert.match(primaryView.labels[0],/สถิติทุนการศึกษา|Scholarship statistics/,'scholarship statistics must be the first report menu');
     assert.equal(primaryView.labels.some(label=>/งานหลัก|Primary task/.test(label)),false,'employment tab must not be labelled as the primary task');
     assert.match(primaryView.source,/1/,'scholarship statistics must show their live student-record count');
     const secondaryView=await evaluate(`(()=>{switchReportView('employment');return {view:document.getElementById('reportsWorkspace').dataset.reportView,employment:getComputedStyle(document.getElementById('employmentReportSection')).display,scholarship:getComputedStyle(document.getElementById('scholarshipReports')).display,print:getComputedStyle(document.querySelector('[data-report-action="scholarship"]')).display,selected:document.getElementById('reportTabEmployment').getAttribute('aria-selected')};})()`);
     assert.equal(secondaryView.view,'employment','employment report must remain available as a secondary view');
     assert.notEqual(secondaryView.employment,'none','employment report must show on demand');
     assert.equal(secondaryView.scholarship,'none','views must not overlap');
     assert.equal(secondaryView.print,'none','scholarship-only action must stay out of the employment workflow');
     assert.equal(secondaryView.selected,'true','selected report tab must be exposed accessibly');
     const alumniEntry=await evaluate(`(()=>{history.replaceState({},'',${JSON.stringify('reports.html?view=employment&source=alumni')});const view=applyReportEntryContext();switchReportView(view);return {view:document.getElementById('reportsWorkspace').dataset.reportView,employment:getComputedStyle(document.getElementById('employmentReportSection')).display,backHref:document.getElementById('reportsBackLink').getAttribute('href'),backText:document.getElementById('reportsBackLinkText').textContent.trim(),expectedBack:t('backToAlumniList')};})()`);
     assert.equal(alumniEntry.view,'employment','alumni source link must open the employment report directly');
     assert.notEqual(alumniEntry.employment,'none','deep-linked employment report must be visible');
     assert.equal(alumniEntry.backHref,'students.html?status=Alumni','employment report must link back to the alumni list');
     assert.equal(alumniEntry.backText,alumniEntry.expectedBack,'alumni return link must be localized');
     await evaluate(`history.replaceState({},'',${JSON.stringify('reports.html?testLang='+initialLang)});switchReportView(applyReportEntryContext())`);
     const scholarshipComposer=await evaluate(`(()=>{openRptPrintModal();const scroll=document.querySelector('#rptPrintModal .flex-1.min-h-0');return {open:!document.getElementById('rptPrintModal').classList.contains('hidden'),formats:document.querySelectorAll('input[name="rptPrFormat"]').length,format:scholarshipReportFormat(),orientation:scholarshipReportOrientation(),signatures:document.querySelectorAll('input[name="rptPrSig"]').length,exportVisible:getComputedStyle(document.getElementById('rptPrExportBtn')).display,scrollOverflow:getComputedStyle(scroll).overflowY,scrollable:scroll.scrollHeight>scroll.clientHeight};})()`);
     assert.equal(scholarshipComposer.open,true,'scholarship formal report composer must open');
     assert.equal(scholarshipComposer.formats,2,'scholarship reports must support Excel and PDF');
     assert.equal(scholarshipComposer.format,'pdf','scholarship PDF must be the initial export choice');
     assert.equal(scholarshipComposer.orientation,'landscape','scholarship formal reports default to A4 landscape');
     assert.equal(scholarshipComposer.signatures,2,'scholarship reports must reuse the shared signatory settings');
     assert.notEqual(scholarshipComposer.exportVisible,'none','authorized users can export scholarship reports');
     assert.equal(scholarshipComposer.scrollOverflow,'auto','long scholarship report settings must scroll inside the modal');
     assert.equal(scholarshipComposer.scrollable,true,'scholarship report controls must be scrollable without browser zoom');
     const scholarshipRegistry=await evaluate(`(async()=>{const first=await scholarshipReportRegistrationPayload();document.querySelector('input[name="rptPrOrientation"][value="portrait"]').checked=true;document.querySelector('input[name="rptPrFormat"][value="xlsx"]').checked=true;const second=await scholarshipReportRegistrationPayload(),issued=await issueScholarshipReportReference(),opts=collectScholarshipReportOptions(false);opts.chartImgs=Object.fromEntries(opts.selectedCharts.map(key=>[key,'data:image/png;base64,AA==']));const html=generateRptPrintHTML(opts,issued,'data:image/png;base64,AA==');return {sameFingerprint:first.fingerprint===second.fingerprint,reference:issued.report.referenceNo,type:issued.report.reportType,url:issued.verificationUrl,qrVisible:getComputedStyle(document.getElementById('rptPrRegenerateBtn')).display,pageSetup:html.includes('@page{size:A4 portrait'),fixedTable:html.includes('table-layout:fixed'),qrHeader:html.includes('class="rpt-qr"'),footerUser:html.includes('Test Admin'),footerReference:html.includes('RDF-SCH-20260320-22222222')};})()`);
     assert.equal(scholarshipRegistry.sameFingerprint,true,'file type and page orientation must reuse the same scholarship QR');
     assert.equal(scholarshipRegistry.reference,'RDF-SCH-20260320-22222222','scholarship export must receive a central report reference');
     assert.equal(scholarshipRegistry.type,'scholarship_statistics','scholarship export must use its own report type');
     assert.match(scholarshipRegistry.url,/report-verification\.html\?token=/,'scholarship QR must target the protected verification page');
     assert.notEqual(scholarshipRegistry.qrVisible,'none','scholarship reports support conditional QR regeneration');
     assert.equal(scholarshipRegistry.pageSetup,true,'scholarship PDF must apply the selected A4 orientation');
     assert.equal(scholarshipRegistry.fixedTable,true,'scholarship tables must stay within page margins');
     assert.equal(scholarshipRegistry.qrHeader,true,'scholarship PDF must place a QR in the left header');
     assert.equal(scholarshipRegistry.footerUser,true,'scholarship PDF footer must stamp the exporting user');
     assert.equal(scholarshipRegistry.footerReference,true,'scholarship PDF footer must include the reference number');
     await send('Emulation.setDeviceMetricsOverride',{width:360,height:520,deviceScaleFactor:1,mobile:true});
     const scholarshipMobile=await evaluate(`(()=>{const modal=document.getElementById('rptPrintModal'),shell=modal.firstElementChild,footer=document.getElementById('rptPrExportBtn').closest('.border-t'),banner=document.getElementById('rdfLocalAuditBanner'),shellRect=shell.getBoundingClientRect(),footerRect=footer.getBoundingClientRect(),bannerRect=banner?.getBoundingClientRect(),buttonRect=document.getElementById('rptPrExportBtn').getBoundingClientRect(),tabs=[...document.querySelectorAll('.report-view-tab')],tabWidths=tabs.map(tab=>tab.getBoundingClientRect().width),tabHeights=tabs.map(tab=>tab.getBoundingClientRect().height);return {shellTop:shellRect.top,shellBottom:shellRect.bottom,footerBottom:footerRect.bottom,viewport:innerHeight,horizontalOverflow:shell.scrollWidth>shell.clientWidth+1,buttonVisible:buttonRect.left>=0&&buttonRect.right<=innerWidth+1&&buttonRect.top>=0&&buttonRect.bottom<=innerHeight+1&&(!bannerRect||buttonRect.bottom<=bannerRect.top),tabWidths,tabHeights};})()`);
     assert.ok(scholarshipMobile.shellTop>=0&&scholarshipMobile.shellBottom<=scholarshipMobile.viewport+1,'scholarship modal must fit a small viewport');
     assert.ok(scholarshipMobile.footerBottom<=scholarshipMobile.viewport+1,'scholarship modal footer must remain visible');
     assert.equal(scholarshipMobile.horizontalOverflow,false,'scholarship modal must not require horizontal scrolling');
     assert.equal(scholarshipMobile.buttonVisible,true,'scholarship export action must stay above the local audit banner');
     assert.ok(Math.abs(scholarshipMobile.tabWidths[0]-scholarshipMobile.tabWidths[1])<=1,'mobile report menu buttons must have equal width');
     assert.ok(Math.abs(scholarshipMobile.tabHeights[0]-scholarshipMobile.tabHeights[1])<=1,'mobile report menu buttons must have equal height');
     await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
     await evaluate(`closeRptPrintModal()`);
     await evaluate(`switchReportView('employment')`);
     const capture=await evaluate(`(()=>{
       const original=_captureChart; const previous=LANG;const saved=localStorage.getItem('rdfLang');let labels=[];
       _captureChart=()=>{labels=_CHARTS.status.data.labels.slice();return 'fixture-image';};
       const images=captureReportCharts(['status'],previous==='th'?'en':'th');
       _captureChart=original;
       return {labels,image:images.status,lang:LANG,saved:localStorage.getItem('rdfLang'),previous,previousSaved:saved};
     })()`);
     assert.equal(capture.image,'fixture-image');
     assert.ok(capture.labels.includes(initialLang==='th'?'Active':'กำลังศึกษา'),'chart must use report language '+JSON.stringify(capture));
     assert.equal(capture.lang,capture.previous);assert.equal(capture.saved,capture.previousSaved);
     const employment=await evaluate(`({rows:document.querySelectorAll('#employmentTableBody tr').length,text:document.getElementById('employmentTableBody').textContent,duration:document.querySelector('#employmentTableBody tr td:nth-last-child(3)')?.textContent||''})`);
     assert.equal(employment.rows,1,'employment report must render repeatable work records');
     assert.match(employment.text,/RDF Foundation/,'employment report workplace');
     assert.match(employment.duration,initialLang==='th'?/1 ปี 3 เดือน/:/1 year 3 months/,'employment duration must localize from cached data');
     const updatedFilter=await evaluate(`(()=>{document.getElementById('empFltFollowUp').value='updated_recent';applyEmploymentFilters();const result={options:document.getElementById('empFltFollowUp').options.length,rows:filteredEmploymentPeople().length};resetEmploymentFilters();return result;})()`);
     assert.equal(updatedFilter.options,4,'follow-up filter must include recently updated data');
     assert.equal(updatedFilter.rows,1,'recent-update alerts must link to a matching report filter');
     const followUp=await evaluate(`(()=>{openEmploymentFollowUp('MBS_001','rec_work_1');return {open:!document.getElementById('empFollowUpModal').classList.contains('hidden'),records:document.getElementById('empFollowUpRecord').options.length,history:document.getElementById('empFollowUpList').textContent,formVisible:!document.getElementById('empFollowUpForm').classList.contains('hidden')};})()`);
     assert.equal(followUp.open,true,'follow-up modal must open');
     assert.equal(followUp.records,2,'follow-up must reference existing work records');
     assert.match(followUp.history,/Fixture follow-up/,'follow-up history must render');
     assert.equal(followUp.formVisible,true,'authorized staff can add follow-ups');
     await evaluate(`closeEmploymentFollowUp()`);
     const notificationSettings=await evaluate(`(()=>{openEmploymentFollowUpSettings();document.getElementById('empNotifLeadDays').value='21';document.getElementById('empNotifUpdatedDays').value='14';document.getElementById('empNotifMissing').checked=false;const target=LANG==='th'?'en':'th';setLang(target);const result={open:!document.getElementById('empFollowUpSettingsModal').classList.contains('hidden'),buttonVisible:getComputedStyle(document.getElementById('empFollowUpSettingsBtn')).display!=='none',leadDays:document.getElementById('empNotifLeadDays').value,updatedDays:document.getElementById('empNotifUpdatedDays').value,missing:document.getElementById('empNotifMissing').checked,roles:document.querySelectorAll('input[name="empNotifRole"]').length,title:document.getElementById('empNotifSettingsTitle').textContent.trim(),expectedTitle:t('empNotifSettingsTitle')};setLang(${JSON.stringify(initialLang)});return result;})()`);
     assert.equal(notificationSettings.open,true,'authorized staff can open follow-up notification settings');
     assert.equal(notificationSettings.buttonVisible,true,'follow-up settings must be visible in the employment report header');
     assert.equal(notificationSettings.leadDays,'21','language switching must preserve an unsaved advance-notice value');
     assert.equal(notificationSettings.updatedDays,'14','language switching must preserve the unsaved data-update window');
     assert.equal(notificationSettings.missing,false,'language switching must preserve unsaved notification choices');
     assert.equal(notificationSettings.roles,5,'notification audience must support the staff role model');
     assert.equal(notificationSettings.title,notificationSettings.expectedTitle,'follow-up settings title must localize dynamically');
     await send('Emulation.setDeviceMetricsOverride',{width:360,height:520,deviceScaleFactor:1,mobile:true});
     const notificationMobile=await evaluate(`(()=>{const shell=document.querySelector('.emp-notif-shell'),body=document.querySelector('.emp-notif-body'),footer=document.getElementById('empNotifSaveBtn').closest('.emp-notif-footer'),banner=document.getElementById('rdfLocalAuditBanner'),shellRect=shell.getBoundingClientRect(),footerRect=footer.getBoundingClientRect(),bannerRect=banner?.getBoundingClientRect();body.scrollTop=body.scrollHeight;return {shellTop:shellRect.top,shellBottom:shellRect.bottom,footerBottom:footerRect.bottom,bannerTop:bannerRect?.top||innerHeight,viewport:innerHeight,horizontalOverflow:shell.scrollWidth>shell.clientWidth+1,bodyOverflow:getComputedStyle(body).overflowY,atBottom:Math.abs(body.scrollHeight-body.clientHeight-body.scrollTop)<2};})()`);
     assert.ok(notificationMobile.shellTop>=0&&notificationMobile.shellBottom<=notificationMobile.viewport+1,'notification settings must fit a small viewport');
     assert.ok(notificationMobile.footerBottom<=notificationMobile.bannerTop+1,'notification settings actions must remain above the local audit banner '+JSON.stringify(notificationMobile));
     assert.equal(notificationMobile.horizontalOverflow,false,'notification settings must not require horizontal scrolling');
     assert.equal(notificationMobile.bodyOverflow,'auto','long notification settings must scroll inside the modal');
     assert.equal(notificationMobile.atBottom,true,'notification settings scroll must reach the final controls');
     await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
     await evaluate(`closeEmploymentFollowUpSettings()`);
     const exportView=await evaluate(`({button:getComputedStyle(document.getElementById('empExportBtn')).display,rows:employmentExportRows().length,headers:employmentExportHeaders().length,safe:csvEmploymentCell('=SUM(1,1)')})`);
     assert.notEqual(exportView.button,'none','authorized users must see employment CSV export');
     assert.equal(exportView.rows,1,'employment export must follow the rendered report data');
     assert.equal(exportView.headers,26,'employment export must include compact groups, granular fields, and follow-up notes');
     assert.equal(exportView.safe,'"\'=SUM(1,1)"','employment CSV must neutralize spreadsheet formulas');
     const composer=await evaluate(`(()=>{closeRptPrintModal();openEmploymentReportComposer();const config=document.querySelector('.report-composer-config'),fields=[...document.querySelectorAll('input[name="empReportField"]')],preview=document.getElementById('empReportPreview');return {open:!document.getElementById('empReportComposerModal').classList.contains('hidden'),fields:fields.length,lastField:fields.at(-1)?.value,notesSelected:fields.at(-1)?.checked===true,selected:document.querySelectorAll('input[name="empReportField"]:checked').length,signatures:document.querySelectorAll('input[name="empReportSignature"]').length,recorderName:window._empReportSignatures?.[0]?.name,signatureImage:!!preview.querySelector('.preview-signature img'),formats:document.querySelectorAll('input[name="empComposerFormat"]').length,format:employmentReportFormat(),orientation:employmentReportOrientation(),preview:preview.textContent,cancel:document.querySelector('#empReportComposerModal .report-composer-footer button')?.textContent.trim(),exportVisible:getComputedStyle(document.getElementById('empComposerExportBtn')).display,configOverflow:getComputedStyle(config).overflowY,configScrollable:config.scrollHeight>config.clientHeight};})()`);
     assert.equal(composer.open,true,'employment report composer must open');
     assert.equal(composer.fields,26,'report composer must offer compact groups and all granular export fields');
     assert.equal(composer.lastField,'followUpNotes','follow-up notes must remain the final selectable/exported column');
     assert.equal(composer.notesSelected,true,'follow-up notes must be included in the recommended report');
     assert.ok(composer.selected>0&&composer.selected<composer.fields,'report composer must start with a usable recommended field set');
     assert.equal(composer.signatures,2,'report composer must reuse the system signatory slots');
     assert.equal(composer.recorderName,'Test Admin','data recorder must resolve to the signed-in user full name');
     assert.equal(composer.signatureImage,true,'saved shared signatures must render in the report preview');
     assert.match(composer.preview,/RDF Foundation|Dr\. Robert Dyckerhoff/,'report composer must render a document preview');
     assert.match(composer.preview,initialLang==='th'?/ไม่ได้รับทุนต่อเนื่อง/:/no continuous RDF funding/,'continued study without RDF funding must appear from the canonical scholarship data');
     assert.equal(composer.cancel,initialLang==='th'?'ยกเลิกส่งออกรายงาน':'Cancel report export','composer cancel action must explicitly cancel report export');
     assert.equal(composer.formats,2,'report composer must offer Excel and PDF');
     assert.equal(composer.format,'pdf','formal PDF must be the initial export choice');
     assert.equal(composer.orientation,'landscape','A4 landscape must be the default');
     assert.notEqual(composer.exportVisible,'none','export permission must expose the export action');
     assert.equal(composer.configOverflow,'scroll','the left configuration pane must own a visible scrollbar');
     assert.equal(composer.configScrollable,true,'the left configuration pane must scroll through all controls');
     const composerSignature=await evaluate(`(async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));let canvas=document.getElementById('empSigCanvas_0');canvas.setPointerCapture=()=>{};canvas.releasePointerCapture=()=>{};const initial=reportSignatureDataUrl(_EMP_REPORT_SIGNATURE_DRAFTS[0]).startsWith('data:image/png;base64,');clearEmploymentReportSignature(0);const cleared=!_EMP_REPORT_SIGNATURE_DRAFTS[0].signatureDataUrl,rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+5,clientY:rect.top+10,pointerId:1,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:rect.left+70,clientY:rect.top+35,pointerId:1,bubbles:true}));canvas.dispatchEvent(new PointerEvent('pointerup',{clientX:rect.left+70,clientY:rect.top+35,pointerId:1,bubbles:true}));const redrawn=reportSignatureDataUrl(_EMP_REPORT_SIGNATURE_DRAFTS[0]).startsWith('data:image/png;base64,'),draft=_EMP_REPORT_SIGNATURE_DRAFTS[0].signatureDataUrl,previewImage=!!document.querySelector('#empReportPreview .preview-signature img'),included=document.getElementById('empSigInclude_0').checked,target=employmentReportLang()==='th'?'en':'th';document.querySelectorAll('input[name="empComposerLang"]').forEach(input=>input.checked=input.value===target);refreshEmploymentReportComposer();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));const preserved=_EMP_REPORT_SIGNATURE_DRAFTS[0].signatureDataUrl===draft,pads=document.querySelectorAll('.report-signature-pad-canvas').length;document.querySelectorAll('input[name="empComposerLang"]').forEach(input=>input.checked=input.value!==target);refreshEmploymentReportComposer();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));clearEmploymentReportSignature(0,true);const retryFocused=document.activeElement===document.getElementById('empSigCanvas_0');_EMP_REPORT_SIGNATURE_DRAFTS[0].signatureDataUrl=draft;syncEmploymentReportSignatureDrafts();renderEmploymentReportPreview();return {initial,cleared,redrawn,previewImage,included,preserved,pads,retryFocused,clearLabel:[...document.querySelectorAll('.report-signature-pad-actions button')].some(button=>button.textContent.trim()===employmentReportText('stSigClear',employmentReportLang())),retryLabel:[...document.querySelectorAll('.report-signature-pad-actions button')].some(button=>button.textContent.trim()===employmentReportText('stSigRetry',employmentReportLang()))};})()`);
     assert.equal(composerSignature.initial,true,'report composer must load the shared saved signature into its drawing pad');
     assert.equal(composerSignature.cleared,true,'report composer must clear only its current signature draft');
     assert.equal(composerSignature.redrawn,true,'report composer must capture an on-screen signature');
     assert.equal(composerSignature.previewImage,true,'a signature drawn in the composer must update the document preview');
     assert.equal(composerSignature.included,true,'drawing a signature must include that signatory in the report');
     assert.equal(composerSignature.preserved,true,'an unsaved report signature must survive report-language switching');
     assert.equal(composerSignature.pads,2,'the composer must provide one drawing pad per shared signatory');
     assert.equal(composerSignature.retryFocused,true,'sign again must clear and focus the report signature pad');
     assert.equal(composerSignature.clearLabel,true,'the report signature clear action must be localized');
     assert.equal(composerSignature.retryLabel,true,'the report signature retry action must be localized');
     const orientationView=await evaluate(`(async()=>{const preview=document.getElementById('empReportPreview'),config=document.querySelector('.report-composer-config'),originalData=_EMP_CACHE.response.data;_EMP_CACHE.response.data=Array.from({length:4},(_,index)=>({...originalData[0],stipNo:'MBS_00'+(index+1)}));renderEmploymentReportPreview();await new Promise(resolve=>setTimeout(resolve,240));const landscape=preview.getBoundingClientRect(),landscapeContent=preview.querySelector('.report-preview-content').getBoundingClientRect(),landscapeFits=landscapeContent.right<=landscape.right+1&&landscapeContent.bottom<=landscape.bottom+1,landscapeScale=Number(preview.dataset.previewScale);document.querySelector('input[name="empComposerOrientation"][value="portrait"]').checked=true;renderEmploymentReportPreview();await new Promise(resolve=>setTimeout(resolve,240));const portrait=preview.getBoundingClientRect(),portraitContent=preview.querySelector('.report-preview-content').getBoundingClientRect(),portraitFits=portraitContent.right<=portrait.right+1&&portraitContent.bottom<=portrait.bottom+1,portraitScale=Number(preview.dataset.previewScale),header=preview.querySelector('.report-preview-header').getBoundingClientRect(),verificationNode=preview.querySelector('.report-preview-verification'),verification=verificationNode.getBoundingClientRect(),reference=verificationNode.children[0].getBoundingClientRect(),qr=verificationNode.children[1].getBoundingClientRect(),verificationChildren=[...verificationNode.children].map(node=>node.id||node.className);config.scrollTop=config.scrollHeight;const atBottom=Math.abs(config.scrollHeight-config.clientHeight-config.scrollTop)<2;_EMP_CACHE.response.data=originalData;document.querySelector('input[name="empComposerOrientation"][value="landscape"]').checked=true;renderEmploymentReportPreview();return {landscape:{width:landscape.width,height:landscape.height,scale:landscapeScale,fits:landscapeFits,rightDelta:landscapeContent.right-landscape.right,bottomDelta:landscapeContent.bottom-landscape.bottom},portrait:{width:portrait.width,height:portrait.height,scale:portraitScale,fits:portraitFits,rightDelta:portraitContent.right-portrait.right,bottomDelta:portraitContent.bottom-portrait.bottom},dataset:preview.dataset.orientation,verificationRightAligned:Math.abs(verification.right-header.right)<2,qrRightOfReference:qr.left>=reference.right,verificationChildren,atBottom};})()`);
     assert.ok(orientationView.portrait.width<orientationView.landscape.width,'portrait selection must visibly narrow the paper preview '+JSON.stringify(orientationView));
     assert.ok(orientationView.portrait.height>orientationView.landscape.height,'portrait selection must visibly increase the paper preview height '+JSON.stringify(orientationView));
     assert.ok(Math.abs(orientationView.landscape.width/orientationView.landscape.height-(297/210))<0.02,'landscape preview must use the A4 297:210 ratio');
     assert.ok(Math.abs(orientationView.portrait.width/orientationView.portrait.height-(210/297))<0.02,'portrait preview must use the A4 210:297 ratio');
     assert.equal(orientationView.landscape.fits,true,'four-row landscape preview must keep content inside the A4 paper '+JSON.stringify(orientationView.landscape));
     assert.equal(orientationView.portrait.fits,true,'four-row portrait preview must keep content inside the A4 paper '+JSON.stringify(orientationView.portrait));
     assert.equal(orientationView.dataset,'landscape','orientation test must restore the default landscape preview');
     assert.equal(orientationView.verificationRightAligned,true,'reference and QR block must be aligned to the right edge of the header');
     assert.equal(orientationView.qrRightOfReference,true,'QR must be positioned to the right of the reference');
     assert.match(String(orientationView.verificationChildren.at(-1)),/empPreviewQr|report-preview-qr/,'QR must follow the reference in the right header block');
     assert.equal(orientationView.atBottom,true,'the settings scrollbar must reach the final report controls');
     const selectedExport=await evaluate(`(()=>{document.querySelectorAll('input[name="empReportField"]').forEach((input,index)=>input.checked=index<2);renderEmploymentReportPreview();const keys=selectedEmploymentReportFields();return {keys,headers:employmentExportHeaders(keys,employmentReportLang()).length,rowWidth:employmentExportRows(keys,employmentReportLang())[0].length,previewHeaders:document.querySelectorAll('#empReportPreview th').length};})()`);
     assert.equal(selectedExport.headers,2,'selected fields must control CSV headers');
     assert.equal(selectedExport.rowWidth,2,'selected fields must control CSV rows');
     assert.equal(selectedExport.previewHeaders,2,'selected fields must control the preview');
     const registry=await evaluate(`(async()=>{const issued=await issueEmploymentReportReference();return {reference:issued.report.referenceNo,url:issued.verificationUrl,qrVersion:issued.report.qrVersion,previewReference:document.getElementById('empReportPreview').textContent,regenerateVisible:getComputedStyle(document.getElementById('empRegenerateQrBtn')).display};})()`);
     assert.equal(registry.reference,'RDF-EMP-20260320-11111111','first export must receive a report reference');
     assert.match(registry.url,/report-verification\.html\?token=/,'QR must target the protected verification page');
     assert.equal(registry.qrVersion,1,'new report QR starts at version 1');
     assert.match(registry.previewReference,/RDF-EMP-20260320-11111111/,'issued reference must appear in the preview');
     assert.notEqual(registry.regenerateVisible,'none','authorized users can request conditional QR regeneration');
     const printLayout=await evaluate(`(async()=>{document.querySelectorAll('input[name="empReportField"]').forEach(input=>input.checked=true);renderEmploymentReportPreview();const fields=EMPLOYMENT_REPORT_FIELDS.slice(),landscape=employmentReportColumnChunks(fields,'landscape'),portrait=employmentReportColumnChunks(fields,'portrait'),html=await buildEmploymentPrintHtml(_EMP_REPORT_REGISTRATION,'data:image/png;base64,AA=='),preview=document.getElementById('empReportPreview');return {landscapeMax:Math.max(...landscape.map(chunk=>chunk.length)),portraitMax:Math.max(...portrait.map(chunk=>chunk.length)),landscapeParts:landscape.length,portraitParts:portrait.length,fixedTable:html.includes('table-layout:fixed'),pageSetup:html.includes('@page{size:A4 landscape'),footerUser:html.includes('Test Admin'),footerReference:html.includes('RDF-EMP-20260320-11111111'),signatureImage:html.includes('data:image/png;base64,iVBOR'),qrRight:/<div class="verification"><div class="reference">[\\s\\S]*<img class="qr"/.test(html),pageSetupText:html.includes('Page setup:'),previewOverflow:preview.scrollWidth>preview.clientWidth+1};})()`);
     assert.ok(printLayout.landscapeParts>1&&printLayout.landscapeMax<=8,'landscape PDF must split wide reports into bounded column sets');
     assert.ok(printLayout.portraitParts>printLayout.landscapeParts&&printLayout.portraitMax<=5,'portrait PDF must use narrower column sets');
     assert.equal(printLayout.fixedTable,true,'print tables must use fixed layout inside page margins');
     assert.equal(printLayout.pageSetup,true,'formal report must apply the selected A4 orientation');
     assert.equal(printLayout.footerUser,true,'formal report footer must stamp the exporting user');
     assert.equal(printLayout.footerReference,true,'formal report footer must include the reference number');
     assert.equal(printLayout.signatureImage,true,'formal report must render the shared saved signature');
     assert.equal(printLayout.qrRight,true,'formal report must place QR to the right of its reference');
     assert.equal(printLayout.pageSetupText,false,'paper setup text must not be printed in the report header');
     assert.equal(printLayout.previewOverflow,false,'document preview must not overflow horizontally');
     await send('Emulation.setDeviceMetricsOverride',{width:360,height:520,deviceScaleFactor:1,mobile:true});
     const composerMobile=await evaluate(`(()=>{const shell=document.querySelector('.report-composer-shell'),body=document.querySelector('.report-composer-body'),footer=document.querySelector('.report-composer-footer'),banner=document.getElementById('rdfLocalAuditBanner'),shellRect=shell.getBoundingClientRect(),footerRect=footer.getBoundingClientRect(),bannerRect=banner?.getBoundingClientRect();return {width:innerWidth,shellTop:shellRect.top,shellBottom:shellRect.bottom,footerBottom:footerRect.bottom,viewport:innerHeight,bodyOverflow:getComputedStyle(body).overflowY,horizontalOverflow:shell.scrollWidth>shell.clientWidth+1,exportVisible:(()=>{const r=document.getElementById('empComposerExportBtn').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&(!bannerRect||r.bottom<=bannerRect.top);})()};})()`);
     assert.equal(composerMobile.width,360,'report composer mobile test must use a small viewport');
     assert.ok(composerMobile.shellTop>=0&&composerMobile.shellBottom<=composerMobile.viewport+1,'report composer shell must fit inside a small viewport');
     assert.ok(composerMobile.footerBottom<=composerMobile.viewport+1,'report composer footer must remain visible');
     assert.equal(composerMobile.bodyOverflow,'auto','the composer body must own mobile scrolling');
     assert.equal(composerMobile.horizontalOverflow,false,'report composer must not require horizontal scrolling');
     assert.equal(composerMobile.exportVisible,true,'mobile export action must remain visible '+JSON.stringify(composerMobile));
     await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
     await evaluate(`closeEmploymentReportComposer()`);
     const localAudit=await evaluate(`(async()=>{const blocked=await API.saveEmploymentFollowUp({});return {mode:RDF.LOCAL_AUDIT_MODE,banner:document.getElementById('rdfLocalAuditBanner')?.textContent||'',code:blocked.code};})()`);
     assert.equal(localAudit.mode,true,'localhost must enter audit mode automatically');
     assert.match(localAudit.banner,/LOCALHOST/,'localhost audit banner must be visible');
     assert.equal(localAudit.code,'LOCAL_AUDIT_MODE','localhost must reject mutation requests before fetch');
     await send('Emulation.clearDeviceMetricsOverride');
   }
   if(file==='report-verification.html') {
     await delay(50);
     const verification=await evaluate(`({publicVisible:!document.getElementById('verifyResult').classList.contains('hidden'),subject:document.getElementById('verifySubject').textContent,reference:document.getElementById('verifyReference').textContent,detailsVisible:!document.getElementById('verifyDetails').classList.contains('hidden'),hash:document.getElementById('detailHash').textContent,publicNotice:document.querySelector('.notice').textContent,scholarshipType:verificationType({reportType:'scholarship_statistics'}),promotionType:verificationType({reportType:'promotion_results'}),academicType:verificationType({reportType:'academic_results'}),regenerateVisible:getComputedStyle(document.getElementById('verifyRegenerateBtn')).display})`);
     assert.equal(verification.publicVisible,true,'valid QR must show the public verification summary');
     assert.match(verification.subject,/รายงานภาวะ|Alumni Employment/,'public QR view must expose the report subject');
     assert.match(verification.reference,/RDF-EMP-20260320-11111111/,'public QR view must expose the reference number');
     assert.equal(verification.detailsVisible,true,'an authenticated report viewer can see verification metadata');
     assert.match(verification.hash,/^c{64}$/,'authenticated details must expose the content fingerprint');
     assert.doesNotMatch(verification.publicNotice,/MBS_001|Test Student/,'public verification notice must not expose report rows');
     assert.equal(verification.scholarshipType,initialLang==='th'?'รายงานสถิติทุนการศึกษา':'Scholarship statistics report','verification page must localize the scholarship report type');
     assert.equal(verification.promotionType,initialLang==='th'?'รายงานเลื่อนชั้นและผู้สำเร็จการศึกษา':'Promotion and graduation report','verification page must localize the promotion report type');
     assert.equal(verification.academicType,initialLang==='th'?'รายงานผลการศึกษา':'Academic results report','verification page must localize the academic report type');
     assert.notEqual(verification.regenerateVisible,'none','authorized report viewers with export permission can conditionally regenerate any report QR');
   }
   if(file==='academic-results.html') {
     const academicReport=await evaluate(`(async()=>{const lang=LANG,isEN=lang==='en',rows=collectAcademicReportRows({acad:'2568',sem:'1',inst:'',isEN,sortBy:'inst'}),registration=await registerAcademicReport({rows,lang,acad:'2568',sem:'1',inst:'',sortBy:'inst'}),html=generateGradeReportHTML({lang,isEN,acad:'2568',pDate:'2026-03-20',sem:'1',inst:'',subject:'',sortBy:'inst',orientation:'portrait',selSigs:[],rows,registration,qrDataUrl:'data:image/png;base64,AA=='});return {rows:rows.length,type:registration.report.reportType,reference:registration.report.referenceNo,url:registration.verificationUrl,page:html.includes('@page{size:A4 portrait'),fixed:html.includes('table-layout:fixed'),qr:html.includes('class="rpt-qr"'),footerUser:html.includes('Test Admin'),footerReference:html.includes('RDF-ACA-20260320-44444444'),orientations:document.querySelectorAll('input[name="arPrOrientation"]').length,defaultOrientation:document.querySelector('input[name="arPrOrientation"]:checked')?.value};})()`);
     assert.equal(academicReport.rows,1,'academic report must use the selected source records without copying them into a second database');
     assert.equal(academicReport.type,'academic_results','academic results must use the central report registry');
     assert.equal(academicReport.reference,'RDF-ACA-20260320-44444444','academic report must receive a central reference');
     assert.match(academicReport.url,/report-verification\.html\?token=/,'academic report QR must target the protected verification page');
     assert.equal(academicReport.page,true,'academic report must apply selected A4 orientation');
     assert.equal(academicReport.fixed,true,'academic table must stay within page margins');
     assert.equal(academicReport.qr,true,'academic report must place QR in the left header');
     assert.equal(academicReport.footerUser,true,'academic report footer must stamp the exporting user');
     assert.equal(academicReport.footerReference,true,'academic report footer must contain its reference');
     assert.equal(academicReport.orientations,2,'academic formal report must offer landscape and portrait');
     assert.equal(academicReport.defaultOrientation,'landscape','academic formal report must default to landscape');
   }
   if(file==='promotion.html') {
     const promotionReport=await evaluate(`(async()=>{const lang=LANG,isEN=lang==='en',rows=[{stipNo:'MBS_001',name:'Fixture',institution:'MBS',level:'Grade 10',action:'promote'}],registration=await registerPromotionReport({rows,lang,reportTypes:['promotion'],scope:{academicYear:'2568'}}),opts={lang,reportTypes:['promotion'],insts:new Set(),levels:new Set(),school:'',subject:'',acad:'2568',pDate:'2026-03-20',sigs:[],sortByLevel:true,sortByPriority:false,sortByName:false,orientation:'portrait',graduatedStudents:[]},html=generateFormalReportHTML(opts,registration,'data:image/png;base64,AA==');return {type:registration.report.reportType,reference:registration.report.referenceNo,url:registration.verificationUrl,page:html.includes('@page{size:A4 portrait'),fixed:html.includes('table-layout:fixed'),qr:html.includes('class="rpt-qr"'),footerUser:html.includes('Test Admin'),footerReference:html.includes('RDF-PRO-20260320-33333333'),orientations:document.querySelectorAll('input[name="prOrientation"]').length,defaultOrientation:document.querySelector('input[name="prOrientation"]:checked')?.value};})()`);
     assert.equal(promotionReport.type,'promotion_results','promotion and graduation reports must use the central report registry');
     assert.equal(promotionReport.reference,'RDF-PRO-20260320-33333333','promotion report must receive a central reference');
     assert.match(promotionReport.url,/report-verification\.html\?token=/,'promotion report QR must target the protected verification page');
     assert.equal(promotionReport.page,true,'promotion report must apply selected A4 orientation');
     assert.equal(promotionReport.fixed,true,'promotion table must stay within page margins');
     assert.equal(promotionReport.qr,true,'promotion report must place QR in the left header');
     assert.equal(promotionReport.footerUser,true,'promotion report footer must stamp the exporting user');
     assert.equal(promotionReport.footerReference,true,'promotion report footer must contain its reference');
     assert.equal(promotionReport.orientations,2,'promotion formal report must offer landscape and portrait');
     assert.equal(promotionReport.defaultOrientation,'landscape','promotion formal report must default to landscape');
   }
   if(initialLang==='en' && file==='students.html') {
     const dynamic=await evaluate(`({institutionLevel:document.querySelector('#studentTableBody tr td:nth-child(3)')?.textContent||'',scholarshipYear:document.querySelector('#studentTableBody tr td:nth-child(4)')?.textContent||''})`);
     assert.equal(/[ก-๙]/.test(dynamic.institutionLevel),false,'student level must be English');
     assert.equal(/[ก-๙]/.test(dynamic.scholarshipYear),false,'academic year must be English');
   }
   if(file==='students.html') {
     const alumniShortcut=await evaluate(`(()=>{const shortcut=document.getElementById('alumniEmploymentShortcut'),initialHidden=getComputedStyle(shortcut).display==='none';document.getElementById('filterStatus').value='Alumni';applyFilters();const link=document.getElementById('alumniEmploymentReportLink');const result={initialHidden,shown:getComputedStyle(shortcut).display!=='none',href:link.getAttribute('href'),title:document.getElementById('alumniEmploymentShortcutTitle').textContent.trim(),button:link.textContent.trim(),expectedTitle:t('rptViewEmployment'),expectedButton:t('alumniEmploymentShortcutOpen')};document.getElementById('filterStatus').value='';applyFilters();return result;})()`);
     assert.equal(alumniShortcut.initialHidden,true,'employment shortcut must stay out of the general student list');
     assert.equal(alumniShortcut.shown,true,'employment shortcut must be visible in the alumni view');
     assert.equal(alumniShortcut.href,'reports.html?view=employment&source=alumni','alumni shortcut must deep-link to the employment report');
     assert.equal(alumniShortcut.title,alumniShortcut.expectedTitle,'alumni shortcut title must match the destination');
     assert.equal(alumniShortcut.button,alumniShortcut.expectedButton,'alumni shortcut action must be explicit');
   }
   if(initialLang==='en' && file==='academic-results.html') {
     const dynamic=await evaluate(`(()=>{document.getElementById('fltYear').value='2568';document.getElementById('fltSem').value='1';applyFilters();return document.getElementById('entryGroupsContainer').textContent;})()`);
     assert.equal(/[ก-๙]/.test(dynamic),false,'grade-entry dynamic UI must be English');
   }
   if(initialLang==='en' && file==='student-profile.html') {
     const dynamic=await evaluate(`document.getElementById('academicInfo').textContent`);
     assert.equal(/[ก-๙]/.test(dynamic),false,'profile academic UI must be English');
     const extra=await evaluate(`document.getElementById('dynamicFieldsProfile').textContent`);
     assert.match(extra,/Additional Information/,'dynamic profile section must use English metadata');
     assert.match(extra,/Employment duration/,'calculated employment duration must appear in the profile');
     assert.match(extra,/1 year/,'month-range duration must include both boundary months');
   }
   if(initialLang==='en' && file==='student-form.html') {
     const duration=await evaluate(`(()=>{
       const start=document.querySelector('[data-df-field="fld_start"] [data-df-input]');
       const end=document.querySelector('[data-df-field="fld_end"] [data-df-input]');
       start.value='2025-01';start.dispatchEvent(new Event('input',{bubbles:true}));
       end.value='2025-12';end.dispatchEvent(new Event('input',{bubbles:true}));
       const calculated=document.querySelector('[data-df-calculated="fld_duration"]');
       return {value:calculated?.value||'',readOnly:calculated?.readOnly===true};
     })()`);
     assert.deepEqual(duration,{value:'1 year',readOnly:true},'duration must recalculate immediately and remain read-only');
     const shortcut=await evaluate(`({shown:getComputedStyle(document.getElementById('customFieldAdminShortcut')).display,href:document.querySelector('#customFieldAdminShortcut a')?.getAttribute('href')})`);
     assert.notEqual(shortcut.shown,'none','authorized administrators must see the form-builder shortcut in the student form');
     assert.equal(shortcut.href,'custom-fields.html');
   }
   if(initialLang==='en' && file==='students.html') {
     const shortcut=await evaluate(`({shown:getComputedStyle(document.getElementById('manageCustomFieldsBtn')).display,href:document.getElementById('manageCustomFieldsBtn').getAttribute('href')})`);
     assert.notEqual(shortcut.shown,'none','authorized administrators must see the form-builder shortcut in the student list');
     assert.equal(shortcut.href,'custom-fields.html');
   }
   if(initialLang==='en' && file==='custom-fields.html') {
     const builder=await evaluate(`({label:document.getElementById('fld_label_th').value,selected:[...document.querySelectorAll('#fld_visible_roles input:checked')].map(e=>e.value),schema:document.getElementById('schemaList').textContent,guide:document.getElementById('usageGuide').textContent})`);
     assert.equal(builder.label,'ค่าที่ยังไม่บันทึก','builder must preserve unsaved metadata on language switch');
     assert.equal(builder.selected.includes('SuperAdmin'),false,'builder must preserve unsaved permission selection');
     assert.match(builder.schema,/Additional Information/,'builder list must use English metadata');
     assert.match(builder.guide,/How to use custom fields/,'builder guide must switch to English');
     const generated=await evaluate(`(()=>{openSectionEditor();const section={key:document.getElementById('sec_key').value,readOnly:document.getElementById('sec_key').readOnly};openFieldEditor(null,adminData.sections[0].sectionId);return {section,field:{key:document.getElementById('fld_key').value,readOnly:document.getElementById('fld_key').readOnly}};})()`);
     assert.match(generated.section.key,/^section_[a-f0-9]{16}$/,'new section must receive an automatic stable key');
     assert.match(generated.field.key,/^field_[a-f0-9]{16}$/,'new field must receive an automatic stable key');
     assert.equal(generated.section.readOnly,true,'section stable key must be read-only');
     assert.equal(generated.field.readOnly,true,'field stable key must be read-only');
     const conditionUx=await evaluate(`(()=>{conditionEditor('sec_condition',{logic:'AND',conditions:[{source:'core',field:'Status',operator:'in',value:['Graduated','WithdrawnScholarship']}]});const root=document.getElementById('sec_condition');return {values:readCondition('sec_condition').conditions[0].value,labels:[...root.querySelectorAll('.condition-value-option')].map(e=>e.textContent),summary:root.querySelector('.df-cond-summary').textContent,manual:!!root.querySelector('.df-cond-value'),multi:!!root.querySelector('.df-cond-values')};})()`);
     assert.deepEqual(conditionUx.values,['Graduated','WithdrawnScholarship'],'condition builder must preserve stored values without typing');
     assert.ok(conditionUx.labels.includes('Graduated'),'condition builder must show readable status labels');
     assert.match(conditionUx.summary,/Result: show when Scholarship status Is in list/,'condition builder must explain the resulting rule');
     assert.equal(conditionUx.manual,false,'standard status conditions must not use manual text input');
     assert.equal(conditionUx.multi,true,'in-list conditions must use a multi-choice control');
     const calculationUx=await evaluate(`(()=>{const field=adminData.fields.find(item=>item.fieldType==='calculated_duration');openFieldEditor(field);return {start:document.getElementById('fld_calc_start').value,end:document.getElementById('fld_calc_end').value,sourceCount:document.getElementById('fld_calc_start').options.length-1,editableDisabled:document.getElementById('fld_editable').disabled,calculationVisible:!document.getElementById('calculationEditor').classList.contains('hidden')};})()`);
     assert.deepEqual(calculationUx,{start:'fld_start',end:'fld_end',sourceCount:2,editableDisabled:true,calculationVisible:true},'calculated duration editor must use guided source selections');
     const audienceUx=await evaluate(`(()=>{openSectionEditor(adminData.sections[0]);const initial={audience:document.getElementById('sec_audience').value,advanced:!document.getElementById('sec_condition_section').classList.contains('hidden')};applySectionExample('employment');const rules=sectionRulesForAudience();return {initial,audience:document.getElementById('sec_audience').value,advanced:!document.getElementById('sec_condition_section').classList.contains('hidden'),statuses:rules.conditions[0].value};})()`);
     assert.deepEqual(audienceUx.initial,{audience:'all',advanced:false},'unconditional sections must use the friendly All students choice');
     assert.equal(audienceUx.audience,'alumni');assert.equal(audienceUx.advanced,false,'alumni preset should not expose advanced conditions');
     assert.deepEqual(audienceUx.statuses,['Graduated','Resigned','WithdrawnScholarship','Incomplete','University'],'alumni choice must map to stored status codes');
     const migration=await evaluate(`({visible:!document.getElementById('employmentMigrationPanel').classList.contains('hidden'),rows:document.querySelectorAll('#employmentMigrationRows tr').length,selected:document.querySelectorAll('.employment-migration-check:checked').length,text:document.getElementById('employmentMigrationPanel').textContent})`);
     assert.equal(migration.visible,true,'legacy migration preview must be visible after schema preparation');
     assert.equal(migration.rows,1,'legacy migration preview rows');
     assert.equal(migration.selected,1,'only ready legacy rows are selected');
     assert.match(migration.text,/RDF Foundation/,'legacy workplace mapping preview');
     const adoption=await evaluate(`(()=>{employmentTemplatePlan={status:'success',launchMode:'enabled',ready:false,safeToInstall:false,setupRequired:false,missingSections:[{sectionKey:'alumni_employment_summary'}],missingFields:[{fieldKey:'employment_current_status'}],conflicts:[],candidateSections:[{sectionId:'sec_existing',sectionKey:'section_existing',nameTH:'ประวัติการทำงาน',nameEN:'Employment History',fieldCount:0,adoptable:true,recommendedTargetKey:'alumni_employment_history'}],legacy:{rowsWithEmployment:0},operational:{sheets:[]}};renderEmploymentTemplatePlan();const button=document.getElementById('employmentTemplateBtn');return {text:button.textContent.trim(),disabled:button.disabled,candidate:button.dataset.adoptCandidateId,target:button.dataset.adoptTargetKey,notice:document.getElementById('employmentTemplateDetails').textContent};})()`);
     assert.equal(adoption.text,'Reuse section and install template','empty matching section must offer controlled reuse');
     assert.equal(adoption.disabled,false,'controlled reuse must be available after launch mode is enabled');
     assert.equal(adoption.candidate,'sec_existing');
     assert.equal(adoption.target,'alumni_employment_history');
     assert.match(adoption.notice,/retain its SectionID/,'reuse explanation must state that the original SectionID is preserved');
   }
   console.log('PASS '+file+' (initial '+initialLang+')');
  }
  const navigateAndWait=async url=>{
    await send('Page.navigate',{url});
    const deadline=Date.now()+10000;
    while(true){
      let ready=false;
      try{ready=await evaluate(`location.href===${JSON.stringify(url)}&&document.readyState==='complete'&&typeof setLang==='function'`);}catch(_){}
      if(ready)break;
      assert.ok(Date.now()<deadline,url+' did not finish loading');
      await delay(50);
    }
    await delay(50);
  };
  const alumniUrl=base+'/students.html?status=Alumni&testLang=th';
  await navigateAndWait(alumniUrl);
  const alumniRoute=await evaluate(`({shown:getComputedStyle(document.getElementById('alumniEmploymentShortcut')).display!=='none',status:document.getElementById('filterStatus').value,href:document.getElementById('alumniEmploymentReportLink').getAttribute('href')})`);
  assert.deepEqual(alumniRoute,{shown:true,status:'Alumni',href:'reports.html?view=employment&source=alumni'},'alumni URL must show the employment-report shortcut');
  console.log('PASS alumni employment shortcut route');
  const employmentUrl=base+'/reports.html?view=employment&source=alumni&testLang=th';
  await navigateAndWait(employmentUrl);
  const employmentRoute=await evaluate(`({view:document.getElementById('reportsWorkspace').dataset.reportView,visible:getComputedStyle(document.getElementById('employmentReportSection')).display!=='none',back:document.getElementById('reportsBackLink').getAttribute('href')})`);
  assert.deepEqual(employmentRoute,{view:'employment',visible:true,back:'students.html?status=Alumni'},'employment report URL must open the target view and preserve its alumni return path');
  console.log('PASS alumni employment report route');
 } finally {
  await send('Page.close');
  if(ws.readyState!==3)await new Promise(resolve=>{const timer=setTimeout(resolve,1000);ws.addEventListener('close',()=>{clearTimeout(timer);resolve();},{once:true});if(ws.readyState<2)ws.close();});
  await new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
 }
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
