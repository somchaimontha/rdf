const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '../assets/js/api.js'), 'utf8');

test('settings and schema operations use extended request timeouts', () => {
  assert.match(source, /const _API_TIMEOUT_SETTINGS_MS = 120000;/);
  assert.match(source, /const _API_TIMEOUT_SETUP_MS = 300000;/);
  assert.match(source, /const _API_TIMEOUT_MIGRATION_MS = 300000;/);
  assert.match(source, /setupDynamicFieldSchema\(\).*_API_TIMEOUT_SETUP_MS/);
  assert.match(source, /setupEmploymentHistorySchema\(options\).*_API_TIMEOUT_SETUP_MS/);
  assert.match(source, /migrateLegacyEmploymentData\(sourceKeys\).*_API_TIMEOUT_MIGRATION_MS/);
  assert.match(source, /getSystemSettings\(\).*_API_TIMEOUT_SETTINGS_MS/);
  assert.match(source, /saveSetting\(key, values\).*_API_TIMEOUT_SETTINGS_MS/);
});
