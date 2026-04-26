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
