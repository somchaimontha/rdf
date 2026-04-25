/* ── RDF Tamper Guard ──────────────────────────────────────────────────
 * Discourages casual inspection / tampering.
 * NOTE: This is a deterrent only — not a hard security boundary.
 * Real security is enforced server-side in Code.gs.
 *
 * Can be disabled for development via Settings → About → Developer Mode
 * (stored as localStorage key "rdfDevMode" = "1")
 * ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Developer mode — disable tamper guard entirely
  if (localStorage.getItem('rdfDevMode') === '1') return;

  // Block right-click context menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Block DevTools shortcuts — Windows/Linux (Ctrl) and Mac (Cmd/Meta)
  document.addEventListener('keydown', function (e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key = e.key.toUpperCase();

    if (e.key === 'F12') { e.preventDefault(); return; }

    // Ctrl+Shift+I/J/C  (Windows) or Cmd+Option+I/J/C (Mac)
    if (ctrl && shift && ['I', 'J', 'C'].includes(key)) { e.preventDefault(); return; }
    if (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(key)) { e.preventDefault(); return; }

    // Ctrl+U / Cmd+U (view source)
    if (ctrl && key === 'U') { e.preventDefault(); return; }
  });

  // Detect DevTools open via size difference (rough heuristic)
  var _devToolsThreshold = 160;
  var _devToolsOpen = false;
  setInterval(function () {
    var widthDiff  = window.outerWidth  - window.innerWidth;
    var heightDiff = window.outerHeight - window.innerHeight;
    var isOpen = widthDiff > _devToolsThreshold || heightDiff > _devToolsThreshold;
    if (isOpen && !_devToolsOpen) {
      _devToolsOpen = true;
      console.clear();
      console.warn('%c⚠️ หน้านี้สำหรับผู้ดูแลระบบที่ได้รับอนุญาตเท่านั้น', 'color:red;font-size:18px;font-weight:bold');
    }
    if (!isOpen) _devToolsOpen = false;
  }, 1000);
})();
