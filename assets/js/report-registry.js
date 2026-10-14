/* Shared client-side report registration helpers.
 * The registry stores metadata and a SHA-256 fingerprint only. Report rows stay
 * in the source system and are never embedded in the public verification URL.
 */
(function reportRegistryClient(global) {
  'use strict';

  function stableJson(value) {
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value ?? null);
  }

  async function sha256(value) {
    if (!global.crypto?.subtle || typeof TextEncoder === 'undefined') {
      throw new Error(typeof t === 'function' ? t('reportHashUnavailable') : 'Report hashing is unavailable.');
    }
    const bytes = new TextEncoder().encode(String(value));
    const digest = await global.crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function verificationUrl(token, language) {
    const url = new URL('report-verification.html', global.location.href);
    url.searchParams.set('token', String(token || ''));
    url.searchParams.set('lang', language === 'en' ? 'en' : 'th');
    return url.href;
  }

  async function issue(options) {
    const contentHash = await sha256(stableJson(options.content));
    const payload = {
      reportType: options.reportType,
      fingerprint: contentHash,
      contentHash,
      language: options.language === 'en' ? 'en' : 'th',
      subjectTH: options.subjectTH,
      subjectEN: options.subjectEN,
      scope: options.scope || {},
      fieldKeys: options.fieldKeys || ['report'],
      rowCount: Number(options.rowCount) || 0,
    };
    const result = await API.issueReportReference(payload);
    if (!result || result.status !== 'success' || !result.verificationToken || !result.report?.referenceNo) {
      throw new Error(result?.message || (typeof t === 'function' ? t('reportRegistryFailed') : 'Unable to register report.'));
    }
    return {
      ...result,
      contentHash,
      verificationUrl: verificationUrl(result.verificationToken, payload.language),
    };
  }

  async function qrDataUrl(url, size) {
    if (typeof global.QRCode === 'undefined') {
      throw new Error(typeof t === 'function' ? t('empComposerQrLibraryError') : 'QR generator unavailable.');
    }
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden';
    document.body.appendChild(holder);
    try {
      new global.QRCode(holder, {
        text: url,
        width: size || 180,
        height: size || 180,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: global.QRCode.CorrectLevel?.M,
      });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const canvas = holder.querySelector('canvas');
      const image = holder.querySelector('img');
      return canvas?.toDataURL('image/png') || image?.src || '';
    } finally {
      holder.remove();
    }
  }

  function verificationRows(registration, language) {
    const isEN = language === 'en';
    return [
      [isEN ? 'Report verification' : 'การตรวจสอบรายงาน', ''],
      [isEN ? 'Reference number' : 'เลขอ้างอิง', registration.report.referenceNo],
      [isEN ? 'Verification URL' : 'URL ตรวจสอบ', registration.verificationUrl],
      [isEN ? 'QR version' : 'รุ่น QR', registration.report.qrVersion || 1],
      [isEN ? 'Content verification hash' : 'รหัสตรวจสอบเนื้อหา', registration.contentHash],
      [isEN ? 'Access note' : 'เงื่อนไขการเข้าถึง', isEN
        ? 'The subject is public. Sign-in is required for internal details.'
        : 'หน้าสาธารณะแสดงหัวข้อได้ แต่รายละเอียดภายในต้องเข้าสู่ระบบ'],
    ];
  }

  function label(key, language) {
    return global.T?.[language === 'en' ? 'en' : 'th']?.[key] || (typeof t === 'function' ? t(key) : key);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  }

  async function confirmRegeneration(registration, language) {
    if (!registration?.report?.reportId || typeof global.Swal === 'undefined') return registration;
    const result = await global.Swal.fire({
      icon:'warning', title:label('empComposerQrRegenerateTitle', language),
      html:`<p style="font-size:12px;color:#64748b;text-align:left;line-height:1.6">${escapeHtml(label('empComposerQrRegenerateWarning',language))}</p><textarea id="sharedQrReason" class="swal2-textarea" maxlength="500" placeholder="${escapeHtml(label('empComposerQrReason',language))}"></textarea><label style="display:flex;align-items:flex-start;gap:8px;text-align:left;font-size:12px;color:#475569"><input id="sharedQrAck" type="checkbox" style="margin-top:3px"><span>${escapeHtml(label('empComposerQrAcknowledge',language))}</span></label>`,
      showCancelButton:true, confirmButtonText:label('empComposerQrConfirm',language), cancelButtonText:label('cancel',language),
      confirmButtonColor:'#b45309', focusConfirm:false,
      preConfirm:() => {
        const reason = document.getElementById('sharedQrReason')?.value.trim() || '';
        const acknowledge = document.getElementById('sharedQrAck')?.checked === true;
        if (reason.length < 10 || !acknowledge) {
          global.Swal.showValidationMessage(label('empComposerQrConditionsError',language));
          return false;
        }
        return { reason, acknowledge };
      },
    });
    if (!result.isConfirmed) return registration;
    const response = await API.regenerateReportQr(registration.report.reportId, result.value.reason, result.value.acknowledge);
    if (!response || response.status !== 'success') throw new Error(response?.message || label('reportRegistryFailed',language));
    return { ...registration, ...response, reused:true, verificationUrl:verificationUrl(response.verificationToken,language) };
  }

  global.ReportRegistryClient = Object.freeze({ stableJson, sha256, verificationUrl, issue, qrDataUrl, verificationRows, confirmRegeneration });
})(window);
