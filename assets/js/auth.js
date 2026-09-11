/* ── RDF Auth & Session ── */

const SESSION_TTL = 5 * 60 * 60 * 1000; // 5 hours in ms

function getUser() {
  try { return JSON.parse(localStorage.getItem('rdfUser')); } catch { return null; }
}
function setUser(data) { localStorage.setItem('rdfUser', JSON.stringify(data)); }
function clearUser() { localStorage.removeItem('rdfUser'); }
function getSessionToken() {
  try { return (JSON.parse(localStorage.getItem('rdfUser')) || {}).sessionToken || ''; } catch { return ''; }
}

function requireAuth(redirectTo = 'index.html') {
  const user = getUser();
  if (!user) { window.location.href = redirectTo; return null; }
  // Check 5-hour session expiry
  if (user.loginTime && (Date.now() - user.loginTime) > SESSION_TTL) {
    clearUser();
    window.location.href = redirectTo + '?expired=1';
    return null;
  }
  return user;
}

function renderNavUser(user) {
  const wrap = document.getElementById('navUserWrap');
  if (!wrap || !user) return;
  wrap.classList.remove('hidden');
  const pic = document.getElementById('navAvatar');
  const name = document.getElementById('navUserName');
  const role = document.getElementById('navUserRole');
  if (pic) {
    const _fallback = avatarUrl(user.name, 64);
    pic.src = user.pic ? driveImgUrl(user.pic, 'w64') : _fallback;
    pic.onerror = () => { pic.onerror = null; pic.src = _fallback; };
  }
  if (name) name.textContent = user.name;
  if (role) role.textContent = user.role;
  const logoutBtn = document.getElementById('btnLogout');
  if (logoutBtn) logoutBtn.classList.remove('hidden');
  _initNotifBell(user);
}

// ── Notification Center (permission-aware) ───────────────────────────────────
let _notifItems = [];
let _notifLoaded = false;
let _notifLoadFailed = false;
let _notifRefreshPromise = null;
let _notifCurrentUser = null;
let _notifSource = null;

