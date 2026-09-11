/* RDF metadata-driven custom fields for student forms and profiles. */
(function () {
  'use strict';

  const state = {
    container: null,
    mode: 'form',
    entityType: 'student',
    entityId: '',
    context: {},
    schema: null,
    current: new Map(),
    original: new Map(),
    records: new Map(),
    removedRecords: new Set(),
    readyPromise: Promise.resolve({ status: 'success' }),
    unloadBound: false,
  };

  const keyOf = (fieldId, recordId) => `${recordId || 'single'}|${fieldId}`;
  const currentLang = () => (typeof LANG !== 'undefined' && LANG === 'en' ? 'en' : 'th');
  const pick = (item, thKey, enKey) => {
    const first = currentLang() === 'en' ? item?.[enKey] : item?.[thKey];
    const second = currentLang() === 'en' ? item?.[thKey] : item?.[enKey];
    return String(first || second || '');
  };
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  };
  const safeId = value => String(value || '').replace(/[^A-Za-z0-9_-]/g, '_');
  const newRecordId = () => `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;

  function injectStyles() {
    if (document.getElementById('rdfDynamicFieldStyles')) return;
    const style = document.createElement('style');
    style.id = 'rdfDynamicFieldStyles';
    style.textContent = `
      .df-section{overflow:hidden;border:1px solid #dbe4f0;background:#fff;border-radius:14px;box-shadow:0 2px 8px rgba(15,23,42,.05)}
      .df-section-header{display:flex;align-items:flex-start;gap:12px;padding:13px 16px;background:linear-gradient(135deg,#334155,#475569);color:#fff}
      .df-section-header h3{font-size:.92rem;font-weight:700;line-height:1.35;margin:0}
      .df-section-description{font-size:.72rem;color:#cbd5e1;margin-top:2px}
      .df-section-body{padding:16px}.df-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .df-field-wide{grid-column:1/-1}.df-label{display:block;font-size:.78rem;font-weight:650;color:#334155;margin-bottom:5px}
      .df-required{color:#dc2626;margin-left:3px}.df-help{font-size:.68rem;color:#64748b;margin-top:4px;line-height:1.35}
      .df-control{width:100%;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font-size:.82rem;background:#fff;color:#1e293b;min-height:38px}
      .df-control:focus{outline:none;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
      .df-control:disabled,.df-control[readonly]{background:#f1f5f9;color:#64748b;cursor:not-allowed}
      .df-choice-list{display:flex;flex-wrap:wrap;gap:8px 14px;padding:7px 0}.df-choice{display:inline-flex;align-items:center;gap:6px;font-size:.8rem;color:#334155}
      .df-error{font-size:.69rem;color:#dc2626;margin-top:4px}.df-invalid .df-control{border-color:#dc2626}
      .df-repeat{border:1px solid #e2e8f0;border-radius:11px;padding:13px;margin-bottom:12px;background:#f8fafc}
      .df-repeat-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;color:#475569;font-size:.74rem;font-weight:700}
      .df-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:8px;padding:7px 11px;font-size:.75rem;font-weight:650;cursor:pointer}
      .df-btn-add{background:#dbeafe;color:#1d4ed8}.df-btn-remove{background:#fee2e2;color:#b91c1c;padding:5px 8px}
      .df-empty{padding:20px;text-align:center;color:#64748b;font-size:.8rem;border:1px dashed #cbd5e1;border-radius:10px}
      .df-profile-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px}
      .df-profile-item{padding:9px 0;border-bottom:1px solid #edf2f7}.df-profile-label{font-size:.7rem;color:#64748b;margin-bottom:2px}.df-profile-value{font-size:.84rem;color:#1e293b;white-space:pre-wrap;overflow-wrap:anywhere}
      .df-profile-repeat{padding:9px 12px;margin:9px 0;border-left:3px solid #64748b;background:#f8fafc;border-radius:7px}
      @media(max-width:720px){.df-field-grid,.df-profile-grid{grid-template-columns:1fr}.df-field-wide{grid-column:auto}}
      @media print{.df-btn{display:none!important}.df-section{box-shadow:none;break-inside:avoid}.df-section-header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `;
    document.head.appendChild(style);
  }

  function normalizeValue(field, value) {
    if (field.fieldType === 'multiselect') {
      if (Array.isArray(value)) return JSON.stringify(value.map(String));
      try {
        const parsed = JSON.parse(value || '[]');
        return JSON.stringify(Array.isArray(parsed) ? parsed.map(String) : []);
      } catch (_) { return '[]'; }
    }
    if (field.fieldType === 'boolean' || field.fieldType === 'checkbox') {
      return ['true', '1', 'yes', 'on'].includes(String(value || '').toLowerCase()) ? 'true' : 'false';
    }
    return String(value ?? '');
  }

  function initValues(schema) {
    state.current.clear();
    state.original.clear();
    state.records.clear();
    state.removedRecords.clear();
    const fieldMap = new Map(schema.fields.map(field => [field.fieldId, field]));
    const values = Array.isArray(schema.values) ? schema.values : [];
    values.forEach(item => {
      const field = fieldMap.get(item.fieldId);
      if (!field) return;
      const recordId = item.recordId || 'single';
      const key = keyOf(item.fieldId, recordId);
      const value = normalizeValue(field, item.value);
      state.current.set(key, value);
      state.original.set(key, value);
    });
    schema.sections.forEach(section => {
      if (section.cardinality !== 'repeatable') {
        state.records.set(section.sectionId, ['single']);
        return;
      }
      const ids = [];
      values.forEach(item => {
        const field = fieldMap.get(item.fieldId);
        if (field?.sectionId === section.sectionId && item.recordId && item.recordId !== 'single' && !ids.includes(item.recordId)) ids.push(item.recordId);
      });
      if (!ids.length && state.mode === 'form') ids.push(newRecordId());
      state.records.set(section.sectionId, ids);
    });
    schema.fields.forEach(field => {
      const section = schema.sections.find(item => item.sectionId === field.sectionId);
      const ids = state.records.get(field.sectionId) || (section?.cardinality === 'repeatable' ? [] : ['single']);
      ids.forEach(recordId => {
        const key = keyOf(field.fieldId, recordId);
        if (!state.current.has(key)) state.current.set(key, normalizeValue(field, field.defaultValue || ''));
      });
    });
  }

  function coreContext() {
    try {
      const value = typeof state.context === 'function' ? state.context() : state.context;
      return value && typeof value === 'object' ? value : {};
    } catch (_) { return {}; }
  }

  function customContext(recordId) {
    const values = {};
    (state.schema?.fields || []).forEach(field => {
      const own = state.current.get(keyOf(field.fieldId, recordId));
      const single = state.current.get(keyOf(field.fieldId, 'single'));
      values[field.fieldId] = own !== undefined ? parseComparable(field, own) : parseComparable(field, single);
      values[field.fieldKey] = values[field.fieldId];
    });
    return values;
  }

  function parseComparable(field, value) {
    if (field?.fieldType === 'multiselect') {
      try { return JSON.parse(value || '[]'); } catch (_) { return []; }
    }
    return value ?? '';
  }

  function compare(condition, actual) {
    const operator = condition?.operator || 'equals';
    const expected = condition?.value ?? '';
    const actualArray = Array.isArray(actual) ? actual.map(String) : null;
    const actualText = actualArray ? actualArray.join(',') : String(actual ?? '');
    const expectedList = Array.isArray(expected) ? expected.map(String) : String(expected).split(',').map(item => item.trim());
    if (operator === 'equals') return actualText === String(expected);
    if (operator === 'not_equals') return actualText !== String(expected);
    if (operator === 'contains') return actualArray ? actualArray.includes(String(expected)) : actualText.toLowerCase().includes(String(expected).toLowerCase());
    if (operator === 'in') return expectedList.includes(actualText);
    if (operator === 'not_in') return !expectedList.includes(actualText);
    if (operator === 'is_empty') return !actualArray?.length && actualText.trim() === '';
    if (operator === 'is_not_empty') return actualArray ? actualArray.length > 0 : actualText.trim() !== '';
    return false;
  }

  function rulesPass(rules, recordId) {
    const conditions = Array.isArray(rules?.conditions) ? rules.conditions : [];
    if (!conditions.length) return true;
    const core = coreContext();
    const custom = customContext(recordId || 'single');
    const results = conditions.map(condition => {
      const source = condition.source === 'custom' ? custom : core;
      return compare(condition, source?.[condition.field]);
    });
    return String(rules.logic || 'AND').toUpperCase() === 'OR' ? results.some(Boolean) : results.every(Boolean);
  }

  function fieldOptions(fieldId) {
    return (state.schema?.options || []).filter(option => option.fieldId === fieldId);
  }

  function controlValue(field, root) {
    if (field.fieldType === 'radio') return root.querySelector('input:checked')?.value || '';
    const el = root.querySelector('[data-df-input]');
    if (!el) return '';
    if (field.fieldType === 'multiselect') return JSON.stringify([...el.selectedOptions].map(option => option.value));
    if (field.fieldType === 'boolean' || field.fieldType === 'checkbox') return el.checked ? 'true' : 'false';
    return el.value;
  }

  function bindValue(field, recordId, root) {
    const update = () => {
      state.current.set(keyOf(field.fieldId, recordId), normalizeValue(field, controlValue(field, root)));
      clearFieldError(root);
      refreshVisibility();
    };
    root.querySelectorAll('input,select,textarea').forEach(el => {
      el.addEventListener(el.tagName === 'INPUT' && !['checkbox', 'radio'].includes(el.type) ? 'input' : 'change', update);
    });
  }

  function setControlValue(field, root, rawValue) {
    const normalized = normalizeValue(field, rawValue);
    if (field.fieldType === 'radio') {
      root.querySelectorAll('input[type="radio"]').forEach(el => { el.checked = el.value === normalized; });
      return;
    }
    const el = root.querySelector('[data-df-input]');
    if (!el) return;
    if (field.fieldType === 'multiselect') {
      let selected = [];
      try { selected = JSON.parse(normalized); } catch (_) {}
      [...el.options].forEach(option => { option.selected = selected.includes(option.value); });
    } else if (field.fieldType === 'boolean' || field.fieldType === 'checkbox') {
      el.checked = normalized === 'true';
    } else {
      el.value = normalized;
    }
  }

  function buildControl(field, recordId, wrapper) {
    const id = `df_${safeId(field.fieldId)}_${safeId(recordId)}`;
    const options = fieldOptions(field.fieldId);
    let control;
    if (field.fieldType === 'textarea') {
      control = make('textarea', 'df-control'); control.rows = 3;
    } else if (field.fieldType === 'select' || field.fieldType === 'multiselect') {
      control = make('select', 'df-control');
      if (field.fieldType === 'multiselect') control.multiple = true;
      if (field.fieldType === 'select' && !field.required) control.appendChild(new Option('—', ''));
      options.forEach(option => control.appendChild(new Option(pick(option, 'labelTH', 'labelEN') || option.value, option.value)));
    } else if (field.fieldType === 'radio') {
      control = make('div', 'df-choice-list');
      options.forEach((option, index) => {
        const label = make('label', 'df-choice');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = id; input.value = option.value; input.id = `${id}_${index}`;
        input.dataset.dfInput = '1'; input.disabled = !field.canEdit;
        label.append(input, document.createTextNode(pick(option, 'labelTH', 'labelEN') || option.value));
        control.appendChild(label);
      });
    } else if (field.fieldType === 'boolean' || field.fieldType === 'checkbox') {
      control = make('label', 'df-choice');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.id = id; input.dataset.dfInput = '1';
      const labelText = make('span', '', t('dfYesEnabled'));
      control.append(input, labelText);
    } else {
      control = document.createElement('input');
      const typeMap = { number: 'number', decimal: 'number', email: 'email', tel: 'tel', date: 'date', datetime: 'datetime-local', url: 'url', hidden: 'hidden' };
      control.type = typeMap[field.fieldType] || 'text';
      control.className = field.fieldType === 'hidden' ? '' : 'df-control';
      if (field.fieldType === 'decimal') control.step = 'any';
      control.id = id; control.dataset.dfInput = '1';
    }
    if (control.matches?.('input,select,textarea')) {
      control.id ||= id; control.dataset.dfInput = '1';
      const placeholder = pick(field, 'placeholderTH', 'placeholderEN');
      if (placeholder) control.placeholder = placeholder;
      control.disabled = !field.canEdit;
      if (field.fieldType === 'readonly') { control.disabled = false; control.readOnly = true; }
      if (field.minLength !== null && field.minLength !== undefined) control.minLength = Number(field.minLength);
      if (field.maxLength !== null && field.maxLength !== undefined) control.maxLength = Number(field.maxLength);
      if (field.minValue !== null && field.minValue !== undefined) control.min = field.minValue;
      if (field.maxValue !== null && field.maxValue !== undefined) control.max = field.maxValue;
    }
    wrapper.appendChild(control);
    setControlValue(field, wrapper, state.current.get(keyOf(field.fieldId, recordId)) ?? field.defaultValue ?? '');
    bindValue(field, recordId, wrapper);
  }

  function buildFormField(field, recordId) {
    const wrapper = make('div', ['textarea', 'multiselect'].includes(field.fieldType) ? 'df-field df-field-wide' : 'df-field');
    wrapper.dataset.dfField = field.fieldId;
    wrapper.dataset.dfRecord = recordId;
    if (field.fieldType === 'hidden') wrapper.hidden = true;
    const label = make('label', 'df-label', pick(field, 'labelTH', 'labelEN'));
    if (field.required) label.appendChild(make('span', 'df-required', '*'));
    wrapper.appendChild(label);
    buildControl(field, recordId, wrapper);
    const help = pick(field, 'helpTextTH', 'helpTextEN') || pick(field, 'descriptionTH', 'descriptionEN');
    if (help) wrapper.appendChild(make('div', 'df-help', help));
    const error = make('div', 'df-error'); error.hidden = true; error.setAttribute('aria-live', 'polite');
    wrapper.appendChild(error);
    return wrapper;
  }

  function formatProfileValue(field, rawValue) {
    const value = normalizeValue(field, rawValue);
    if (!value || (field.fieldType === 'multiselect' && value === '[]')) return '';
    if (field.fieldType === 'boolean' || field.fieldType === 'checkbox') return value === 'true' ? t('yes') : t('no');
    const options = fieldOptions(field.fieldId);
    const optionLabel = item => pick(item, 'labelTH', 'labelEN') || item.value;
    if (field.fieldType === 'multiselect') {
      let selected = [];
      try { selected = JSON.parse(value); } catch (_) {}
      return selected.map(item => optionLabel(options.find(option => option.value === item) || { value: item })).join(', ');
    }
    if (['select', 'radio'].includes(field.fieldType)) {
      const option = options.find(item => item.value === value);
      return option ? optionLabel(option) : value;
    }
    if (field.fieldType === 'date' || field.fieldType === 'datetime') {
      const date = new Date(field.fieldType === 'date' ? `${value}T00:00:00` : value);
      if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(currentLang() === 'en' ? 'en-GB' : 'th-TH', field.fieldType === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }
    return value;
  }

  function buildProfileFields(fields, recordId) {
    const grid = make('div', 'df-profile-grid');
    fields.forEach(field => {
      if (!rulesPass(field.visibilityRules, recordId)) return;
      const value = formatProfileValue(field, state.current.get(keyOf(field.fieldId, recordId)));
      if (!value || field.fieldType === 'hidden') return;
      const item = make('div', 'df-profile-item');
      item.dataset.dfField = field.fieldId; item.dataset.dfRecord = recordId;
      item.append(make('div', 'df-profile-label', pick(field, 'labelTH', 'labelEN')), make('div', 'df-profile-value', value));
      grid.appendChild(item);
    });
    return grid;
  }

  function addRecord(section) {
    const id = newRecordId();
    const records = state.records.get(section.sectionId) || [];
    records.push(id); state.records.set(section.sectionId, records);
    (state.schema.fields || []).filter(field => field.sectionId === section.sectionId).forEach(field => {
      state.current.set(keyOf(field.fieldId, id), normalizeValue(field, field.defaultValue || ''));
    });
    render();
  }

  function removeRecord(section, recordId) {
    const records = (state.records.get(section.sectionId) || []).filter(id => id !== recordId);
    state.records.set(section.sectionId, records);
    const hadStoredValue = [...state.original.keys()].some(key => key.startsWith(`${recordId}|`));
    if (hadStoredValue) state.removedRecords.add(recordId);
    (state.schema.fields || []).filter(field => field.sectionId === section.sectionId).forEach(field => state.current.delete(keyOf(field.fieldId, recordId)));
    render();
  }

  function buildSection(section) {
    const fields = (state.schema.fields || []).filter(field => field.sectionId === section.sectionId);
    const recordIds = state.records.get(section.sectionId) || [];
    if (!rulesPass(section.visibilityRules, 'single')) return null;
    const card = make('section', 'df-section mb-4'); card.dataset.dfSection = section.sectionId;
    const header = make('div', 'df-section-header');
    const icon = make('div', '', '＋'); icon.setAttribute('aria-hidden', 'true');
    const heading = make('div');
    heading.appendChild(make('h3', '', pick(section, 'nameTH', 'nameEN')));
    const description = pick(section, 'descriptionTH', 'descriptionEN');
    if (description) heading.appendChild(make('div', 'df-section-description', description));
    header.append(icon, heading);
    if (state.mode === 'form' && section.cardinality === 'repeatable') {
      const add = make('button', 'df-btn df-btn-add ml-auto', t('dfAddRecord')); add.type = 'button';
      add.addEventListener('click', () => addRecord(section)); header.appendChild(add);
    }
    const body = make('div', 'df-section-body');
    if (section.cardinality === 'repeatable') {
      if (!recordIds.length) body.appendChild(make('div', 'df-empty', t('dfNoRecords')));
      recordIds.forEach((recordId, index) => {
        if (state.mode === 'profile') {
          const grid = buildProfileFields(fields, recordId);
          if (!grid.children.length) return;
          const repeat = make('div', 'df-profile-repeat');
          repeat.append(make('div', 'df-repeat-head', `${t('dfRecord')} ${index + 1}`), grid);
          body.appendChild(repeat);
          return;
        }
        const repeat = make('div', 'df-repeat');
        const repeatHead = make('div', 'df-repeat-head');
        repeatHead.appendChild(make('span', '', `${t('dfRecord')} ${index + 1}`));
        const remove = make('button', 'df-btn df-btn-remove', t('dfRemoveRecord')); remove.type = 'button';
        remove.addEventListener('click', () => removeRecord(section, recordId)); repeatHead.appendChild(remove);
        const grid = make('div', 'df-field-grid'); fields.forEach(field => grid.appendChild(buildFormField(field, recordId)));
        repeat.append(repeatHead, grid); body.appendChild(repeat);
      });
    } else if (state.mode === 'profile') {
      const grid = buildProfileFields(fields, 'single');
      if (!grid.children.length) return null;
      body.appendChild(grid);
    } else {
      const grid = make('div', 'df-field-grid'); fields.forEach(field => grid.appendChild(buildFormField(field, 'single'))); body.appendChild(grid);
    }
    if (state.mode === 'profile' && !body.children.length) return null;
    card.append(header, body);
    return card;
  }

  function render() {
    if (!state.container || !state.schema) return;
    state.container.replaceChildren();
    const fragment = document.createDocumentFragment();
    (state.schema.sections || []).forEach(section => {
      const card = buildSection(section);
      if (card) fragment.appendChild(card);
    });
    state.container.appendChild(fragment);
    state.container.hidden = !state.container.children.length;
    refreshVisibility();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function refreshVisibility() {
    if (!state.container || !state.schema || state.mode !== 'form') return;
    state.container.querySelectorAll('[data-df-section]').forEach(sectionEl => {
      const section = state.schema.sections.find(item => item.sectionId === sectionEl.dataset.dfSection);
      sectionEl.hidden = !section || !rulesPass(section.visibilityRules, 'single');
    });
    state.container.querySelectorAll('[data-df-field]').forEach(fieldEl => {
      const field = state.schema.fields.find(item => item.fieldId === fieldEl.dataset.dfField);
      const sectionEl = fieldEl.closest('[data-df-section]');
      const shown = !!field && !sectionEl?.hidden && rulesPass(field.visibilityRules, fieldEl.dataset.dfRecord || 'single');
      fieldEl.hidden = !shown || field?.fieldType === 'hidden';
      if (!shown) clearFieldError(fieldEl);
    });
  }

  function clearFieldError(wrapper) {
    wrapper?.classList.remove('df-invalid');
    const error = wrapper?.querySelector('.df-error');
    if (error) { error.hidden = true; error.textContent = ''; }
  }

  function validationMessage(field, code) {
    const custom = pick(field, 'validationMessageTH', 'validationMessageEN');
    if (custom) return custom;
    const messages = {
      REQUIRED: 'dfValidationRequired', MIN_LENGTH: 'dfValidationMinLength', MAX_LENGTH: 'dfValidationMaxLength',
      NUMBER: 'dfValidationNumber', DECIMAL: 'dfValidationNumber', MIN_VALUE: 'dfValidationMinValue',
      MAX_VALUE: 'dfValidationMaxValue', EMAIL: 'dfValidationEmail', TEL: 'dfValidationTel',
      URL: 'dfValidationUrl', PATTERN: 'dfValidationPattern', OPTION: 'dfValidationOption', DATE: 'dfValidationDate', DATETIME: 'dfValidationDate'
    };
    return t(messages[code] || 'dfValidationInvalid');
  }

  function validateValue(field, raw) {
    const value = normalizeValue(field, raw);
    const empty = value === '' || (field.fieldType === 'multiselect' && value === '[]');
    if (empty) return field.required ? 'REQUIRED' : '';
    if (field.minLength !== null && field.minLength !== undefined && value.length < Number(field.minLength)) return 'MIN_LENGTH';
    if (field.maxLength !== null && field.maxLength !== undefined && value.length > Number(field.maxLength)) return 'MAX_LENGTH';
    if (field.fieldType === 'number' && !/^-?\d+$/.test(value)) return 'NUMBER';
    if (field.fieldType === 'decimal' && !/^-?(?:\d+|\d*\.\d+)$/.test(value)) return 'DECIMAL';
    if (['number', 'decimal'].includes(field.fieldType)) {
      const number = Number(value);
      if (field.minValue !== null && field.minValue !== undefined && number < Number(field.minValue)) return 'MIN_VALUE';
      if (field.maxValue !== null && field.maxValue !== undefined && number > Number(field.maxValue)) return 'MAX_VALUE';
    }
    if (field.fieldType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'EMAIL';
    if (field.fieldType === 'tel' && !/^[0-9+()\-\s]{6,30}$/.test(value)) return 'TEL';
    if (field.fieldType === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'DATE';
    if (field.fieldType === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return 'DATETIME';
    if (field.fieldType === 'url' && !/^https?:\/\/[^\s]+$/i.test(value)) return 'URL';
    const allowedOptions = fieldOptions(field.fieldId).map(option => option.value);
    if (['select', 'radio'].includes(field.fieldType) && !allowedOptions.includes(value)) return 'OPTION';
    if (field.fieldType === 'multiselect') {
      let selected;
      try { selected = JSON.parse(value); } catch (_) { return 'OPTION'; }
      if (!Array.isArray(selected) || selected.some(option => !allowedOptions.includes(String(option)))) return 'OPTION';
    }
    if (field.validationPattern) {
      try { if (!new RegExp(field.validationPattern).test(value)) return 'PATTERN'; } catch (_) { return 'PATTERN'; }
    }
    return '';
  }

  function validate() {
    if (!state.schema || state.mode !== 'form') return { valid: true };
    refreshVisibility();
    let firstInvalid = null;
    state.container.querySelectorAll('[data-df-field]').forEach(wrapper => {
      clearFieldError(wrapper);
      if (wrapper.hidden || wrapper.closest('[data-df-section]')?.hidden) return;
      const field = state.schema.fields.find(item => item.fieldId === wrapper.dataset.dfField);
      if (!field?.canEdit) return;
      const value = state.current.get(keyOf(field.fieldId, wrapper.dataset.dfRecord || 'single'));
      const code = validateValue(field, value);
      if (!code) return;
      wrapper.classList.add('df-invalid');
      const error = wrapper.querySelector('.df-error');
      if (error) { error.textContent = validationMessage(field, code); error.hidden = false; }
      firstInvalid ||= wrapper;
    });
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
      firstInvalid.querySelector('input,select,textarea')?.focus();
      return { valid: false, message: t('dfPleaseCheckFields') };
    }
    return { valid: true };
  }

  function visibleEditableKey(field, recordId) {
    if (!field.canEdit || state.removedRecords.has(recordId)) return false;
    const section = state.schema.sections.find(item => item.sectionId === field.sectionId);
    return !!section && rulesPass(section.visibilityRules, 'single') && rulesPass(field.visibilityRules, recordId);
  }

  function changes() {
    const result = [];
    (state.schema?.fields || []).forEach(field => {
      const recordIds = state.records.get(field.sectionId) || ['single'];
      recordIds.forEach(recordId => {
        if (!visibleEditableKey(field, recordId)) return;
        const key = keyOf(field.fieldId, recordId);
        const value = normalizeValue(field, state.current.get(key) ?? '');
        const old = state.original.has(key) ? normalizeValue(field, state.original.get(key)) : normalizeValue(field, '');
        if (value !== old) result.push({ fieldId: field.fieldId, recordId, value });
      });
    });
    return result;
  }

  function hasChanges() {
    return state.removedRecords.size > 0 || changes().length > 0;
  }

  async function save(entityId) {
    await state.readyPromise;
    if (!state.schema || state.schema.setupRequired) return { status: 'success', changed: 0 };
    const validation = validate();
    if (!validation.valid) return { status: 'error', code: 'CLIENT_VALIDATION', message: validation.message };
    const pending = changes();
    if (!pending.length && !state.removedRecords.size) return { status: 'success', changed: 0 };
    const result = await API.saveStudentDynamicValues(state.entityType, entityId || state.entityId, pending, [...state.removedRecords]);
    if (result.status === 'success') {
      state.entityId = entityId || state.entityId;
      state.original = new Map(state.current);
      state.removedRecords.clear();
    }
    return result;
  }

  async function load(options) {
    state.container = document.getElementById(options.containerId);
    if (!state.container) return { status: 'error', code: 'CONTAINER_NOT_FOUND' };
    injectStyles();
    state.mode = options.mode || 'form'; state.entityType = options.entityType || 'student';
    state.entityId = String(options.entityId || ''); state.context = options.context || options.getContext || {};
    state.container.hidden = false;
    state.container.replaceChildren(make('div', 'df-empty', t('dfLoading')));
    try {
      const result = await API.getDynamicFormSchema(state.entityType, state.entityId);
      if (result.status !== 'success') throw new Error(result.message || t('dfLoadError'));
      state.schema = result;
      if (result.setupRequired || !result.sections?.length) {
        state.container.replaceChildren(); state.container.hidden = true;
        return result;
      }
      initValues(result); render();
      if (state.mode === 'form' && !state.unloadBound) {
        window.addEventListener('beforeunload', event => {
          if (!hasChanges()) return;
          event.preventDefault(); event.returnValue = '';
        });
        state.unloadBound = true;
      }
      return result;
    } catch (error) {
      state.schema = null;
      const alert = make('div', 'df-empty', t('dfLoadError'));
      alert.title = error?.message || '';
      state.container.replaceChildren(alert); state.container.hidden = false;
      return { status: 'error', message: error?.message || t('dfLoadError') };
    }
  }

  function initForm(options) {
    state.readyPromise = load({ ...options, mode: 'form' });
    return state.readyPromise;
  }

  function initProfile(options) {
    state.readyPromise = load({ ...options, mode: 'profile' });
    return state.readyPromise;
  }

  document.addEventListener('rdf:languagechange', () => { if (state.schema) render(); });

  window.DynamicFields = {
    initForm,
    initProfile,
    ready: () => state.readyPromise,
    refreshVisibility,
    validate,
    hasChanges,
    save,
    _state: state,
    _rulesPass: rulesPass,
  };
})();
