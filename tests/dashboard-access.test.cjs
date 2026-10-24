const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/js/rbac.js'), 'utf8');

function setup(user) {
  const context = {
    getUser: () => user,
    localStorage: { getItem: () => null, setItem() {} },
    console,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\n;globalThis.testRBAC = RBAC;`, context);
  return context.testRBAC;
}

test('student dashboard always exposes the permitted own profile only', () => {
  const user = { role:'Student', stipNo:'MBS_001' };
  const access = setup(user).getStudentDashboardAccess(user, { Status:'Active' }, []);
  assert.equal(access.showProfile, true);
  assert.equal(access.canEditProfile, true);
  assert.equal(access.showSurveys, false);
});

test('student survey menu requires both alumni status and an assignment', () => {
  const user = { role:'Student', stipNo:'MBS_001' };
  const rbac = setup(user);
  assert.equal(rbac.getStudentDashboardAccess(user, { Status:'Active' }, [{ assignmentId:'a1' }]).showSurveys, false);
  assert.equal(rbac.getStudentDashboardAccess(user, { Status:'Graduated' }, []).showSurveys, false);
  assert.equal(rbac.getStudentDashboardAccess(user, { Status:'Graduated' }, [{ assignmentId:'a1' }]).showSurveys, true);
  assert.equal(rbac.getStudentDashboardAccess(user, { status:'University' }, [{ assignmentId:'a2' }]).showSurveys, true);
});

test('non-student accounts never receive student dashboard actions', () => {
  const user = { role:'Manager', stipNo:'' };
  const access = setup(user).getStudentDashboardAccess(user, { Status:'Graduated' }, [{ assignmentId:'a1' }]);
  assert.equal(access.showProfile, false);
  assert.equal(access.showSurveys, false);
});