function _injectNotifStyles() {
  if (document.getElementById('_notifBellStyle')) return;
  const s = document.createElement('style');
  s.id = '_notifBellStyle';
  s.textContent = `
    @keyframes _bellRing {
      0%,100%{transform:rotate(0)}
      15%{transform:rotate(18deg)}
      30%{transform:rotate(-16deg)}
      45%{transform:rotate(12deg)}
      60%{transform:rotate(-8deg)}
      75%{transform:rotate(4deg)}
    }
    #notifBellBtn.ringing i { animation:_bellRing 0.7s ease; }
    #notifBellWrap { position:relative;display:flex;align-items:center; }
    #notifBellBtn { position:relative;background:none;border:none;cursor:pointer;
      color:white;padding:5px;margin-right:2px;opacity:0.75;transition:opacity .2s;
      display:flex;align-items:center;border-radius:6px; }
    #notifBellBtn:hover,#notifBellBtn:focus-visible { opacity:1;background:rgba(255,255,255,0.12);outline:none; }
    #notifBellBtn.has-notif { opacity:1; }
    #notifBadge { position:absolute;top:1px;right:1px;background:#ef4444;color:#fff;
      font-size:9px;font-weight:800;border-radius:999px;min-width:15px;height:15px;
      padding:0 3px;line-height:15px;text-align:center;box-shadow:0 0 0 1.5px #1e3a8a;
      pointer-events:none; }
    #notifPanel { display:none;position:absolute;right:0;top:calc(100% + 12px);width:min(390px,calc(100vw - 24px));
      max-height:min(560px,calc(100vh - 92px));background:#fff;border:1px solid #e2e8f0;border-radius:16px;
      box-shadow:0 20px 55px rgba(15,23,42,.24);z-index:1000;overflow:hidden;color:#0f172a; }
    #notifPanel.open { display:flex;flex-direction:column; }
    .notif-head { display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc; }
    .notif-head-title { font-size:14px;font-weight:800;flex:1; }
    .notif-head-count { font-size:10px;font-weight:800;color:#fff;background:#1d4ed8;border-radius:999px;padding:2px 7px; }
    .notif-head-btn { border:0;background:transparent;color:#64748b;font-size:11px;font-weight:700;cursor:pointer;padding:5px 7px;border-radius:7px; }
    .notif-head-btn:hover,.notif-head-btn:focus-visible { background:#e2e8f0;color:#1e3a8a;outline:none; }
    #notifList { overflow-y:auto;overscroll-behavior:contain; }
    .notif-state { padding:30px 20px;text-align:center;color:#64748b;font-size:12px;line-height:1.6; }
    .notif-state i { display:block;margin:0 auto 8px;width:25px;height:25px;color:#94a3b8; }
    .notif-item { display:flex;gap:10px;padding:12px 14px;text-decoration:none;color:inherit;border-bottom:1px solid #f1f5f9;
      transition:background .15s;position:relative; }
    .notif-item:hover,.notif-item:focus-visible { background:#f8fafc;outline:none; }
    .notif-item.unread { background:#eff6ff; }
    .notif-item.unread:hover { background:#dbeafe; }
    .notif-dot { position:absolute;right:11px;top:12px;width:7px;height:7px;background:#2563eb;border-radius:50%; }
    .notif-icon { width:35px;height:35px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:0 0 auto; }
    .notif-icon i { width:17px;height:17px; }
    .notif-copy { min-width:0;flex:1;padding-right:8px; }
    .notif-kind { font-size:9px;line-height:1.25;font-weight:800;text-transform:uppercase;letter-spacing:.035em;margin-bottom:3px; }
    .notif-title { display:block;font-size:12px;line-height:1.35;font-weight:800;color:#1e293b;overflow-wrap:anywhere; }
    .notif-desc { display:block;font-size:11px;line-height:1.45;color:#64748b;margin-top:2px;overflow-wrap:anywhere; }
    .notif-meta { display:block;font-size:10px;line-height:1.35;color:#94a3b8;margin-top:4px; }
    .notif-foot { padding:8px 14px;background:#f8fafc;color:#94a3b8;font-size:10px;text-align:center;border-top:1px solid #e2e8f0; }
    @media (max-width:640px) {
      #notifPanel { position:fixed;right:12px;left:12px;top:68px;width:auto;max-height:calc(100vh - 84px); }
      .notif-head { padding:11px 12px; }
    }
  `;
  document.head.appendChild(s);
}

function _notifHas(permission) {
  return typeof RBAC !== 'undefined' && typeof RBAC.has === 'function' && RBAC.has(permission);
}

function _notifEscape(value) {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);
}

function _notifReadKey() {
  const u = _notifCurrentUser || getUser() || {};
  return 'rdfNotifRead:' + (u.username || u.stipNo || u.role || 'user');
}

function _notifReadMap() {
  try { return JSON.parse(localStorage.getItem(_notifReadKey()) || '{}') || {}; }
  catch (_) { return {}; }
}

function _notifSaveReadMap(map) {
  try {
    const entries = Object.entries(map).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 150);
    localStorage.setItem(_notifReadKey(), JSON.stringify(Object.fromEntries(entries)));
  } catch (_) {}
}

function _notifMarkRead(id) {
  const map = _notifReadMap();
  map[id] = Date.now();
  _notifSaveReadMap(map);
  _renderNotifPanel();
}

function _notifMarkAllRead() {
  const map = _notifReadMap();
  _notifItems.forEach(item => { map[item.id] = Date.now(); });
  _notifSaveReadMap(map);
  _renderNotifPanel();
}

function _notifStudentName(student) {
  const th = `${student.Title || student.title || ''}${student.FirstName || student.firstName || student.fname || ''} ${student.LastName || student.lastName || student.lname || ''}`.trim();
  const en = `${student.EngTitle || student.engTitle || ''} ${student.EngFirstName || student.engFirstName || student.engFname || ''} ${student.EngLastName || student.engLastName || student.engLname || ''}`.replace(/\s+/g, ' ').trim();
  return (LANG === 'en' ? (en || th) : (th || en)) || t('navNotifUnknownStudent');
}

