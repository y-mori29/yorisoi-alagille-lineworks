const assert = require('node:assert/strict');

process.env.DEMO_MODE = '1';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.GCS_BUCKET = 'dummy-alagille-test-bucket';
process.env.DEFAULT_TENANT_ID = 'alagille-family';

const controller = require('../src/controllers/medicationController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

async function run(handler, req = {}) {
    const response = createResponse();
    await handler({
        tenantId: 'alagille-family',
        query: {},
        headers: {},
        body: {},
        params: {},
        ...req,
    }, response);
    return response;
}

async function main() {
    const missingPatient = await run(controller.listMedications);
    assert.equal(missingPatient.statusCode, 400);

    const before = await run(controller.listMedications, { query: { patientId: 'demo-haruto' } });
    assert.equal(before.statusCode, 200);
    assert.deepEqual(before.body.medications, []);

    const invalid = await run(controller.createMedication, { body: { patientId: 'demo-haruto', name: '' } });
    assert.equal(invalid.statusCode, 400);

    const created = await run(controller.createMedication, {
        body: {
            patientId: 'demo-haruto',
            name: 'ウルソデオキシコール酸',
            dosageText: '1回1錠',
            timingText: '朝・夕食後',
            startedAt: '2026-07-12',
            memo: '処方内容を転記',
        },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.medication.status, 'active');
    assert.equal(created.body.medication.source, 'manual');

    const updated = await run(controller.updateMedication, {
        params: { id: created.body.medication.id },
        body: {
            patientId: 'demo-haruto',
            name: 'ウルソデオキシコール酸',
            dosageText: '1回2錠',
            timingText: '朝・夕食後',
            status: 'stopped',
            stoppedAt: '2026-07-13',
        },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.medication.dosageText, '1回2錠');
    assert.equal(updated.body.medication.status, 'stopped');

    const checked = await run(controller.createMedicationCheck, {
        params: { id: created.body.medication.id },
        body: { patientId: 'demo-haruto', status: 'taken' },
    });
    assert.equal(checked.statusCode, 201);
    assert.equal(checked.body.check.status, 'taken');

    const after = await run(controller.listMedications, { query: { patientId: 'demo-haruto' } });
    assert.equal(after.body.medications.length, 1);
    assert.equal(after.body.medications[0].checks.length, 1);
    assert.equal(after.body.medications[0].lastCheck.status, 'taken');

    const otherPatient = await run(controller.listMedications, { query: { patientId: 'demo-other' } });
    assert.deepEqual(otherPatient.body.medications, []);

    const deleted = await run(controller.deleteMedication, {
        params: { id: created.body.medication.id },
        query: { patientId: 'demo-haruto' },
    });
    assert.equal(deleted.statusCode, 200);
    const final = await run(controller.listMedications, { query: { patientId: 'demo-haruto' } });
    assert.deepEqual(final.body.medications, []);

    console.log('medicationController demo tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
