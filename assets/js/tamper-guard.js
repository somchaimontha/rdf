/* ── RDF Tamper Guard ──────────────────────────────────────────────────
 * Discourages casual inspection / tampering.
 * NOTE: This is a deterrent only — not a hard security boundary.
 * Real security is enforced server-side in Code.gs.
 * ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Block right-click context menu
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U (view-source)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F12') { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key.toUpperCase())) {
      e.preventDefault(); return;
    }
    if (e.ctrlKey && e.key.toUpperCase() === 'U') { e.preventDefault(); return; }
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