function _notifCompletionObject(s) {
  return {
    IDCard:s.IDCard || s.idCard, Title:s.Title || s.title,
    FirstName:s.FirstName || s.firstName || s.fname, LastName:s.LastName || s.lastName || s.lname,
    BirthYear:s.BirthYear || s.birthYear, Institution:s.Institution || s.institution,
    CurrentLevel:s.CurrentLevel || s.currentLevel || s.level,
    ScholarshipYear:s.ScholarshipYear || s.scholarshipYear, EntryYear:s.EntryYear || s.entryYear,
    Sex:s.Sex || s.sex, Nationality:s.Nationality || s.nationality, Religion:s.Religion || s.religion,
    Phone1:s.Phone1 || s.phone1 || s.phone, Province:s.Province || s.province,
    Amphoe:s.Amphoe || s.amphoe, Tambon:s.Tambon || s.tambon,
    ParentStatus:s.ParentStatus || s.parentStatus,
    Parent1_FirstName:s.Parent1_FirstName || s.parent1Fname,
    Parent1_LastName:s.Parent1_LastName || s.parent1Lname,
    ProfilePicURL:s.ProfilePicURL || s.profilePicURL || s.pic,
    BankName:s.BankName || s.bankName, BankAccountNo:s.BankAccountNo || s.bankAccountNo,
  };
}

function _notifStableId(prefix, values) {
  return prefix + ':' + values.map(v => String(v ?? '').trim()).join(':');
}

function _notifItem({ id, kindKey, title, description, meta, href, icon, color, bg }) {
  return { id, kindKey, title, description, meta, href, icon, color, bg };
}

function _notifBroadcastAllowed(notification, user, ownStudent) {
  const audience = String(notification.audienceKey || 'all').trim();
  if (audience === 'all') return true;
  if (audience === 'admin') return user.role !== 'Student';
  if (user.role === 'Student') {
    const institution = ownStudent && (ownStudent.Institution || ownStudent.institution);
    return audience === institution;
  }
  return _notifHas('viewStudents');
}

function _notifBroadcastHref(link, user) {
  const page = String(link || '').trim().split(/[?#]/)[0];
  const permissionByPage = {
    'promotion.html':'viewPromotion', 'students.html':'viewStudents',
    'academic-terms.html':'viewStudents', 'settings.html':'viewSettings',
    'reports.html':'viewReports'
  };
  if (!page) return 'dashboard.html';
  if (user.role === 'Student') {
    if (page === 'students.html' || page === 'student-profile.html') {
      return user.stipNo ? `student-profile.html?stipNo=${encodeURIComponent(user.stipNo)}` : 'dashboard.html';
    }
    return page === 'dashboard.html' ? page : 'dashboard.html';
  }
  const required = permissionByPage[page];
  return !required || _notifHas(required) ? String(link) : 'dashboard.html';
}

function _buildBroadcastNotifications(user, broadcasts, ownStudent) {
  const icons = { term_start:'play-circle', term_end:'stop-circle', promotion:'trending-up', graduation:'award', exam:'pencil-ruler', general:'megaphone' };
  const colors = { term_start:'#15803d', term_end:'#dc2626', promotion:'#7c3aed', graduation:'#b45309', exam:'#c2410c', general:'#1d4ed8' };
  const backgrounds = { term_start:'#f0fdf4', term_end:'#fef2f2', promotion:'#f5f3ff', graduation:'#fffbeb', exam:'#fff7ed', general:'#eff6ff' };
  return [...broadcasts]
    .filter(n => _notifBroadcastAllowed(n, user, ownStudent))
    .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0))
    .slice(0, 20)
    .map(n => {
      const title = LANG === 'en' ? (n.titleEN || n.titleTH) : (n.titleTH || n.titleEN);
      const description = LANG === 'en' ? (n.bodyEN || n.bodyTH) : (n.bodyTH || n.bodyEN);
      const sentAt = n.sentAt ? new Date(n.sentAt) : null;
      const validDate = sentAt && !Number.isNaN(sentAt.getTime());
      const meta = [validDate ? sentAt.toLocaleString(typeof getLocale === 'function' ? getLocale() : undefined, { dateStyle:'short', timeStyle:'short' }) : '', n.sentBy ? `${t('navNotifFrom')} ${n.sentBy}` : ''].filter(Boolean).join(' • ');
      const type = n.type || 'general';
      return _notifItem({
        id:_notifStableId('broadcast',[n.id || n.sentAt || title]),
        kindKey:'navNotifAnnouncementTitle', title:title || t('navNotifAnnouncementTitle'),
        description:description || t('navNotifAnnouncementDesc'), meta,
        href:_notifBroadcastHref(n.link, user), icon:icons[type] || 'megaphone',
        color:colors[type] || '#1d4ed8', bg:backgrounds[type] || '#eff6ff'
      });
    });
}

