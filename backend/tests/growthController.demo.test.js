const assert = require('node:assert/strict');

process.env.DEMO_MODE = '1';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.DEFAULT_TENANT_ID = 'alagille-family';

const controller = require('../src/controllers/growthController');

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function run(handler, req = {}) {
    const res = response();
    await handler({ tenantId: 'alagille-family', query: {}, headers: {}, body: {}, params: {}, ...req }, res);
    return res;
}

async function main() {
    assert.equal((await run(controller.listGrowthRecords)).statusCode, 400);
    assert.equal((await run(controller.createGrowthRecord, { body: { patientId: 'p1', measuredAt: '2026-07-13' } })).statusCode, 400);
    assert.equal((await run(controller.createGrowthRecord, { body: { patientId: 'p1', measuredAt: '2026-07-13', heightCm: 999 } })).statusCode, 400);

    const first = await run(controller.createGrowthRecord, { body: { patientId: 'p1', measuredAt: '2026-06-01', heightCm: 102.3, weightKg: 15.8, memo: '初回' } });
    const second = await run(controller.createGrowthRecord, { body: { patientId: 'p1', measuredAt: '2026-07-01', heightCm: 103.1, weightKg: 16.2 } });
    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 201);

    const list = await run(controller.listGrowthRecords, { query: { patientId: 'p1' } });
    assert.equal(list.body.records.length, 2);
    assert.equal(list.body.records[0].measuredAt, '2026-07-01');

    const trends = await run(controller.getGrowthTrends, { query: { patientId: 'p1' } });
    assert.deepEqual(trends.body.height.map((item) => item.value), [102.3, 103.1]);
    assert.deepEqual(trends.body.weight.map((item) => item.value), [15.8, 16.2]);

    const updated = await run(controller.updateGrowthRecord, { params: { id: second.body.record.id }, body: { patientId: 'p1', measuredAt: '2026-07-02', heightCm: 103.2, weightKg: 16.2, memo: '更新' } });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.record.memo, '更新');

    const deleted = await run(controller.deleteGrowthRecord, { params: { id: first.body.record.id }, query: { patientId: 'p1' } });
    assert.equal(deleted.statusCode, 200);
    assert.equal((await run(controller.listGrowthRecords, { query: { patientId: 'p1' } })).body.records.length, 1);
    assert.deepEqual((await run(controller.listGrowthRecords, { query: { patientId: 'p2' } })).body.records, []);

    console.log('growthController demo tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
