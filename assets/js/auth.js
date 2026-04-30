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

// ── Notification Bell (approval requests) ────────────────────────────────────
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
    #notifBellBtn { position:relative;background:none;border:none;cursor:pointer;
      color:white;padding:5px;margin-right:2px;opacity:0.75;transition:opacity .2s;
      display:flex;align-items:center;border-radius:6px; }
    #notifBellBtn:hover { opacity:1;background:rgba(255,255,255,0.12); }
    #notifBellBtn.has-notif { opacity:1; }
    #notifBadge { position:absolute;top:1px;right:1px;background:#ef4444;color:#fff;
      font-size:9px;font-weight:800;border-radius:999px;min-width:15px;height:15px;
      padding:0 3px;line-height:15px;text-align:center;box-shadow:0 0 0 1.5px #1e3a8a;
      pointer-events:none; }
  `;
  document.head.appendChild(s);
}

async function _initNotifBell(user) {
  if (!user || !['Manager', 'SuperAdmin'].includes(user.role)) return;
  if (document.getElementById('notifBellBtn')) return; // already injected
  _injectNotifStyles();
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  const btn = document.createElement('button');
  btn.id = 'notifBellBtn';
  btn.title = 'คำขออนุมัติทุนมหาวิทยาลัย (RDF)';
  btn.onclick = () => { window.location.href = 'promotion.html'; };
  btn.innerHTML = `<i data-lucide="bell" style="width:20px;height:20px;display:block"></i>
    <span id="notifBadge" style="display:none"></span>`;

  const userWrap = document.getElementById('navUserWrap');
  navRight.insertBefore(btn, userWrap);
  if (typeof lucide !== 'undefined') lucide.createIcons({ elements: [btn] });

  await _refreshNotifBell();
  setInterval(_refreshNotifBell, 5 * 60 * 1000); // re-check every 5 min
}

async function _refreshNotifBell() {
  const badge = document.getElementById('notifBadge');
  const btn   = document.getElementById('notifBellBtn');
  if (!badge || !btn) return;
  try {
    const [schRes, stuRes] = await Promise.allSettled([
      API.get('getPendingScholarshipRequests'),
      API.getStudents(),
    ]);
    let count = 0;
    const existing = new Set();
    if (schRes.status === 'fulfilled') {
      (schRes.value.pending || []).forEach(p => { existing.add(p.StipNo); count++; });
    }
    if (stuRes.status === 'fulfilled' && stuRes.value.status === 'success') {
      count += (stuRes.value.data || []).filter(s =>
        s.status === 'Graduated' && s.uniName &&
        (s.uniScholarship || '').toLowerCase() !== 'no' &&
        !existing.has(s.stipNo)
      ).length;
    }
    badge.textContent = count > 99 ? '99+' : (count || '');
    badge.style.display = count > 0 ? 'inline-block' : 'none';
    btn.classList.toggle('has-notif', count > 0);
    if (count > 0) {
      btn.classList.add('ringing');
      setTimeout(() => btn.classList.remove('ringing'), 800);
    }
  } catch(e) {}
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
    const msg = e.name === 'AbortError' ? 'การเชื่อมต่อหมดเวลา กรุณาลองใหม่' : (t('network_error') || e.message);
    Swal.fire(t('error'), msg, 'error');
  }
}

async function handleGoogleLogin(idToken) {
  showLoader(true, 'กำลังตรวจสอบบัญชี Google...');
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