function _buildStaffNotifications(user, pending, students) {
  const items = [];
  const canApprove = _notifHas('viewPromotion') && _notifHas('viewSchApprovalPanel');
  const canViewStudents = _notifHas('viewStudents');
  const canEditStudents = _notifHas('editStudents');
  const pendingIds = new Set();

  if (canApprove) {
    pending.forEach(p => {
      const stipNo = p.StipNo || p.stipNo || '';
      pendingIds.add(String(stipNo));
      const university = LANG === 'en'
        ? (p.UniNameEN || p.uniNameEN || p.UniName || p.uniName)
        : (p.UniName || p.uniName || p.UniNameEN || p.uniNameEN);
      const details = [university, p.PromotionNotes || p.promotionNotes].filter(Boolean).join(' • ');
      const priority = p.SchPriority || p.schPriority;
      const year = p.ScholarshipYear || p.scholarshipYear;
      const meta = [stipNo, priority ? `${t('navNotifPriority')} ${priority}` : '', year ? `${t('navNotifScholarshipYear')} ${year}` : ''].filter(Boolean).join(' • ');
      items.push(_notifItem({
        id:_notifStableId('approval',[stipNo,p.UpdatedAt || p.updatedAt || p.SchApprovalStatus || 'Pending']),
        kindKey:'navNotifApprovalTitle', title:_notifStudentName(p),
        description:details || t('navNotifApprovalDesc'), meta,
        href:`promotion.html?stipNo=${encodeURIComponent(stipNo)}#schApproval`, icon:'shield-alert', color:'#7c3aed', bg:'#f5f3ff'
      }));
    });

    students.filter(s =>
      s.status === 'Graduated' && s.uniName &&
      String(s.uniScholarship || '').toLowerCase() !== 'no' &&
      !pendingIds.has(String(s.stipNo || ''))
    ).forEach(s => {
      const stipNo = s.stipNo || '';
      const meta = [stipNo, s.schPriority ? `${t('navNotifPriority')} ${s.schPriority}` : ''].filter(Boolean).join(' • ');
      items.push(_notifItem({
        id:_notifStableId('university',[stipNo,s.uniName,s.uniScholarship]),
        kindKey:'navNotifUniversityTitle', title:_notifStudentName(s),
        description:s.uniName || t('navNotifUniversityDesc'), meta,
        href:`promotion.html?stipNo=${encodeURIComponent(stipNo)}#schApproval`, icon:'graduation-cap', color:'#b45309', bg:'#fffbeb'
      }));
    });
  }

  if (canViewStudents) {
    students.filter(s => s.status === 'Suspended').forEach(s => {
      const stipNo = s.stipNo || '';
      const detail = [s.institution, typeof formatLevel === 'function' ? formatLevel(s.level) : s.level].filter(Boolean).join(' • ');
      items.push(_notifItem({
        id:_notifStableId('suspended',[stipNo,s.status]),
        kindKey:'navNotifSuspendedTitle', title:_notifStudentName(s),
        description:detail || t('navNotifSuspendedDesc'), meta:stipNo,
        href:`student-profile.html?stipNo=${encodeURIComponent(stipNo)}`, icon:'pause-circle', color:'#c2410c', bg:'#fff7ed'
      }));
    });
  }

  if (canEditStudents && typeof calcProfileCompletion === 'function') {
    const incomplete = students.filter(s => s.status === 'Active')
      .map(s => ({ student:s, pct:calcProfileCompletion(_notifCompletionObject(s)).pct }))
      .filter(x => x.pct < 80);
    if (incomplete.length) {
      const examples = incomplete.slice(0, 3).map(x => `${_notifStudentName(x.student)} (${x.pct}%)`).join(', ');
      items.push(_notifItem({
        id:_notifStableId('incomplete',[incomplete.length,incomplete.map(x => x.student.stipNo).sort().join(',')]),
        kindKey:'navNotifIncompleteTitle', title:`${incomplete.length} ${t('navNotifPeople')}`,
        description:examples, meta:t('navNotifIncompleteDesc'),
        href:'students.html?incomplete=1', icon:'user-round-pen', color:'#dc2626', bg:'#fef2f2'
      }));
    }
  }
  return items;
}

