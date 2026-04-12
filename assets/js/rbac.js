/**
 * RDF Role-Based Access Control (RBAC)
 * ════════════════════════════════════════════════════════════
 * Single source of truth for all permission checks across the app.
 *
 * HOW IT WORKS:
 *  1. On login, user.role is stored in localStorage via setUser().
 *  2. Every protected page calls RBAC.enforcePage(['perm',...]) at init.
 *  3. UI elements use RBAC.has('perm') / RBAC.isStudent() to show/hide.
 *  4. student-form.html calls RBAC.applyFieldGuards() for field-level locks.
 *  5. Admin-configurable student editable fields are cached in localStorage
 *     under 'rdfStudentEditableFields' and refreshed from system settings.
 *
 * PERMISSION KEYS:
 *  viewStudents      — view the student list page (students.html)
 *  editStudents      — add / edit student records
 *  deleteStudents    — delete student records
 *  importStudents    — CSV import
 *  viewPromotion     — access promotion.html
 *  runPromotion      — execute batch promotions
 *  viewSettings      — access settings.html
 *  editSettings      — modify system settings (SuperAdmin only)
 *  viewReports       — view & export reports
 *  exportData        — Excel / PDF export
 *  printProfile      — print student profile
 *  viewOwnProfile    — Student: view own profile
 *  editOwnProfile    — Student: edit own permitted fields
 *
 * ROLES: SuperAdmin | Manager | Finance | Committee | DormTeacher | Student
 */

// ─────────────────────────────────────────────
// PERMISSION MAP — DEFAULT (hardcoded fallback)
// Admin can override via settings.html → Roles tab → Permission Matrix.
// Overrides are saved to Google Sheets as 'RBAC_PERMISSIONS' and cached
// in localStorage as 'rdfRbacPermissions'.
// SuperAdmin is always '*' (cannot be overridden).
// Student is always fixed (cannot be overridden — security).
// '*' = all permissions granted.
// ─────────────────────────────────────────────
const RBAC_MAP = {
  SuperAdmin:  ['*'],
  Manager:     ['viewStudents','editStudents','deleteStudents','importStudents',
                'viewPromotion','runPromotion',
                'viewSettings',
                'viewReports','exportData','printProfile'],
  Finance:     ['viewStudents','viewReports','exportData','printProfile'],
  Committee:   ['viewStudents','viewReports','printProfile'],
  DormTeacher: ['viewStudents','editStudents','printProfile'],
  Student:     ['viewOwnProfile','editOwnProfile'],
};

// Dynamic map loaded from settings (null = use RBAC_MAP defaults above)
let _rbacDynamicMap = null;

// Load cached permissions from localStorage at script initialisation
(function _rbacInitCache() {
  try {
    const cached = JSON.parse(localStorage.getItem('rdfRbacPermissions') || 'null');
    if (cached && typeof cached === 'object') _rbacDynamicMap = cached;
  } catch { /* ignore — will fall back to RBAC_MAP */ }
})();

// ─────────────────────────────────────────────
// FIELDS: student-form.html field-level control
// ─────────────────────────────────────────────

// These fields are ALWAYS read-only for Students — cannot be overridden by admin
// Only รหัสทุน (StipNo) is unconditionally locked.
// All other academic/identity fields are now admin-configurable via settings.html → สิทธิ์ผู้ใช้
const STUDENT_PROTECTED_FIELDS = new Set([
  'f_stipNo',
]);

// Default editable fields for Students (admin can change in settings)
const STUDENT_EDITABLE_DEFAULTS = [
  'f_phone1','f_phone2','f_email',
  'f_village','f_houseNo','f_moo','f_tambon','f_amphoe','f_province',
  'f_fatherFname','f_fatherLname','f_motherFname','f_motherLname',
  'f_profilePicUrl','f_picUrl',
];

