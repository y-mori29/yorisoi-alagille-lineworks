const assert = require('node:assert/strict');
const { requireAlagilleApiAllowlist } = require('../src/middleware/alagilleApiAllowlist');

function run(method, path, demoMode = '0', alagilleMode = '1') {
    process.env.DEMO_MODE = demoMode;
    process.env.ALAGILLE_API_MODE = alagilleMode;
    let nextCalled = false;
    const response = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };

    requireAlagilleApiAllowlist({ method, path }, response, () => { nextCalled = true; });
    return { nextCalled, response };
}

function main() {
    for (const [method, path] of [
        ['GET', '/config'],
        ['POST', '/account/session'],
        ['GET', '/test'],
        ['POST', '/family/patients'],
        ['POST', '/labs/ocr'],
        ['GET', '/photos'],
        ['DELETE', '/medications/med-1'],
        ['GET', '/patients/liff-config'],
    ]) {
        assert.equal(run(method, path).nextCalled, true, `${method} ${path} should be allowed`);
    }

    for (const [method, path] of [
        ['POST', '/patients/liff-config'],
        ['POST', '/patients/session'],
        ['GET', '/templates'],
        ['GET', '/recordings'],
        ['GET', '/admin/users'],
    ]) {
        const result = run(method, path);
        assert.equal(result.nextCalled, false, `${method} ${path} should be blocked`);
        assert.equal(result.response.statusCode, 403);
    }

    assert.equal(run('GET', '/admin/users', '0', '0').nextCalled, true);
    console.log('alagilleApiAllowlist tests passed');
}

main();