function _buildStudentNotifications(user, student) {
  if (!student) return [];
  const items = [];
  const stipNo = user.stipNo || student.StipNo || student.stipNo || '';
  const status = student.Status || student.status || '';
  const profileHref = `student-profile.html?stipNo=${encodeURIComponent(stipNo)}`;
  if (status === 'Suspended') {
    items.push(_notifItem({
      id:_notifStableId('own-status',[stipNo,status]), kindKey:'navNotifOwnStatusTitle',
      title:t('navNotifSuspendedDesc'), description:t('navNotifOwnStatusDesc'), meta:stipNo,
      href:profileHref, icon:'pause-circle', color:'#c2410c', bg:'#fff7ed'
    }));
  }
  if (_notifHas('editOwnProfile') && typeof calcProfileCompletion === 'function') {
    const completion = calcProfileCompletion(_notifCompletionObject(student));
    if (completion.pct < 80) {
      const missing = completion.sections.filter(section => section.missing.length)
        .slice(0, 3).map(section => LANG === 'en' ? section.label_en : section.label_th).join(', ');
      items.push(_notifItem({
        id:_notifStableId('own-profile',[stipNo,completion.pct]), kindKey:'navNotifOwnProfileTitle',
        title:`${t('navNotifProfileComplete')} ${completion.pct}%`, description:missing || t('navNotifOwnProfileDesc'), meta:stipNo,
        href:`student-form.html?stipNo=${encodeURIComponent(stipNo)}`, icon:'user-round-pen', color:'#2563eb', bg:'#eff6ff'
      }));
    }
  }
  return items;
}

function _rebuildNotifItems() {
  if (!_notifSource) return;
  const taskItems = _notifSource.isStudent
    ? _buildStudentNotifications(_notifSource.user, _notifSource.ownStudent)
    : _buildStaffNotifications(_notifSource.user, _notifSource.pending, _notifSource.students);
  _notifItems = [
    ..._buildBroadcastNotifications(_notifSource.user, _notifSource.broadcasts || [], _notifSource.ownStudent),
    ...taskItems,
  ];
}

function _setSystemNotifications(notifications) {
  if (!_notifSource) return;
  _notifSource.broadcasts = Array.isArray(notifications) ? notifications : [];
  _rebuildNotifItems();
  _renderNotifPanel();
}

