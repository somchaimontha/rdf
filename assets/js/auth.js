/* ── RDF Auth & Session ── */

const SESSION_TTL = 5 * 60 * 60 * 1000; // 5 hours in ms

function getUser() {
  try { return JSON.parse(localStorage.getItem('rdfUser')); } catch { return null; }
}
function setUser(data) { localStorage.setItem('rdfUser', JSON.stringify(data)); }
function clearUser() { localStorage.removeItem('rdfUser'); }

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
  if (pic) pic.src = user.pic || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1e3a8a&color=fff&bold=true&size=64`;
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
    const res = await fetch(`${RDF.GAS_URL}?action=login&id=${encodeURIComponent(id)}&pass=${encodeURIComponent(pass)}&role=${role}`);
    const result = await res.json();
    showLoader(false);
    if (result.status === 'success') {
      const loginTime = Date.now();
      setUser({
        name: result.name, role: result.role,
        stipNo: result.stipNo || '', pic: result.pic || '',
        username: id, loginTime,
        loginCount: result.loginCount || 0,
        lastLogin: result.lastLogin || ''
      });
      // Warn if duplicate session detected (same username already logged in)
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
      if (u && u.username && typeof API !== 'undefined') {
        // Best-effort: notify server of logout (don't await)
        API.clearSession(u.username).catch(() => {});
      }
      clearUser(); window.location.href = 'index.html';
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