// ─────────────────────────────────────────────
// RBAC OBJECT
// ─────────────────────────────────────────────
const RBAC = {

  // ── Core checks ──────────────────────────────

  /** Returns true if current user has the given permission key.
   *  Uses dynamic map (from settings) when available; falls back to RBAC_MAP. */
  has(perm) {
    const user = (typeof getUser === 'function') ? getUser() : null;
    if (!user) return false;
    // SuperAdmin and Student are always fixed — never affected by dynamic map
    if (user.role === 'SuperAdmin') return true;
    if (user.role === 'Student') {
      return ['viewOwnProfile','editOwnProfile'].includes(perm);
    }
    // Use admin-configured permissions if available, else fall back to defaults
    const map   = _rbacDynamicMap || RBAC_MAP;
    const perms = map[user.role] || RBAC_MAP[user.role] || [];
    return perms.includes('*') || perms.includes(perm);
  },

  /** True if current user is any staff/admin role (not Student). */
  isAdmin() {
    const user = (typeof getUser === 'function') ? getUser() : null;
    return !!(user && user.role !== 'Student');
  },

  /** True if current user is a Student. */
  isStudent() {
    const user = (typeof getUser === 'function') ? getUser() : null;
    return !!(user && user.role === 'Student');
  },

  /** True only for SuperAdmin. */
  isSuperAdmin() {
    const user = (typeof getUser === 'function') ? getUser() : null;
    return !!(user && user.role === 'SuperAdmin');
  },

  // ── Page guard ───────────────────────────────

  /**
   * Call at the top of each page's inline <script>.
   * requiredPerms: array of permission keys — user needs ANY one to proceed.
   * Special cases handled:
   *   - Student accessing students.html → redirected to own profile
   *   - No permission → access-denied dialog → redirect to dashboard
   * Returns true if access is granted, false otherwise.
   */
  enforcePage(requiredPerms) {
    requiredPerms = Array.isArray(requiredPerms) ? requiredPerms : [requiredPerms];
    const user = (typeof getUser === 'function') ? getUser() : null;

    if (!user) {
      window.location.href = 'index.html';
      return false;
    }

    // Student trying to access students list → redirect to own profile
    if (user.role === 'Student' && window.location.pathname.includes('students.html')) {
      const dest = user.stipNo
        ? 'student-profile.html?stipNo=' + encodeURIComponent(user.stipNo)
        : 'dashboard.html';
      window.location.href = dest;
      return false;
    }

    // Check permissions
    const granted = requiredPerms.some(p => this.has(p));
    if (!granted) {
      this._showAccessDenied(user);
      return false;
    }
    return true;
  },

  /** Show SweetAlert access-denied message then redirect to dashboard. */
  _showAccessDenied(user) {
    const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
    const title = isEN ? 'Access Denied' : 'ไม่มีสิทธิ์เข้าถึง';
    const body  = isEN
      ? `Your role (${user?.role || '—'}) does not have permission to access this page.`
      : `บัญชีของคุณ (${user?.role || '—'}) ไม่มีสิทธิ์เข้าถึงหน้านี้`;
    const btnTxt = isEN ? 'Go to Dashboard' : 'กลับหน้าหลัก';

    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'error', title, text: body,
        confirmButtonColor: '#1e3a8a', confirmButtonText: btnTxt,
        allowOutsideClick: false, allowEscapeKey: false,
      }).then(() => { window.location.href = 'dashboard.html'; });
    } else {
      alert(body);
      window.location.href = 'dashboard.html';
    }
  },

  // ── Student editable fields ───────────────────

  /**
   * Get fields students are allowed to edit.
   * Reads from localStorage cache populated by cacheStudentFields().
   */
  getStudentEditableFields() {
    try {
      const cached = JSON.parse(localStorage.getItem('rdfStudentEditableFields') || 'null');
      return Array.isArray(cached) && cached.length > 0 ? cached : [...STUDENT_EDITABLE_DEFAULTS];
    } catch {
      return [...STUDENT_EDITABLE_DEFAULTS];
    }
  },

  /**
   * Cache student editable fields from system settings into localStorage.
   * Call this after any getSystemSettings() call (e.g., in loadPage/loadStats).
   */
  cacheStudentFields(settings) {
    if (settings && Array.isArray(settings.STUDENT_EDITABLE_FIELDS)) {
      localStorage.setItem(
        'rdfStudentEditableFields',
        JSON.stringify(settings.STUDENT_EDITABLE_FIELDS)
      );
    }
  },

  /**
   * Cache RBAC permissions from system settings into localStorage.
   * Saved by settings.html as 'RBAC_PERMISSIONS'.
   * Call this after any getSystemSettings() so all pages get the latest rules.
   * SuperAdmin and Student entries in the saved map are ignored (always fixed).
   */
  cachePermissions(settings) {
    if (!settings || !settings.RBAC_PERMISSIONS) return;
    const saved = settings.RBAC_PERMISSIONS;
    if (typeof saved !== 'object') return;
    // Merge: keep defaults for SuperAdmin/Student; use saved for others
    const merged = { ...RBAC_MAP, ...saved };
    merged.SuperAdmin = ['*'];                              // always locked
    merged.Student    = ['viewOwnProfile','editOwnProfile']; // always locked
    _rbacDynamicMap = merged;
    localStorage.setItem('rdfRbacPermissions', JSON.stringify(merged));
  },

  /**
   * Returns the effective permission map (dynamic if loaded, else defaults).
   * Used by settings.html to pre-fill the editable matrix.
   */
  getEffectiveMap() {
    return _rbacDynamicMap || { ...RBAC_MAP };
  },

  /** Default (hardcoded) permission map — used for "Reset to Default" button. */
  getDefaultMap() { return { ...RBAC_MAP }; },

  // ── Field-level control (student-form.html) ───

  /**
   * Lock form fields for Student role.
   * Protected fields (STUDENT_PROTECTED_FIELDS) are ALWAYS locked.
   * All other fields are locked unless in the editable list.
   * Call after the form is fully rendered.
   */
  applyFieldGuards() {
    if (!this.isStudent()) return; // admins: no field restrictions

    const editableFields = new Set(this.getStudentEditableFields());

    // ── Grade section guard ──────────────────────────────────
    // 'f_gradeEdit' controls whether student can see/use the grade entry section.
    const canEditGrades = editableFields.has('f_gradeEdit');
    const gradeSection  = document.getElementById('sectionGrades');
    if (gradeSection) {
      if (canEditGrades) {
        // Show section but make it read-only: hide add/delete controls
        gradeSection.querySelectorAll(
          '#ng_year,#ng_sem,#ng_gpa,#ng_notes,button[onclick="addGradeRow()"],button[onclick="saveGradesFromForm()"]'
        ).forEach(el => {
          el.disabled = true;
          el.style.opacity = '0.4';
          el.style.cursor  = 'not-allowed';
          el.title = 'นักเรียนสามารถดูผลการเรียนได้ แต่ไม่สามารถแก้ไขได้';
        });
        // Hide delete buttons within grade table
        gradeSection.querySelectorAll('button[onclick*="removeGradeRow"]').forEach(el => {
          el.style.display = 'none';
        });
        // Add read-only badge to section header
        const hdr = gradeSection.querySelector('.form-section-header');
        if (hdr && !hdr.querySelector('.grade-readonly-badge')) {
          const badge = document.createElement('span');
          badge.className = 'grade-readonly-badge';
          badge.style.cssText = 'background:rgba(255,255,255,.2);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:6px;padding:2px 10px;font-size:11px;font-weight:700;margin-left:auto';
          const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
          badge.textContent = isEN ? 'View Only' : 'ดูได้เท่านั้น';
          hdr.appendChild(badge);
        }
      } else {
        // Hide grade section entirely
        gradeSection.style.display = 'none';
      }
    }

    // Lock/unlock all form inputs/selects/textareas (idempotent — safe to call multiple times)
    document.querySelectorAll(
      'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]),' +
      'select, textarea'
    ).forEach(el => {
      const fid = el.id || '';
      if (['ng_year','ng_sem','ng_gpa','ng_notes'].includes(fid)) return; // handled above
      const isProtected = STUDENT_PROTECTED_FIELDS.has(fid);
      const isEditable  = editableFields.has(fid) && !isProtected;

      if (isProtected || !isEditable) {
        _rbacLockField(el, isProtected);
      } else {
        _rbacUnlockField(el);
      }
    });

    // Checkboxes
    document.querySelectorAll('input[type=checkbox]').forEach(el => {
      if (STUDENT_PROTECTED_FIELDS.has(el.id) || !editableFields.has(el.id)) {
        _rbacLockField(el, true);
      } else {
        _rbacUnlockField(el);
      }
    });

    // StipNo special tooltip
    const stipEl = document.getElementById('f_stipNo');
    if (stipEl) {
      const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
      stipEl.title = isEN
        ? 'Scholarship ID cannot be changed. Contact admin if needed.'
        : 'รหัสทุนไม่สามารถแก้ไขได้ หากต้องการเปลี่ยนแปลงกรุณาติดต่อเจ้าหน้าที่';
    }

    // Remove admin-only UI elements
    document.querySelectorAll('[data-admin-only]').forEach(el => el.remove());
    document.querySelectorAll('[data-student-hidden]').forEach(el => el.remove());

    // Show student notice banner
    _rbacShowStudentFormNotice();
  },

  /**
   * Check if current student is allowed to edit their grades.
   * Used by student-form.html to conditionally enable grade add/delete controls.
   * Always returns true for admin roles.
   */
  canStudentEditGrades() {
    if (!this.isStudent()) return true; // admins: always allowed
    return this.getStudentEditableFields().includes('f_gradeEdit');
  },

  // ── Dashboard UI control ──────────────────────

  /**
   * Adjust dashboard menu cards and stats based on role.
   * Call after requireAuth() and renderNavUser() in dashboard.html.
   */
  applyDashboardUI(user) {
    if (!user) return;
    const isStudent  = user.role === 'Student';
    const canPromo   = this.has('viewPromotion');
    const canSettings = this.has('editSettings') || this.has('viewSettings');

    if (isStudent) {
      // Hide all admin menu cards
      document.querySelectorAll('.menu-card').forEach(c => { c.style.display = 'none'; });

      // Disable stat card clicks (students can't browse student list)
      document.querySelectorAll('.stat-card').forEach(c => {
        c.style.cursor = 'default';
        c.onclick = null;
        c.style.pointerEvents = 'none';
      });

      // Insert "My Profile" card
      const grid = document.querySelector('.menu-cards-grid');
      if (grid) {
        const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
        const card = document.createElement('div');
        card.className = 'menu-card';
        card.style.cssText = 'border-top-color:#0ea5e9;max-width:380px';
        card.setAttribute('onclick', `window.location.href='student-profile.html?stipNo=${encodeURIComponent(user.stipNo||'')}' `);
        card.innerHTML = `
          <div class="menu-icon" style="background:#f0f9ff">
            <i data-lucide="user-circle-2" class="w-7 h-7" style="color:#0ea5e9"></i>
          </div>
          <h4 class="font-bold text-gray-800 text-base mb-1">${isEN ? 'My Profile' : 'โปรไฟล์ของฉัน'}</h4>
          <p class="text-xs text-gray-500">${isEN ? 'View and update your personal information' : 'ดูและอัปเดตข้อมูลส่วนตัวของคุณ'}</p>`;
        grid.appendChild(card);
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    } else {
      // Admin: dim/disable restricted cards
      document.querySelectorAll('.menu-card').forEach(card => {
        const oc = card.getAttribute('onclick') || '';
        if (oc.includes('settings.html') && !canSettings) {
          _rbacDimCard(card, 'viewSettings');
        } else if (oc.includes('promotion.html') && !canPromo) {
          _rbacDimCard(card, 'viewPromotion');
        }
      });
    }
  },

  // ── Utility ──────────────────────────────────

  /** Disable a button with tooltip. */
  disableBtn(el, reasonTH, reasonEN) {
    if (!el) return;
    const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
    el.disabled = true;
    el.title = isEN ? (reasonEN || reasonTH) : reasonTH;
    el.style.opacity = '0.4';
    el.style.cursor = 'not-allowed';
    el.onclick = null;
  },

  /** Human-readable role label (bilingual). */
  roleLabel(role) {
    const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
    const L = {
      SuperAdmin:  { th:'ผู้ดูแลสูงสุด',  en:'Super Administrator' },
      Manager:     { th:'ผู้จัดการ',       en:'Manager' },
      Finance:     { th:'การเงิน',         en:'Finance Officer' },
      Committee:   { th:'คณะกรรมการ',      en:'Committee' },
      DormTeacher: { th:'ครูหอพัก',        en:'Dorm Teacher' },
      Student:     { th:'นักเรียนทุน',     en:'Student' },
    };
    return (L[role] || {})[isEN ? 'en' : 'th'] || role;
  },

  /** Get student default editable fields list (for settings UI) */
  getDefaultEditableFields() { return [...STUDENT_EDITABLE_DEFAULTS]; },

  /** Get all protected fields (for settings UI) */
  getProtectedFields() { return [...STUDENT_PROTECTED_FIELDS]; },
};