function _renderNotifPanel() {
  const list = document.getElementById('notifList');
  const badge = document.getElementById('notifBadge');
  const btn = document.getElementById('notifBellBtn');
  const count = document.getElementById('notifPanelCount');
  const markAll = document.getElementById('notifMarkAllBtn');
  if (!list || !badge || !btn) return;
  const read = _notifReadMap();
  const unread = _notifItems.filter(item => !read[item.id]).length;
  badge.textContent = unread > 99 ? '99+' : (unread || '');
  badge.style.display = unread ? 'inline-block' : 'none';
  btn.classList.toggle('has-notif', unread > 0);
  if (count) count.textContent = String(_notifItems.length);
  if (markAll) markAll.style.display = unread ? '' : 'none';

  if (!_notifLoaded) {
    list.innerHTML = `<div class="notif-state"><i data-lucide="loader-circle"></i><span data-t="navNotifLoading">${_notifEscape(t('navNotifLoading'))}</span></div>`;
  } else if (_notifLoadFailed && !_notifItems.length) {
    list.innerHTML = `<div class="notif-state"><i data-lucide="wifi-off"></i><span data-t="navNotifLoadError">${_notifEscape(t('navNotifLoadError'))}</span></div>`;
  } else if (!_notifItems.length) {
    list.innerHTML = `<div class="notif-state"><i data-lucide="bell-off"></i><span data-t="navNotifEmpty">${_notifEscape(t('navNotifEmpty'))}</span></div>`;
  } else {
    list.innerHTML = _notifItems.map(item => {
      const isUnread = !read[item.id];
      return `<a class="notif-item${isUnread ? ' unread' : ''}" href="${_notifEscape(item.href)}" data-notif-id="${_notifEscape(item.id)}">
        ${isUnread ? '<span class="notif-dot"></span>' : ''}
        <span class="notif-icon" style="background:${item.bg};color:${item.color}"><i data-lucide="${item.icon}"></i></span>
        <span class="notif-copy">
          <span class="notif-kind" style="color:${item.color}">${_notifEscape(t(item.kindKey))}</span>
          <span class="notif-title">${_notifEscape(item.title)}</span>
          <span class="notif-desc">${_notifEscape(item.description)}</span>
          ${item.meta ? `<span class="notif-meta">${_notifEscape(item.meta)}</span>` : ''}
        </span>
      </a>`;
    }).join('');
    list.querySelectorAll('[data-notif-id]').forEach(link => {
      link.addEventListener('click', () => _notifMarkRead(link.getAttribute('data-notif-id')));
    });
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _toggleNotifPanel(force) {
  const panel = document.getElementById('notifPanel');
  const btn = document.getElementById('notifBellBtn');
  if (!panel || !btn) return;
  const open = typeof force === 'boolean' ? force : !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  btn.setAttribute('aria-expanded', String(open));
  if (open && !_notifLoaded) _refreshNotifBell();
}

async function _initNotifBell(user) {
  if (!user) return;
  _notifCurrentUser = user;
  if (document.getElementById('notifBellBtn')) return;
  _injectNotifStyles();
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  const wrap = document.createElement('div');
  wrap.id = 'notifBellWrap';
  wrap.innerHTML = `
    <button id="notifBellBtn" type="button" data-t-title="navNotifTitle" data-t-aria-label="navNotifTitle"
      title="${_notifEscape(t('navNotifTitle'))}" aria-label="${_notifEscape(t('navNotifTitle'))}" aria-expanded="false" aria-controls="notifPanel">
      <i data-lucide="bell" style="width:20px;height:20px;display:block"></i><span id="notifBadge" style="display:none"></span>
    </button>
    <section id="notifPanel" data-t-aria-label="navNotifTitle" aria-label="${_notifEscape(t('navNotifTitle'))}">
      <div class="notif-head">
        <i data-lucide="bell" style="width:16px;height:16px;color:#1d4ed8"></i>
        <span class="notif-head-title" data-t="navNotifTitle">${_notifEscape(t('navNotifTitle'))}</span>
        <span id="notifPanelCount" class="notif-head-count">0</span>
        <button id="notifMarkAllBtn" class="notif-head-btn" type="button" data-t="navNotifMarkAll">${_notifEscape(t('navNotifMarkAll'))}</button>
        <button id="notifRefreshBtn" class="notif-head-btn" type="button" data-t-title="navNotifRefresh" data-t-aria-label="navNotifRefresh" title="${_notifEscape(t('navNotifRefresh'))}">
          <i data-lucide="refresh-cw" style="width:14px;height:14px"></i>
        </button>
      </div>
      <div id="notifList"><div class="notif-state"><i data-lucide="loader-circle"></i><span data-t="navNotifLoading">${_notifEscape(t('navNotifLoading'))}</span></div></div>
      <div class="notif-foot" data-t="navNotifPermissionNote">${_notifEscape(t('navNotifPermissionNote'))}</div>
    </section>`;

  const userWrap = document.getElementById('navUserWrap');
  navRight.insertBefore(wrap, userWrap);
  const bellBtn = document.getElementById('notifBellBtn');
  bellBtn.addEventListener('click', event => { event.stopPropagation(); _toggleNotifPanel(); });
  document.getElementById('notifPanel').addEventListener('click', event => event.stopPropagation());
  document.getElementById('notifRefreshBtn').addEventListener('click', () => {
    if (typeof _invalidateApiGetCache === 'function') _invalidateApiGetCache();
    _refreshNotifBell(true);
  });
  document.getElementById('notifMarkAllBtn').addEventListener('click', _notifMarkAllRead);
  document.addEventListener('click', () => _toggleNotifPanel(false));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') _toggleNotifPanel(false); });
  document.addEventListener('rdf:languagechange', () => {
    if (_notifLoaded) _rebuildNotifItems();
    _renderNotifPanel();
  });
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Notification counts are useful but should not compete with the first
  // dashboard/stat request. Start them after the initial page has painted.
  if ('requestIdleCallback' in window) {
    requestIdleCallback(_refreshNotifBell, { timeout: 4000 });
  } else {
    setTimeout(_refreshNotifBell, 1500);
  }
  setInterval(_refreshNotifBell, 5 * 60 * 1000); // re-check every 5 min
}

async function _refreshNotifBell(force = false) {
  if (!document.getElementById('notifBellBtn') || typeof API === 'undefined') return;
  if (_notifRefreshPromise) {
    return force ? _notifRefreshPromise.then(() => _refreshNotifBell(false)) : _notifRefreshPromise;
  }
  const run = async () => {
    const user = getUser();
    if (!user) return;
    _notifCurrentUser = user;
    if (!_notifLoaded) _renderNotifPanel();
    const isStudent = user.role === 'Student' && !!user.stipNo;
    const canApprove = _notifHas('viewPromotion') && _notifHas('viewSchApprovalPanel');
    const needsStudents = !isStudent && (_notifHas('viewStudents') || _notifHas('editStudents') || canApprove);
    const requests = [];
    const slots = [];
    slots.push('settings'); requests.push(API.getSystemSettings());
    if (canApprove) { slots.push('pending'); requests.push(API.get('getPendingScholarshipRequests')); }
    if (needsStudents) { slots.push('students'); requests.push(API.getStudents()); }
    if (isStudent) { slots.push('student'); requests.push(API.getStudent(user.stipNo)); }
    const results = await Promise.allSettled(requests);
    let pending = [], students = [], ownStudent = null, broadcasts = [], successes = 0;
    results.forEach((result, index) => {
      if (result.status !== 'fulfilled' || !result.value || result.value.status !== 'success') return;
      successes++;
      const slot = slots[index];
      if (slot === 'pending') pending = result.value.pending || result.value.students || result.value.data || [];
      if (slot === 'students') students = result.value.data || result.value.students || [];
      if (slot === 'student') ownStudent = result.value.data || result.value.student || null;
      if (slot === 'settings') {
        const settings = result.value.data || {};
        broadcasts = Array.isArray(settings.NOTIFICATIONS) ? settings.NOTIFICATIONS : [];
      }
    });
    _notifSource = { user, isStudent, pending, students, ownStudent, broadcasts };
    _rebuildNotifItems();
    _notifLoadFailed = requests.length > 0 && successes === 0;
    _notifLoaded = true;
    _renderNotifPanel();
    const unread = _notifItems.filter(item => !_notifReadMap()[item.id]).length;
    const btn = document.getElementById('notifBellBtn');
    if (unread && btn) {
      btn.classList.add('ringing');
      setTimeout(() => btn.classList.remove('ringing'), 800);
    }
  };
  _notifRefreshPromise = run().catch(() => {
    _notifLoadFailed = true; _notifLoaded = true; _renderNotifPanel();
  }).finally(() => { _notifRefreshPromise = null; });
  return _notifRefreshPromise;
}

async function handleLogin() {
  const id   = document.getElementById('loginId').value.trim();
  const pass = document.getElementById('loginPass').value.trim();
  const role = document.getElementById('loginRole').value;
  if (!id || !pass) { Swal.fire(t('warning'), t('fillRequired'), 'warning'); return; }
  showLoader(true, t('connecting'));
  try {
    // POST login so password never appears in URL / server logs
    const _ctrl  = new AbortController();
    const _timer = setTimeout(() => _ctrl.abort(), 45000);
    let res;
    try {
      res = await fetch(RDF.GAS_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'login', id, pass, role }),
        headers: { 'Content-Type': 'text/plain' },
        signal: _ctrl.signal
      });
    } finally { clearTimeout(_timer); }
    const result = await res.json();
    if (result && typeof result.message === 'string') {
      result.rawMessage = result.message;
      result.message = localizeApiMessage(result.message, 'loginFailed');
    }
    showLoader(false);
    if (result.status === 'success') {
      setUser({
        name: result.name, role: result.role,
        stipNo: result.stipNo || '', pic: result.pic || '',
        username: id, loginTime: Date.now(),
        loginCount: result.loginCount || 0,
        lastLogin: result.lastLogin || '',
        sessionToken: result.sessionToken || ''
      });
      if (result.duplicateSession) {
        await Swal.fire({
          icon: 'warning', title: t('warning'),
          text: t('duplicateLogin'), confirmButtonText: t('confirm')
        });
      }
      window.location.href = 'dashboard.html';
    } else {
      Swal.fire(t('error'), result.message || t('loginFailed'), 'error');
    }
  } catch (e) {
    showLoader(false);
    const msg = e.name === 'AbortError' ? t('connectionTimeout') : (t('network_error') || e.message);
    Swal.fire(t('error'), msg, 'error');
  }
}

