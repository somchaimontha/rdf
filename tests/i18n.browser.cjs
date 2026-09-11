// Real Chrome DOM smoke test with isolated API and external-library fixtures.
// Start Chrome with --headless=new --remote-debugging-port=0 and set RDF_CHROME_PORT.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const fixture = `
window.__calls = []; window.__errors = [];
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
window.fetch = async (url, options) => {
 const action = options?.body ? JSON.parse(options.body).action : new URL(url, location.href).searchParams.get('action');
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
   ]
 };
 if (action==='getStudent') data.data={StipNo:'MBS_001',FirstName:'ทดสอบ',LastName:'นักเรียน',EngFirstName:'Test',EngLastName:'Student',Institution:'MBS',CurrentLevel:student.level,Status:'Active',ScholarshipYear:2025};
 if (action==='getAdmins') data.data=[{Username:'test',FirstName:'Test',LastName:'Admin',Role:'SuperAdmin',Status:'Active',LoginCount:1}];
 if (action==='generateStipNo') data.stipNo='MBS_002';
 if (action==='getDynamicFormSchema') data={status:'success',setupRequired:false,schemaVersion:'1.0.0',sections:[{sectionId:'sec_profile',sectionKey:'extra_profile',nameTH:'ข้อมูลเพิ่มเติม',nameEN:'Additional Information',descriptionTH:'ข้อมูลที่กำหนดจากระบบ',descriptionEN:'System-configured information',displayOrder:1,visibilityRules:{logic:'AND',conditions:[]},cardinality:'single',active:true}],fields:[{fieldId:'fld_note',fieldKey:'extra_note',labelTH:'ข้อความเพิ่มเติม',labelEN:'Additional note',fieldType:'text',sectionId:'sec_profile',displayOrder:1,required:false,visible:true,editable:true,canEdit:true,visibleRoles:['SuperAdmin'],editableRoles:['SuperAdmin'],visibilityRules:{logic:'AND',conditions:[]}}],options:[],values:location.pathname.endsWith('/student-profile.html')?[{valueId:'val_1',fieldId:'fld_note',recordId:'single',value:'Fixture value'}]:[]};
 if (action==='getDynamicFieldAdminData') data={status:'success',setupRequired:false,schemaVersion:'1.0.0',setup:{status:'success',ready:true,schemaVersion:'1.0.0',sheets:[{name:'FormSections',exists:true,missingHeaders:[],rowCount:1}]},sections:[{sectionId:'sec_profile',sectionKey:'extra_profile',nameTH:'ข้อมูลเพิ่มเติม',nameEN:'Additional Information',descriptionTH:'',descriptionEN:'',displayOrder:1,visibilityRules:{logic:'AND',conditions:[]},visibleRoles:['SuperAdmin'],cardinality:'single',collapsible:true,active:true}],fields:[{fieldId:'fld_note',fieldKey:'extra_note',labelTH:'ข้อความเพิ่มเติม',labelEN:'Additional note',fieldType:'text',sectionId:'sec_profile',displayOrder:1,required:false,visible:true,editable:true,active:true,archived:false,valueCount:1,visibleRoles:['SuperAdmin'],editableRoles:['SuperAdmin'],visibilityRules:{logic:'AND',conditions:[]}}],options:[]};
 if (action==='previewDynamicFieldSetup') data={status:'success',ready:true,schemaVersion:'1.0.0',sheets:[]};
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
  for (const initialLang of ['th','en']) for (const file of ['index.html','dashboard.html','students.html','student-form.html','student-profile.html','reports.html','academic-results.html','academic-terms.html','promotion.html','settings.html','custom-fields.html']) {
   const pageUrl=base+'/'+file+'?testLang='+initialLang+(file==='student-profile.html'?'&stipNo=MBS_001':'');
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
   if (file !== 'index.html') {
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
   if(file==='dashboard.html') {
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
         setUser(original);_notifCurrentUser=original;
         localStorage.removeItem(_notifReadKey());
         _notifSource={user:original,isStudent:false,pending,students,ownStudent:null};_notifLoaded=true;_notifLoadFailed=false;_rebuildNotifItems();_renderNotifPanel();
         document.getElementById('notifBellBtn').click();
         const open=document.getElementById('notifPanel').classList.contains('open');
         const details=[...document.querySelectorAll('.notif-item')].every(el=>el.querySelector('.notif-title')&&el.querySelector('.notif-desc')&&el.getAttribute('href'));
         const beforeUnread=document.querySelectorAll('.notif-item.unread').length;
         document.getElementById('notifMarkAllBtn').click();
         const afterUnread=document.querySelectorAll('.notif-item.unread').length;
         return {superAdmin,managerCanManage,finance,financeCanManage,dormTeacher,own,studentBroadcasts,open,details,beforeUnread,afterUnread};
       })()`);
       assert.deepEqual(notifications.superAdmin,['approval','incomplete','suspended','university'],'SuperAdmin notification permissions');
       assert.equal(notifications.managerCanManage,true,'Manager can manage system notifications by default');
       assert.deepEqual(notifications.finance,['suspended'],'Finance notification permissions');
       assert.equal(notifications.financeCanManage,false,'Finance cannot manage system notifications by default');
       assert.deepEqual(notifications.dormTeacher,['incomplete','suspended'],'DormTeacher notification permissions');
       assert.deepEqual(notifications.own,['own-profile'],'Student must only receive their own profile notification');
       assert.deepEqual(notifications.studentBroadcasts,[{id:'broadcast:all',href:'dashboard.html'},{id:'broadcast:mbs',href:'dashboard.html'}],'Student broadcasts must match their institution and safe destinations');
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
     const capture=await evaluate(`(()=>{
       const original=_captureChart; const previous=LANG;const saved=localStorage.getItem('rdfLang');let labels=[];
       _captureChart=()=>{labels=_CHARTS.status.data.labels.slice();return 'fixture-image';};
       const images=captureReportCharts(['status'],previous==='th'?'en':'th');
       _captureChart=original;
       return {labels,image:images.status,lang:LANG,saved:localStorage.getItem('rdfLang'),previous,previousSaved:saved};
     })()`);
     assert.equal(capture.image,'fixture-image');
     assert.ok(capture.labels.includes(initialLang==='th'?'Active':'กำลังศึกษา'),'chart must use report language');
     assert.equal(capture.lang,capture.previous);assert.equal(capture.saved,capture.previousSaved);
   }
   if(initialLang==='en' && file==='students.html') {
     const dynamic=await evaluate(`({institutionLevel:document.querySelector('#studentTableBody tr td:nth-child(3)')?.textContent||'',scholarshipYear:document.querySelector('#studentTableBody tr td:nth-child(4)')?.textContent||''})`);
     assert.equal(/[ก-๙]/.test(dynamic.institutionLevel),false,'student level must be English');
     assert.equal(/[ก-๙]/.test(dynamic.scholarshipYear),false,'academic year must be English');
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
   }
   if(initialLang==='en' && file==='custom-fields.html') {
     const builder=await evaluate(`({label:document.getElementById('fld_label_th').value,selected:[...document.querySelectorAll('#fld_visible_roles input:checked')].map(e=>e.value),schema:document.getElementById('schemaList').textContent})`);
     assert.equal(builder.label,'ค่าที่ยังไม่บันทึก','builder must preserve unsaved metadata on language switch');
     assert.equal(builder.selected.includes('SuperAdmin'),false,'builder must preserve unsaved permission selection');
     assert.match(builder.schema,/Additional Information/,'builder list must use English metadata');
   }
   console.log('PASS '+file+' (initial '+initialLang+')');
  }
 } finally {await send('Page.close');ws.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
