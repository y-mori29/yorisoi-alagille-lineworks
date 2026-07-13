const assert = require('node:assert/strict');
const { requireOcrCapacity, resetForTests } = require('../src/middleware/ocrRateLimit');

function createResponse() {
    const listeners = {};
    return {
        statusCode: 200,
        body: null,
        headers: {},
        set(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
        once(name, callback) { listeners[name] = callback; return this; },
        finish() { listeners.finish?.(); },
    };
}

function run(ip = '203.0.113.10') {
    const response = createResponse();
    let nextCalled = false;
    requireOcrCapacity({ ip }, response, () => { nextCalled = true; });
    return { response, nextCalled };
}

function main() {
    process.env.LAB_OCR_MODE = 'gemini';
    process.env.OCR_PER_ACCOUNT_LIMIT = '2';
    process.env.OCR_DAILY_LIMIT = '3';
    process.env.OCR_CONCURRENCY_LIMIT = '1';
    resetForTests();

    const first = run();
    assert.equal(first.nextCalled, true);

    const concurrent = run('203.0.113.11');
    assert.equal(concurrent.response.statusCode, 429);
    assert.match(concurrent.response.body.error, /混み合って/);
    first.response.finish();

    const second = run();
    assert.equal(second.nextCalled, true);
    second.response.finish();

    const perClient = run();
    assert.equal(perClient.response.statusCode, 429);
    assert.match(perClient.response.body.error, /短時間/);

    const third = run('203.0.113.12');
    assert.equal(third.nextCalled, true);
    third.response.finish();

    const daily = run('203.0.113.13');
    assert.equal(daily.response.statusCode, 429);
    assert.match(daily.response.body.error, /本日/);

    process.env.LAB_OCR_MODE = 'sample';
    const sample = run('203.0.113.14');
    assert.equal(sample.nextCalled, true);

    console.log('account OCR rate limit tests passed');
}

main();