async function handleGoogleLogin(idToken) {
  showLoader(true, t('googleChecking'));
  try {
    const result = await API.loginWithGoogle(idToken);
    showLoader(false);
    if (result.status === 'success') {
      setUser({
        name:         result.name,
        role:         result.role,
        stipNo:       result.stipNo       || '',
        pic:          result.pic          || '',
        username:     result.username     || result.email || '',
        loginTime:    Date.now(),
        loginCount:   result.loginCount   || 0,
        lastLogin:    result.lastLogin    || '',
        authMethod:   'google',
        sessionToken: result.sessionToken || ''
      });
      if (result.duplicateSession) {
        await Swal.fire({
          icon: 'warning',
          title: t('warning'),
          text: t('duplicateLogin'),
          confirmButtonText: t('confirm')
        });
      }
      window.location.href = 'dashboard.html';
    } else {
      Swal.fire(t('error'), result.message || t('loginFailed'), 'error');
    }
  } catch (e) {
    showLoader(false);
    Swal.fire(t('error'), t('network_error'), 'error');
  }
}

function logout() {
  Swal.fire({
    title: t('logoutConfirm'), icon: 'question', showCancelButton: true,
    confirmButtonText: t('yes'), cancelButtonText: t('cancel'),
    confirmButtonColor: '#1e3a8a'
  }).then(r => {
    if (r.isConfirmed) {
      const u = getUser();
      if (u && typeof API !== 'undefined') {
        const token = u.sessionToken || '';
        if (u.username) API.clearSession(u.username).catch(() => {});
        if (token) API.post('logoutToken', { token }).catch(() => {});
      }
      clearUser();
      window.location.href = 'index.html';
    }
  });
}

// Show session-expired message on login page
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('expired') === '1' && document.getElementById('loginId')) {
    setTimeout(() => Swal.fire({ icon:'warning', title: t('warning'), text: t('sessionExpired'), timer:3000, showConfirmButton:false }), 300);
  }
});
