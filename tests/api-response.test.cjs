const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');

function setup(fetchImpl) {
  const context = {
    RDF: { GAS_URL:'https://example.invalid/exec', LOCAL_AUDIT_MODE:false, INSTITUTION_LABELS:{} },
    fetch: fetchImpl,
    AbortController,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    setInterval,
    localStorage: {
      getItem(key) { return key === 'rdfUser' ? JSON.stringify({ sessionToken:'fixture-token' }) : null; },
      removeItem() {},
    },
    document: { addEventListener() {}, getElementById() { return null; } },
    getUser() { return { username:'tester' }; },
    t(key) { return key === 'apiUnexpectedResponse' ? 'Data service response is invalid.' : key; },
    localizeApiMessage(message) { return message; },
  };
  context.window = { location:{ pathname:'/reports.html', href:'https://example.invalid/reports.html' } };
  vm.createContext(context);
  vm.runInContext(source + ';globalThis.__apiTest={read:_apiReadJsonResponse,get:_apiGetNetwork,post:apiPost};', context);
  return context;
}

test('HTML API responses become a safe localized error instead of a JSON parser error', async () => {
  const context = setup(async () => { throw new Error('unused'); });
  await assert.rejects(
    context.__apiTest.read({ status:200, text:async () => '<!doctype html><title>Google error</title>' }),
    error => error.code === 'API_UNEXPECTED_RESPONSE' &&
      error.message === 'Data service response is invalid.' &&
      !error.message.includes("Unexpected token '<'")
  );
});

test('read requests retry one transient HTML response and then accept JSON', async () => {
  let calls = 0;
  const context = setup(async () => {
    calls++;
    return calls === 1
      ? { status:503, text:async () => '<html>temporarily unavailable</html>' }
      : { status:200, text:async () => JSON.stringify({ status:'success', data:[1] }) };
  });
  const result = await context.__apiTest.get({ action:'getEmploymentReport' }, 2000);
  assert.equal(calls, 2);
  assert.equal(result.status, 'success');
  assert.deepEqual(Array.from(result.data), [1]);
});

test('write requests never retry an HTML response', async () => {
  let calls = 0;
  const context = setup(async () => {
    calls++;
    return { status:503, text:async () => '<html>temporarily unavailable</html>' };
  });
  await assert.rejects(context.__apiTest.post({ action:'saveEmploymentFollowUp' }), error => error.code === 'API_UNEXPECTED_RESPONSE');
  assert.equal(calls, 1);
});

test('legacy GET mutation routes are never retried', async () => {
  let calls = 0;
  const context = setup(async () => {
    calls++;
    return { status:503, text:async () => '<html>temporarily unavailable</html>' };
  });
  await assert.rejects(context.__apiTest.get({ action:'deleteStudent', stipNo:'MBS_001' }, 2000), error => error.code === 'API_UNEXPECTED_RESPONSE');
  assert.equal(calls, 1);
});
