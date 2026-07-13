const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicRoot = path.join(__dirname, '..', 'public');
const login = fs.readFileSync(path.join(publicRoot, 'login.html'), 'utf8');
const home = fs.readFileSync(path.join(publicRoot, 'index.html'), 'utf8');

assert.match(login, /id="register-account-step"/);
assert.match(login, /id="register-profile-step"/);
assert.match(login, /id="register-email"/);
assert.match(login, /id="register-password"/);
assert.match(login, /どなたの記録を始めますか？/);
assert.match(login, /あなたの呼び名/);
assert.match(login, /記録する方の呼び名/);
assert.match(login, /recordTarget:/);
assert.match(login, /relationship: 'other'/);
assert.doesNotMatch(login, /id="birth-date"/);
assert.doesNotMatch(login, /name="avatar"/);
assert.doesNotMatch(login, /健康記録の対象となる方/);
assert.doesNotMatch(login, /アカウントと家族ノートを作る/);

assert.match(home, /method: "PATCH"/);
assert.match(home, /プロフィールを整える/);
assert.match(home, /patient-demo-badge/);
assert.match(home, /accountResult\.account\?\.isDemo/);

console.log('onboarding markup tests passed');
