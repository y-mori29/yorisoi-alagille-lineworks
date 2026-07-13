const assert = require('node:assert/strict');
const { requireSameOriginMutation } = require('../src/middleware/sameOrigin');

function run({ method = 'POST', origin = '', fetchSite = '' } = {}) {
    const req = {
        method,
        protocol: 'https',
        headers: { origin, 'sec-fetch-site': fetchSite },
        get(name) { return name === 'host' ? 'example.run.app' : ''; },
    };
    const response = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
    let nextCalled = false;
    requireSameOriginMutation(req, response, () => { nextCalled = true; });
    return { nextCalled, response };
}

assert.equal(run({ method: 'GET', origin: 'https://evil.example' }).nextCalled, true);
assert.equal(run({ origin: 'https://example.run.app', fetchSite: 'same-origin' }).nextCalled, true);
assert.equal(run({ origin: '', fetchSite: '' }).nextCalled, true);
assert.equal(run({ origin: 'https://evil.example', fetchSite: 'cross-site' }).response.statusCode, 403);
assert.equal(run({ origin: 'https://evil.example', fetchSite: 'same-origin' }).response.statusCode, 403);

console.log('same-origin mutation tests passed');
