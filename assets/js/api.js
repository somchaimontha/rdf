/* ── RDF API Calls ── */

/* ── Drive image URL normalizer ── */
function driveImgUrl(url, sz) {
  if (!url) return '';
  sz = sz || 'w400';
  // Already a thumbnail URL — just update sz
  if (url.includes('drive.google.com/thumbnail')) {
    return url.replace(/[?&]sz=[^&]*/g, '').replace(/\?$/, '') + (url.includes('?') ? '&sz=' + sz : '?sz=' + sz);
  }
  // Extract file ID from any Drive URL format
  const m = url.match(/\/d\/([^/?#&]+)/) || url.match(/[?&]id=([^&]+)/);
  if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=${sz}`;
  return url; // Not a Drive URL — return as-is
}

function avatarUrl(name, size) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || '?')}&background=1e3a8a&color=fff&bold=true&size=${size || 64}`;
}

function _getToken() {
  try { return (JSON.parse(localStorage.getItem('rdfUser')) || {}).sessionToken || ''; } catch { return ''; }
}

const _API_CODE_I18N_KEYS = {
  ACCESS_DENIED: 'dfErrorAccessDenied', SETUP_REQUIRED: 'dfErrorSetupRequired', BUSY: 'dfErrorBusy', RATE_LIMITED: 'dfErrorRateLimited',
  VALIDATION_ERROR: 'dfErrorValidation', DUPLICATE_KEY: 'dfErrorDuplicateKey', IMMUTABLE_KEY: 'dfErrorImmutableKey',
  SECTION_NOT_FOUND: 'dfErrorSectionNotFound', OPTIONS_REQUIRED: 'dfErrorOptionsRequired', DUPLICATE_OPTION: 'dfErrorDuplicateOption',
  VALIDATION_RANGE_ERROR: 'dfErrorValidationRange', UNSAFE_TYPE_CHANGE: 'dfErrorUnsafeType',
  UNSAFE_CARDINALITY_CHANGE: 'dfErrorUnsafeCardinality', UNSAFE_SECTION_CHANGE: 'dfErrorUnsafeSection',
  INVALID_DEFAULT_VALUE: 'dfErrorInvalidDefault', FIELD_NOT_FOUND: 'dfErrorFieldNotFound', ENTITY_NOT_FOUND: 'dfErrorEntityNotFound',
  FIELD_NOT_AVAILABLE: 'dfErrorFieldUnavailable', FIELD_ACCESS_DENIED: 'dfErrorAccessDenied', FIELD_NOT_VISIBLE: 'dfErrorFieldUnavailable',
  INVALID_RECORD_ID: 'dfErrorInvalidRecord', FIELD_VALIDATION_ERROR: 'dfErrorFieldValidation', DUPLICATE_VALUE: 'dfErrorDuplicateValue',
  INVALID_CALCULATION_CONFIG: 'dfErrorInvalidCalculation',
  EMPLOYMENT_REVIEW_REQUIRED: 'empReviewRequired', EMPLOYMENT_SCHEMA_CONFLICT: 'empSchemaConflict',
  EMPLOYMENT_SETUP_PREVIEW_FAILED: 'empPreviewError', EMPLOYMENT_SETUP_FAILED: 'empSetupError',
  EMPLOYMENT_REPORT_FAILED: 'empReportError', EMPLOYMENT_MIGRATION_PREVIEW_FAILED: 'empMigrationPreviewError',
  EMPLOYMENT_MIGRATION_SELECTION_INVALID: 'empMigrationSelectionError', EMPLOYMENT_MIGRATION_FAILED: 'empMigrationError',
  FOLLOWUP_VALIDATION_ERROR: 'empFollowUpValidationError', FOLLOWUP_RECORD_NOT_FOUND: 'empFollowUpRecordError',
  FOLLOWUP_NOT_FOUND: 'empFollowUpNotFound', FOLLOWUP_SAVE_FAILED: 'empFollowUpSaveError',
  FOLLOWUP_ARCHIVE_FAILED: 'empFollowUpArchiveError', EMPLOYMENT_AUDIT_MODE: 'empAuditModeError',
  LOCAL_AUDIT_MODE: 'localAuditModeError', REPORT_REGISTRY_VALIDATION_ERROR: 'reportRegistryValidationError',
  REPORT_REGISTRY_BUSY: 'reportRegistryBusy', REPORT_REGISTRY_FAILED: 'reportRegistryFailed',
  REPORT_VERIFICATION_NOT_FOUND: 'reportVerificationNotFound',
  REPORT_QR_REGENERATION_CONDITIONS: 'reportQrRegenerationConditions',
  NOTIFICATION_RULES_INVALID: 'empNotifValidationError',
  EMPLOYMENT_TRACKING_PERIODS_INVALID: 'empPeriodSaveError',
  SURVEY_SETUP_PREVIEW_FAILED:'surveySetupPreviewError', SURVEY_SETUP_FAILED:'surveySetupError',
  SURVEY_SETUP_REQUIRED:'surveySetupRequired', SURVEY_ADMIN_LOAD_FAILED:'surveyLoadError',
  SURVEY_VALIDATION_ERROR:'surveyValidationError', SURVEY_QUESTION_INVALID:'surveyQuestionInvalid',
  SURVEY_OPTIONS_REQUIRED:'surveyOptionsRequired', SURVEY_MATRIX_INVALID:'surveyMatrixInvalid',
  SURVEY_DUPLICATE_QUESTION_KEY:'surveyDuplicateQuestionKey', SURVEY_DUPLICATE_OPTION:'surveyDuplicateOption',
  SURVEY_FORM_IMMUTABLE:'surveyFormImmutable', SURVEY_FORM_NOT_FOUND:'surveyFormNotFound',
  SURVEY_FORM_SAVE_FAILED:'surveySaveError', SURVEY_CAMPAIGN_INVALID:'surveyCampaignInvalid',
  SURVEY_CAMPAIGN_NOT_FOUND:'surveyCampaignNotFound', SURVEY_CAMPAIGN_IMMUTABLE:'surveyCampaignImmutable',
  SURVEY_CAMPAIGN_PUBLISH_FAILED:'surveyPublishError', SURVEY_ASSIGNMENT_NOT_FOUND:'surveyAssignmentNotFound',
  SURVEY_ASSIGNMENTS_LOAD_FAILED:'surveyAssignmentsLoadError', SURVEY_RESPONSE_LOAD_FAILED:'surveyResponseLoadError',
  SURVEY_RESPONSE_SAVE_FAILED:'surveyResponseSaveError', SURVEY_REQUIRED_ANSWERS:'surveyRequiredAnswers',
  SURVEY_ALREADY_SUBMITTED:'surveyAlreadySubmitted', SURVEY_NOT_OPEN:'surveyNotOpen', SURVEY_SUMMARY_FAILED:'surveySummaryError',
  TRACKING_CYCLE_LOAD_FAILED:'trackingCycleLoadError', TRACKING_CYCLE_INVALID:'trackingCycleInvalid',
  TRACKING_CYCLE_NOT_FOUND:'trackingCycleNotFound', TRACKING_CYCLE_IMMUTABLE:'trackingCycleImmutable',
  TRACKING_CYCLE_DUPLICATE:'trackingCycleDuplicate',
  VOLUNTEER_SETUP_PREVIEW_FAILED:'volunteerSetupPreviewError', VOLUNTEER_SETUP_FAILED:'volunteerSetupError',
  VOLUNTEER_SETUP_REQUIRED:'volunteerSetupRequired', VOLUNTEER_LOAD_FAILED:'volunteerLoadError',
  VOLUNTEER_NOT_FOUND:'volunteerNotFound', VOLUNTEER_VALIDATION_ERROR:'volunteerValidationError',
  VOLUNTEER_SAVE_FAILED:'volunteerSaveError', VOLUNTEER_ARCHIVE_FAILED:'volunteerArchiveError',
  STUDENT_SETUP_EXPIRED:'studentSetupExpired', STUDENT_SETUP_EMAIL_LIMIT:'studentSetupEmailLimit',
  STUDENT_SETUP_ALREADY_COMPLETED:'studentSetupAlreadyCompleted',
  STUDENT_EMAIL_INVALID:'studentSetupEmailInvalid', STUDENT_BIRTH_DATE_INVALID:'studentBirthDateInvalid',
  STUDENT_IDENTITY_CONFIRM_REQUIRED:'studentIdentityConfirmRequired',
  STUDENT_BIRTH_DATE_CONFIRM_REQUIRED:'studentBirthDateConfirmRequired',
  STUDENT_NON_GMAIL_CONFIRM_REQUIRED:'studentNonGmailConfirmRequired',
  STUDENT_PASSWORD_POLICY:'studentSetupPasswordPolicy', STUDENT_ACCOUNT_NOT_FOUND:'studentAccountNotFound',
  STUDENT_BIRTH_DATE_MISMATCH:'studentBirthDateMismatch', STUDENT_EMAIL_IN_USE:'studentEmailInUse',
  STUDENT_EMAIL_MISMATCH:'studentEmailMismatch',
  STUDENT_EMAIL_SEND_FAILED:'studentEmailSendFailed', STUDENT_EMAIL_QUOTA_EXHAUSTED:'studentEmailQuotaExhausted',
  STUDENT_EMAIL_RESEND_WAIT:'studentEmailResendServerWait',
  STUDENT_EMAIL_HOURLY_LIMIT:'studentEmailHourlyLimit', STUDENT_EMAIL_DAILY_LIMIT:'studentEmailDailyLimit',
  STUDENT_VERIFICATION_EXPIRED:'studentVerificationExpired',
  STUDENT_VERIFICATION_LOCKED:'studentVerificationLocked', STUDENT_VERIFICATION_INVALID:'studentVerificationInvalid',
  STUDENT_GOOGLE_EMAIL_NOT_LINKED:'studentGoogleEmailNotLinked', GOOGLE_EMAIL_UNVERIFIED:'googleEmailUnverified',
  GOOGLE_AUDIENCE_INVALID:'googleLoginFailed'
};

function _localizeStructuredApiData(data) {
  if (!data || data.status !== 'error' || !data.code || typeof t !== 'function') return data;
  const key = _API_CODE_I18N_KEYS[data.code];
  if (key) data.message = t(key);
  return data;
}

// Share identical read requests made during the same page load. Dashboard
// widgets often need the same student/settings data, so one response can feed
// all of them instead of starting duplicate Apps Script executions.
const _apiGetInFlight = new Map();
const _apiGetCache = new Map();
const _API_GET_CACHE_MS = 20000;
const _API_TIMEOUT_DEFAULT_MS = 45000;
const _API_TIMEOUT_SETTINGS_MS = 120000;
const _API_TIMEOUT_SETUP_MS = 300000;
const _API_TIMEOUT_MIGRATION_MS = 300000;
const _API_UNEXPECTED_RESPONSE_CODE = 'API_UNEXPECTED_RESPONSE';
const _API_CACHEABLE_GET_ACTIONS = new Set([
  'getDashboardStats', 'getStudents', 'getVolunteers', 'getVolunteer', 'previewVolunteerSetup', 'getAdmins', 'getSystemSettings', 'getPublicSettings', 'getNotificationFeed', 'getPendingScholarshipRequests',
  'getUniNames', 'getStudentsForPromotion', 'getWithdrawalStudents',
  'getDynamicFormSchema', 'getDynamicFieldAdminData', 'previewDynamicFieldSetup',
  'previewEmploymentHistorySetup', 'previewLegacyEmploymentMigration', 'getEmploymentReport', 'getStudentEmploymentFollowUps',
  'previewSurveySetup', 'getSurveyAdminData', 'getTrackingCycleData', 'getMySurveyAssignments', 'getSurveyForResponse', 'getSurveyCampaignSummary'
]);
let _apiGetCacheGeneration = 0;

async function _apiReadJsonResponse(response) {
  // Browser fixtures and older mocks may expose only json(). Production uses
  // text() first so an HTML gateway/login page never leaks a JSON parser error
  // such as "Unexpected token '<'" into the interface.
  if (typeof response?.text !== 'function' && typeof response?.json === 'function') return response.json();
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch (_) {
    const error = new Error(typeof t === 'function'
      ? t('apiUnexpectedResponse')
      : 'The data service returned an invalid response. Please reload and try again.');
    error.code = _API_UNEXPECTED_RESPONSE_CODE;
    error.httpStatus = Number(response?.status || 0);
    throw error;
  }
}

function _apiGetCacheKey(params, token) {
  const entries = Object.entries(token ? { ...params, token } : { ...params })
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function _invalidateApiGetCache() {
  _apiGetCacheGeneration++;
  _apiGetCache.clear();
}

const _API_LOCAL_AUDIT_ALLOWED_POSTS = new Set(['login', 'loginWithGoogle', 'logoutToken']);
const _API_LOCAL_AUDIT_BLOCKED_GETS = new Set([
  'deleteStudent', 'setupEmailColumns', 'setupMissingColumns', 'backfillCurrentAcademicYear'
]);

function _apiLocalAuditEnabled() {
  return typeof RDF !== 'undefined' && RDF.LOCAL_AUDIT_MODE === true;
}

function _apiLocalAuditError() {
  return _localizeStructuredApiData({
    status:'error', code:'LOCAL_AUDIT_MODE',
    message:'Localhost is in read-only audit mode.'
  });
}

async function _apiGetNetwork(params, timeoutMs) {
  if (_apiLocalAuditEnabled() && _API_LOCAL_AUDIT_BLOCKED_GETS.has(params.action)) {
    return _apiLocalAuditError();
  }
  const token = _getToken();
  const p = token ? { ...params, token } : { ...params };
  const url = RDF.GAS_URL + '?' + new URLSearchParams(p).toString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || _API_TIMEOUT_DEFAULT_MS);
  let data;
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(url, { signal: ctrl.signal });
      try {
        data = await _apiReadJsonResponse(response);
        break;
      } catch (error) {
        if (error.code !== _API_UNEXPECTED_RESPONSE_CODE || attempt > 0 || !_API_CACHEABLE_GET_ACTIONS.has(params.action)) throw error;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(t('connectionTimeout'));
    throw e;
  }
  clearTimeout(timer);
  if (data && typeof data.message === 'string') {
    data.rawMessage = data.message;
    data.message = localizeApiMessage(data.message, data.status === 'success' ? 'success' : 'error');
  }
  _localizeStructuredApiData(data);
  if (data.status === 'error' && data.rawMessage === 'Unauthorized. Please login again.') {
    // Session expired — force re-login (only if NOT already on the login page)
    const path = window.location.pathname;
    const onLogin = path.endsWith('index.html') || path.endsWith('/') || path === '';
    if (!onLogin) {
      localStorage.removeItem('rdfUser');
      window.location.href = 'index.html?expired=1';
    }
  }
  return data;
}

async function apiGet(params, timeoutMs) {
  if (!_API_CACHEABLE_GET_ACTIONS.has(params.action)) {
    return _apiGetNetwork(params, timeoutMs);
  }

  const token = _getToken();
  const key = _apiGetCacheKey(params, token);
  const cached = _apiGetCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  if (cached) _apiGetCache.delete(key);
  if (_apiGetInFlight.has(key)) return _apiGetInFlight.get(key);

  const generation = _apiGetCacheGeneration;
  const request = _apiGetNetwork(params, timeoutMs)
    .then(data => {
      if (data && data.status !== 'error' && generation === _apiGetCacheGeneration) {
        _apiGetCache.set(key, { data, expiresAt: Date.now() + _API_GET_CACHE_MS });
      }
      return data;
    })
    .finally(() => _apiGetInFlight.delete(key));
  _apiGetInFlight.set(key, request);
  return request;
}

async function apiPost(body, timeoutMs) {
  const fixtureReportWrite = typeof window !== 'undefined' && window.__RDF_LOCAL_FIXTURE__ === true &&
    ['issueReportReference','regenerateReportQr'].includes(body.action);
  if (_apiLocalAuditEnabled() && !_API_LOCAL_AUDIT_ALLOWED_POSTS.has(body.action) && !fixtureReportWrite) {
    return _apiLocalAuditError();
  }
  const token = _getToken();
  const requestBody = _apiLocalAuditEnabled() ? { ...body, auditMode:true } : { ...body };
  const b = token ? { ...requestBody, token } : requestBody;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || _API_TIMEOUT_DEFAULT_MS);
  let res;
  try {
    res = await fetch(RDF.GAS_URL, {
      method: 'POST',
      body: JSON.stringify(b),
      headers: { 'Content-Type': 'text/plain' },
      signal: ctrl.signal
    });
  } catch(e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(t('connectionTimeout'));
    throw e;
  }
  clearTimeout(timer);
  const data = await _apiReadJsonResponse(res);
  if (data && typeof data.message === 'string') {
    data.rawMessage = data.message;
    data.message = localizeApiMessage(data.message, data.status === 'success' ? 'success' : 'error');
  }
  _localizeStructuredApiData(data);
  if (data.status === 'error' && data.rawMessage === 'Unauthorized. Please login again.') {
    const path = window.location.pathname;
    const onLogin = path.endsWith('index.html') || path.endsWith('/') || path === '';
    if (!onLogin) {
      localStorage.removeItem('rdfUser');
      window.location.href = 'index.html?expired=1';
    }
  }
  if (data.status === 'success' && body.action !== 'clientLog') {
    _invalidateApiGetCache();
  }
  return data;
}

const API = {
  clearReadCache()             { _invalidateApiGetCache(); },
  async getDashboardStats()     { return apiGet({ action: 'getDashboardStats' }); },
  async getStudents()          { return apiGet({ action: 'getStudents' }); },
  async getStudent(stipNo)     { return apiGet({ action: 'getStudent', stipNo }); },
  async getStudentAccount(stipNo) { return apiGet({ action:'getStudentAccount', stipNo }); },
  async previewVolunteerSetup() { return apiGet({ action:'previewVolunteerSetup' }, _API_TIMEOUT_SETTINGS_MS); },
  async setupVolunteerSchema() { return apiPost({ action:'setupVolunteerSchema' }, _API_TIMEOUT_SETUP_MS); },
  async getVolunteers() { return apiGet({ action:'getVolunteers' }, _API_TIMEOUT_SETTINGS_MS); },
  async getVolunteer(volunteerId) { return apiGet({ action:'getVolunteer', volunteerId }, _API_TIMEOUT_SETTINGS_MS); },
  async saveVolunteer(volunteer) { return apiPost({ action:'saveVolunteer', volunteer:volunteer || {} }, _API_TIMEOUT_SETTINGS_MS); },
  async archiveVolunteer(volunteerId) { return apiPost({ action:'archiveVolunteer', volunteerId }, _API_TIMEOUT_SETTINGS_MS); },
  async generateStipNo(inst)   { return apiGet({ action: 'generateStipNo', institution: inst }); },
  async deleteStudent(stipNo)  {
    const result = await apiGet({ action: 'deleteStudent', stipNo });
    if (result && result.status === 'success') _invalidateApiGetCache();
    return result;
  },
  async getUniNames()          { return apiGet({ action: 'getUniNames' }); },
  async saveStudent(data)      { return apiPost({ action: 'saveStudent',   student: data }); },
  async updateStudent(data)    { return apiPost({ action: 'updateStudent', student: data }); },
  async updateStudentAccountEmail(stipNo, email) {
    return apiPost({ action:'updateStudentAccountEmail', stipNo, email });
  },
  async getDynamicFormSchema(entityType, entityId) {
    return apiGet({ action: 'getDynamicFormSchema', entityType: entityType || 'student', entityId: entityId || '' });
  },
  async getDynamicFieldAdminData(entityType) {
    return apiGet({ action: 'getDynamicFieldAdminData', entityType: entityType || 'student' }, _API_TIMEOUT_SETTINGS_MS);
  },
  async previewDynamicFieldSetup() { return apiGet({ action: 'previewDynamicFieldSetup' }, _API_TIMEOUT_SETTINGS_MS); },
  async setupDynamicFieldSchema() { return apiPost({ action: 'setupDynamicFieldSchema' }, _API_TIMEOUT_SETUP_MS); },
  async previewEmploymentHistorySetup() { return apiGet({ action: 'previewEmploymentHistorySetup' }, _API_TIMEOUT_SETTINGS_MS); },
  async setupEmploymentHistorySchema(options) { return apiPost({ action: 'setupEmploymentHistorySchema', options: options || {} }, _API_TIMEOUT_SETUP_MS); },
  async previewLegacyEmploymentMigration() { return apiGet({ action: 'previewLegacyEmploymentMigration' }, _API_TIMEOUT_SETTINGS_MS); },
  async migrateLegacyEmploymentData(sourceKeys) { return apiPost({ action: 'migrateLegacyEmploymentData', sourceKeys: sourceKeys || [] }, _API_TIMEOUT_MIGRATION_MS); },
  async getEmploymentReport(filters) { return apiGet({ action: 'getEmploymentReport', ...(filters || {}) }); },
  async getStudentEmploymentFollowUps(stipNo) { return apiGet({ action:'getStudentEmploymentFollowUps', stipNo }); },
  async previewSurveySetup() { return apiGet({ action:'previewSurveySetup' }, _API_TIMEOUT_SETTINGS_MS); },
  async setupSurveySchema() { return apiPost({ action:'setupSurveySchema' }, _API_TIMEOUT_SETUP_MS); },
  async getSurveyAdminData() { return apiGet({ action:'getSurveyAdminData' }, _API_TIMEOUT_SETTINGS_MS); },
  async getTrackingCycleData() { return apiGet({ action:'getTrackingCycleData' }, _API_TIMEOUT_SETTINGS_MS); },
  async saveTrackingCycle(cycle) { return apiPost({ action:'saveTrackingCycle', cycle:cycle || {} }, _API_TIMEOUT_SETTINGS_MS); },
  async publishTrackingCycle(cycleId) { return apiPost({ action:'publishTrackingCycle', cycleId }, _API_TIMEOUT_SETUP_MS); },
  async archiveTrackingCycle(cycleId) { return apiPost({ action:'archiveTrackingCycle', cycleId }, _API_TIMEOUT_SETTINGS_MS); },
  async saveSurveyFormDraft(form) { return apiPost({ action:'saveSurveyFormDraft', form:form || {} }, _API_TIMEOUT_SETTINGS_MS); },
  async saveSurveyCampaignDraft(campaign) { return apiPost({ action:'saveSurveyCampaignDraft', campaign:campaign || {} }, _API_TIMEOUT_SETTINGS_MS); },
  async publishSurveyCampaign(campaignId) { return apiPost({ action:'publishSurveyCampaign', campaignId }, _API_TIMEOUT_SETUP_MS); },
  async getMySurveyAssignments() { return apiGet({ action:'getMySurveyAssignments' }, _API_TIMEOUT_SETTINGS_MS); },
  async getSurveyForResponse(assignmentId) { return apiGet({ action:'getSurveyForResponse', assignmentId }, _API_TIMEOUT_SETTINGS_MS); },
  async saveSurveyResponseDraft(assignmentId, answers, language) { return apiPost({ action:'saveSurveyResponseDraft', assignmentId, answers:answers || [], language:language || 'th' }, _API_TIMEOUT_SETTINGS_MS); },
  async submitSurveyResponse(assignmentId, answers, language) { return apiPost({ action:'submitSurveyResponse', assignmentId, answers:answers || [], language:language || 'th' }, _API_TIMEOUT_SETTINGS_MS); },
  async getSurveyCampaignSummary(campaignId) { return apiGet({ action:'getSurveyCampaignSummary', campaignId }, _API_TIMEOUT_SETTINGS_MS); },
  async issueReportReference(report) { return apiPost({ action: 'issueReportReference', report: report || {} }); },
  async regenerateReportQr(reportId, reason, acknowledgeInvalidation) {
    return apiPost({ action: 'regenerateReportQr', reportId, reason, acknowledgeInvalidation: acknowledgeInvalidation === true });
  },
  async getReportVerification(verificationToken) { return apiGet({ action: 'getReportVerification', verificationToken }); },
  async getReportVerificationDetails(verificationToken) { return apiGet({ action: 'getReportVerificationDetails', verificationToken }); },
  async saveEmploymentFollowUp(followUp) { return apiPost({ action: 'saveEmploymentFollowUp', followUp }); },
  async archiveEmploymentFollowUp(followUpId) { return apiPost({ action: 'archiveEmploymentFollowUp', followUpId }); },
  async saveDynamicSection(section) { return apiPost({ action: 'saveDynamicSection', section }); },
  async saveDynamicField(field, options) { return apiPost({ action: 'saveDynamicField', field, options: options || [] }); },
  async archiveDynamicField(fieldId) { return apiPost({ action: 'archiveDynamicField', fieldId }); },
  async saveStudentDynamicValues(entityType, entityId, changes, removeRecords) {
    return apiPost({ action: 'saveStudentDynamicValues', entityType: entityType || 'student', entityId, changes: changes || [], removeRecords: removeRecords || [] });
  },
  async getAdmins()               { return apiGet({ action: 'getAdmins' }, _API_TIMEOUT_SETTINGS_MS); },
  async saveAdmin(data)            { return apiPost({ action: 'saveAdmin',   admin: data,   reqUser: (getUser()||{}).username||'' }, _API_TIMEOUT_SETTINGS_MS); },
  async loginWithGoogle(idToken, accountType) {
    return apiPost({ action:'loginWithGoogle', idToken, accountType:accountType || 'admin' });
  },
  async deleteAdmin(username)      { return apiPost({ action: 'deleteAdmin', username,      reqUser: (getUser()||{}).username||'' }, _API_TIMEOUT_SETTINGS_MS); },
  async getSystemSettings()        { return apiGet({ action: 'getSystemSettings' }, _API_TIMEOUT_SETTINGS_MS); },
  async getNotificationFeed(force) { return apiGet({ action: 'getNotificationFeed', ...(force ? { force:'1' } : {}) }, _API_TIMEOUT_SETTINGS_MS); },
  async getPublicSettings()        { return apiGet({ action: 'getPublicSettings' }); },
  async saveSetting(key, values)   { return apiPost({ action: 'saveSetting', key, values,   reqUser: (getUser()||{}).username||'' }, _API_TIMEOUT_SETTINGS_MS); },
  async getLogs(limit)             { return apiGet({ action: 'getLogs', limit: limit || 200 }, _API_TIMEOUT_SETTINGS_MS); },
  async parseOCRText(text)                    { return apiPost({ action: 'parseOCRText', ocrText: text }); },
  async parseDocumentAI(base64, mimeType)     { return apiPost({ action: 'parseDocumentAI', base64, mimeType }); },
  async getApiKeyStatus()          { return apiGet({ action: 'getApiKeyStatus' }, _API_TIMEOUT_SETTINGS_MS); },
  async saveApiKey(key)            { return apiPost({ action: 'saveApiKey', key, reqUser: (getUser()||{}).username||'' }, _API_TIMEOUT_SETTINGS_MS); },
  async getActiveSessions()        { return apiGet({ action: 'getActiveSessions' }, _API_TIMEOUT_SETTINGS_MS); },
  async clearSession(username)     { return apiPost({ action: 'clearSession', username }, _API_TIMEOUT_SETTINGS_MS); },
  async uploadPhoto(base64, mimeType, filename, institution)              { return apiPost({ action: 'uploadPhoto',    base64, mimeType, filename, institution }); },
  async uploadVolunteerPhoto(base64, mimeType, filename)                  { return apiPost({ action:'uploadVolunteerPhoto', base64, mimeType, filename }); },
  async uploadDocument(base64, mimeType, filename, institution, stipNo)  { return apiPost({ action: 'uploadDocument', base64, mimeType, filename, institution, stipNo }); },
  async getStudentDocs(stipNo)                                           { return apiGet({ action: 'getStudentDocs', stipNo }); },
  async deletePhoto(fileId)   { return apiPost({ action: 'deletePhoto', fileId }); },
  async deleteFile(fileId)    { return apiPost({ action: 'deleteFile',  fileId }); },
  async countBlankRows()      { return apiGet({ action: 'countBlankRows' }); },
  async cleanBlankRows()      { return apiPost({ action: 'cleanBlankRows', reqUser: (getUser()||{}).username||'Admin' }); },
  async findDuplicates()      { return apiGet({ action: 'findDuplicates' }); },
  async mergeStudents(primaryStipNo, mergeStipNo) {
    return apiPost({ action: 'mergeStudents', primaryStipNo, mergeStipNo, reqUser: (getUser()||{}).username||'Admin' });
  },
  async mergeStudentRows(primaryRowIdx, mergeRowIdx) {
    return apiPost({ action: 'mergeStudentRows', primaryRowIdx, mergeRowIdx, reqUser: (getUser()||{}).username||'Admin' });
  },
  async getStudentsForPromotion()        { return apiGet({ action: 'getStudentsForPromotion' }); },
  async getWithdrawalStudents()          { return apiGet({ action: 'getWithdrawalStudents' }); },
  async saveWithdrawalNote(stipNo, note, reqUser) {
    return apiPost({ action: 'saveWithdrawalNote', stipNo, note, reqUser });
  },
  async getPendingScholarshipRequests()  { return apiGet({ action: 'getPendingScholarshipRequests' }); },
  async promoteStudents(promotions, reqUser, promotionDate, sendEmailNotif) {
    return apiPost({ action: 'promoteStudents', promotions, reqUser, promotionDate,
      sendEmailNotif: sendEmailNotif === true });
  },
  async addUniTransfer(data, reqUser) {
    return apiPost({ action: 'addUniTransfer', data, reqUser });
  },
  async changeAdminPassword(username, currentPassword, newPassword) {
    return apiPost({ action: 'changeAdminPassword', username, currentPassword, newPassword });
  },
  async beginStudentFirstLogin(setupToken, email, birthDate, newPassword, confirmations = {}) {
    return apiPost({
      action:'beginStudentFirstLogin', setupToken, email, birthDate, newPassword,
      identityConfirmed:confirmations.identityConfirmed === true,
      birthDateConfirmed:confirmations.birthDateConfirmed === true,
      nonGmailConfirmed:confirmations.nonGmailConfirmed === true
    }, _API_TIMEOUT_SETTINGS_MS);
  },
  async resendStudentFirstLoginCode(setupToken) {
    return apiPost({ action:'resendStudentFirstLoginCode', setupToken }, _API_TIMEOUT_SETTINGS_MS);
  },
  async completeStudentFirstLogin(setupToken, verificationCode) {
    return apiPost({ action:'completeStudentFirstLogin', setupToken, verificationCode }, _API_TIMEOUT_SETTINGS_MS);
  },
  async requestStudentEmailVerification() {
    return apiPost({ action:'requestStudentEmailVerification' }, _API_TIMEOUT_SETTINGS_MS);
  },
  async verifyStudentEmail(verificationCode) {
    return apiPost({ action:'verifyStudentEmail', verificationCode }, _API_TIMEOUT_SETTINGS_MS);
  },
  async requestPasswordReset(identifier, baseUrl, accountType) {
    return apiPost({ action:'requestPasswordReset', identifier, baseUrl, accountType:accountType || 'admin' });
  },
  async confirmPasswordReset(token, newPassword) {
    return apiPost({ action: 'confirmPasswordReset', token, newPassword });
  },
  async getPromotionHistory(batchID) {
    return apiGet({ action: 'getPromotionHistory', batchID: batchID || '' });
  },
  async getStudentPromoHistory(stipNo) {
    return apiGet({ action: 'getStudentPromoHistory', stipNo });
  },
  // Generic helpers for pages that call API.get / API.post directly
  async get(action, params) { return apiGet({ action, ...(params||{}) }); },
  async post(action, body)  { return apiPost({ action, ...body }); },
  // Client-side error/warning logger — fire-and-forget, never throws
  clientLog(userId, action, details) {
    apiPost({ action: 'clientLog', userId, action, details }).catch(() => {});
  },
};

function renderLocalAuditBanner() {
  const live = typeof RDF !== 'undefined' && RDF.LOCAL_LIVE_MODE === true;
  if ((!_apiLocalAuditEnabled() && !live) || typeof document === 'undefined' || !document.body) return;
  let banner = document.getElementById('rdfLocalAuditBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'rdfLocalAuditBanner';
    banner.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:99999;color:#fff;border-radius:999px;padding:8px 14px;font:700 12px/1.2 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.22);pointer-events:none;max-width:calc(100vw - 24px);text-align:center';
    const text = document.createElement('span');
    banner.appendChild(text);
    document.body.appendChild(banner);
  }
  const key=live?'localLiveBanner':'localAuditBanner';
  banner.style.background=live?'#065f46':'#7c2d12';
  banner.style.border=`1px solid ${live?'#6ee7b7':'#fdba74'}`;
  const text = banner.querySelector('span');
  if(text){text.setAttribute('data-t',key);if(typeof t==='function')text.textContent=t(key);}
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', renderLocalAuditBanner);
  else renderLocalAuditBanner();
  document.addEventListener('rdf:languagechange', renderLocalAuditBanner);
}

// ── RDF Client Logger ─────────────────────────────────────────────────────
// Lightweight, async, non-blocking. Dedup is enforced both client-side
// (same message within 10 s) and server-side (same row within 60 s).
//
// Usage (from any page):
//   RDF.logError('student-form.html', 'saveStudent()', 'Failed to save: timeout');
//   RDF.logWarn('settings.html', 'loadAdmins()', 'No admins returned');
// ─────────────────────────────────────────────────────────────────────────
(function() {
  const _recentKeys = new Map(); // key → timestamp for client-side dedup (10 s)
  const DEDUP_MS = 10000;

  function _send(level, page, fn, message) {
    // Build canonical strings
    const action  = level;                               // 'ERROR' | 'WARNING'
    const details = `${message} (${page}${fn ? ' — ' + fn : ''})`;
    const user    = (() => { try { return (getUser()||{}).username || 'anonymous'; } catch(e){ return 'anonymous'; } })();
    const key     = user + '|' + action + '|' + details;

    // Client-side dedup: same key within DEDUP_MS → skip
    const now = Date.now();
    if (_recentKeys.has(key) && now - _recentKeys.get(key) < DEDUP_MS) return;
    _recentKeys.set(key, now);

    // Prune old keys to avoid memory leak (keep ≤ 50)
    if (_recentKeys.size > 50) {
      const oldest = [..._recentKeys.entries()]
        .sort((a, b) => a[1] - b[1]).slice(0, 20).map(e => e[0]);
      oldest.forEach(k => _recentKeys.delete(k));
    }

    // Fire-and-forget — never blocks or throws
    API.clientLog(user, action, details);
  }

  RDF.logError = (page, fn, message) => _send('ERROR',   page, fn, message);
  RDF.logWarn  = (page, fn, message) => _send('WARNING', page, fn, message);
})();

/* ── Shared Loader ── */
function showLoader(show, text) {
  const el = document.getElementById('loader');
  if (!el) return;
  if (text) { const t = document.getElementById('loaderText'); if (t) t.textContent = text; }
  el.classList.toggle('hidden', !show);
}

/* ── Status badge HTML ── */
function statusBadge(status, lang = LANG) {
  const labels = lang === 'en' ? RDF.STATUS_LABELS_EN : RDF.STATUS_LABELS_TH;
  const color  = RDF.STATUS_COLORS[status] || 'badge-gray';
  return `<span class="badge ${color}">${labels[status] || status}</span>`;
}

/* ── Institution label ── */
function instLabel(code) { return RDF.INSTITUTION_LABELS[code] || code || '—'; }

/* ── Convert CE year to BE (Thai) ── */
function ceToBe(year) { return year ? parseInt(year) + 543 : '—'; }
function beToce(year) { return year ? parseInt(year) - 543 : '—'; }

/* ── Academic year list from students ── */
function getAcademicYears(students) {
  const years = new Set();
  students.forEach(s => {
    if (s.scholarshipYear) years.add(s.scholarshipYear);
    if (s.entryYear) years.add(s.entryYear);
  });
  return [...years].sort((a,b) => b - a);
}

/* ── DB Connection Status ── */
let _dbCheckTimer = null;
let _dbStatusState = { key: 'stChecking', ms: null };
function renderDBStatus() {
  const text = document.getElementById('dbStatusText');
  if (text) text.textContent = t(_dbStatusState.key) +
    (_dbStatusState.ms === null ? '' : ` (${_dbStatusState.ms} ms)`);
}
document.addEventListener('rdf:languagechange', renderDBStatus);

async function checkDBConnection() {
  const el  = document.getElementById('dbStatus');
  const txt = document.getElementById('dbStatusText');
  if (!el || !txt) return;

  el.className = 'db-status checking';
  _dbStatusState = { key: 'stChecking', ms: null };
  renderDBStatus();

  const t0 = Date.now();
  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res   = await fetch(RDF.GAS_URL + '?action=ping', { signal: ctrl.signal });
    clearTimeout(timer);
    const data  = await _apiReadJsonResponse(res);
    const ms    = Date.now() - t0;
    if (data.status === 'ok') {
      el.className = 'db-status online';
      _dbStatusState = { key: 'connectionOnline', ms };
      renderDBStatus();
    } else {
      throw new Error('bad response');
    }
  } catch(e) {
    el.className = 'db-status offline';
    _dbStatusState = { key: 'connectionOffline', ms: null };
    renderDBStatus();
  }
}

function initDBStatus() {
  checkDBConnection();
  if (_dbCheckTimer) clearInterval(_dbCheckTimer);
  _dbCheckTimer = setInterval(checkDBConnection, 60000); // re-check every 60s
}

/* ── Check if student has "ทุนต่อ" (continued scholarship) ── */
function isContinuedScholarship(student) {
  const stipNo = student.StipNo || student.stipNo || '';
  const inst   = student.Institution || student.institution || '';
  return inst === 'UNI' && (stipNo.startsWith('MBS_') || stipNo.startsWith('VC_'));
}