// ─────────────────────────────────────────────
// PRIVATE HELPERS (not exported on RBAC)
// ─────────────────────────────────────────────

function _rbacLockField(el, isHard) {
  el.readOnly  = true;
  el.disabled  = true;
  el.style.background   = isHard ? '#f1f5f9' : '#f8fafc';
  el.style.color        = isHard ? '#64748b' : '#94a3b8';
  el.style.cursor       = 'not-allowed';
  el.style.pointerEvents = 'none';
  if (el.tagName === 'SELECT') el.style.opacity = '0.6';
}

function _rbacUnlockField(el) {
  el.readOnly  = false;
  el.disabled  = false;
  el.style.background   = '';
  el.style.color        = '';
  el.style.cursor       = '';
  el.style.pointerEvents = '';
  if (el.tagName === 'SELECT') el.style.opacity = '';
}

function _rbacDimCard(card, perm) {
  const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
  const msgs = {
    viewSettings: {
      th: 'เฉพาะ SuperAdmin เท่านั้นที่เข้าถึงการตั้งค่าระบบได้',
      en: 'Only SuperAdmin can access System Settings.',
    },
    viewPromotion: {
      th: 'ฟังก์ชันนี้สำหรับ Manager หรือสูงกว่าเท่านั้น',
      en: 'This feature requires Manager role or above.',
    },
  };
  const msg = (msgs[perm] || {})[isEN ? 'en' : 'th'] || 'No permission';
  card.style.opacity = '0.45';
  card.style.cursor  = 'not-allowed';
  card.onclick = e => {
    e.preventDefault();
    Swal.fire({
      icon:'info',
      title: isEN ? 'No Permission' : 'ไม่มีสิทธิ์',
      text: msg, timer:2500, showConfirmButton:false,
    });
  };
}

function _rbacShowStudentFormNotice() {
  const isEN = (localStorage.getItem('rdfLang') || 'th') === 'en';
  const banner = document.createElement('div');
  banner.style.cssText = `
    position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:9000;
    background:#1e3a8a;color:#fff;padding:10px 20px;border-radius:12px;
    font-size:12px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.25);
    display:flex;align-items:center;gap:10px;max-width:90vw;
  `;
  banner.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    ${isEN
      ? 'You are editing your own profile. Some fields are read-only for security.'
      : 'คุณกำลังแก้ไขข้อมูลส่วนตัว บางช่องถูกล็อคเพื่อความปลอดภัย'
    }
    <button onclick="this.parentElement.remove()" style="background:rgba(255,255,255,.2);border:none;color:#fff;
      border-radius:6px;padding:2px 8px;cursor:pointer;margin-left:4px">✕</button>`;
  document.body.appendChild(banner);
  setTimeout(() => { if (banner.parentElement) banner.remove(); }, 6000);
}
