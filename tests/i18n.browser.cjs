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
if (location.pathname.endsWith('/index.html')) localStorage.removeItem('rdfUser');
else localStorage.setItem('rdfUser', JSON.stringify({name:'Test Admin',username:'test',role:'SuperAdmin',sessionToken:'fixture',loginTime:Date.now()}));
window.tailwind = {};
window.lucide = {createIcons(){}};
window.Chart = class { static register(){}; constructor(el, cfg){this.data=cfg.data;this.options=cfg.options;} destroy(){} stop(){} update(){} toBase64Image(){return '';} };
window.Chart.defaults = {font:{},plugins:{legend:{labels:{}}}};
window.Swal = {fire:async(...args)=>({isConfirmed:false}),mixin(){return this;},showLoading(){},close(){}};
window.XLSX = {utils:{}};
window.fetch = async (url, options) => {
 const action = options?.body ? JSON.parse(options.body).action : new URL(url, location.href).searchParams.get('action');
 __calls.push(action);
 const student = {stipNo:'MBS_001',fname:'ทดสอบ',lname:'นักเรียน',fnameEn:'Test',lnameEn:'Student',institution:'MBS',level:'มัธยมศึกษาปีที่ 4 (Grade 10)',status:'Active',scholarshipYear:2025,entryYear:2025,phone:'0800000000',idCard:'1234567890123'};
 let data = {status:'success',data:[],rows:[],students:[],pending:[],sessions:{},stats:{Total:1,MBS:1}};
 if (action==='ping') data.status='ok';
 if (['getStudents','getStudentsForPromotion'].includes(action)) data.data=[student];
 if (action==='getSystemSettings') data.data={STUDENT_GRADES:[{stipNo:'MBS_001',acadYear:2568,semester:'1',gpa:3.5,updatedAt:'2026-01-15T12:00:00Z'}]};
 if (action==='getStudent') data.data={StipNo:'MBS_001',FirstName:'ทดสอบ',LastName:'นักเรียน',FirstNameEN:'Test',LastNameEN:'Student',Institution:'MBS',CurrentLevel:student.level,Status:'Active',ScholarshipYear:2025};
 if (action==='getAdmins') data.data=[{Username:'test',FirstName:'Test',LastName:'Admin',Role:'SuperAdmin',Status:'Active',LoginCount:1}];
 if (action==='generateStipNo') data.stipNo='MBS_002';
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
  for (const initialLang of ['th','en']) for (const file of ['index.html','dashboard.html','students.html','student-form.html','student-profile.html','reports.html','academic-results.html','academic-terms.html','promotion.html','settings.html']) {
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
   if(file==='settings.html') {
     await evaluate('Promise.all([loadOverview(), loadActiveSessions(), loadStudentEditableFields(), loadRbacPermissions()])');
     await evaluate(`document.querySelector('#studentFieldsGrid input').click(); openAdminModal(); document.getElementById('m_fname').value='Unsaved Admin';`);
   }
   if(file==='reports.html') await evaluate('openRptPrintModal()');
   if(file==='academic-results.html') await evaluate('openPrintModal()');
   const before=await evaluate(`(async()=>{
     if (location.pathname.endsWith('student-form.html')) {document.getElementById('f_institution').value='MBS';onInstitutionChange();document.getElementById('f_level').selectedIndex=2;}
     await new Promise(resolve => setTimeout(resolve, 50));
     const el=document.querySelector('input[type="text"]:not([readonly]):not([disabled])');if(el) el.value='Unsaved ไทย English';
     window.__beforeInputs=[...document.querySelectorAll('input,select,textarea')].map(e=>[e.id,e.value,e.checked]);
     return {calls:__calls.length,errors:__errors.slice()};
   })()`);
   const result=await evaluate(`(async()=>{
     document.getElementById('langBtn').click();
     await new Promise(resolve => setTimeout(resolve, 0));
     const en=document.documentElement.lang;
     const missing=[...document.querySelectorAll('[data-t]')].filter(e=>!e.getAttribute('data-t-attr') && e.textContent!==t(e.getAttribute('data-t'))).map(e=>e.getAttribute('data-t'));
     const enInputs=[...document.querySelectorAll('input,select,textarea')].map(e=>[e.id,e.value,e.checked]);
     document.getElementById('langBtn').click();
     await new Promise(resolve => setTimeout(resolve, 0));
     return {en,th:document.documentElement.lang,calls:__calls.length,errors:__errors,missing,enInputs,beforeInputs:__beforeInputs};
   })()`);
   assert.equal(result.en,initialLang==='th'?'en':'th',file);assert.equal(result.th,initialLang,file);
   assert.deepEqual(result.errors,[],file+' runtime errors');
   assert.equal(result.calls,before.calls,file+' must not refetch on switch');
   assert.deepEqual(result.enInputs,result.beforeInputs,file+' form values must remain unchanged');
   assert.deepEqual(result.missing,[],file+' stale translations');
   if(file==='index.html') {
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
   console.log('PASS '+file+' (initial '+initialLang+')');
  }
 } finally {await send('Page.close');ws.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
