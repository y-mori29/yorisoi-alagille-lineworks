const assert = require('node:assert/strict');

process.env.DEMO_MODE = '1';
process.env.LAB_OCR_MODE = 'sample';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.GCS_BUCKET = 'dummy-alagille-test-bucket';
process.env.DEFAULT_TENANT_ID = 'alagille-family';

const controller = require('../src/controllers/labController');

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
        ...req,
    }, response);
    return response;
}

async function main() {
    const missingPatient = await run(controller.listLabs);
    assert.equal(missingPatient.statusCode, 400);

    const before = await run(controller.listLabs, { query: { patientId: 'demo-haruto' } });
    assert.equal(before.statusCode, 200);
    assert.equal(before.body.records.length, 0);

    const tutorial = await run(controller.getLabTutorial);
    assert.equal(tutorial.body.records.length, 3);
    assert.match(tutorial.body.sampleImageUrl, /lab-report-tutorial-sample-v3/);

    const ocr = await run(controller.readLabImage, {
        body: { patientId: 'demo-haruto', photoDataUrl: 'data:image/jpeg;base64,YQ==' },
    });
    assert.equal(ocr.statusCode, 200);
    assert.equal(ocr.body.status, 'needs_review');
    assert.equal(ocr.body.values.length, 8);
    assert.equal(ocr.body.hospitalName, 'よりそい総合医療センター');
    assert.equal(ocr.body.values[0].value, '1.8');
    assert.equal(ocr.body.values[0].flag, 'H');
    assert.equal(ocr.body.values[6].flag, 'L');
    assert.ok(ocr.body.values.every((item) => item.referenceRange));

    const invalid = await run(controller.createLab, { body: { patientId: 'demo-haruto' } });
    assert.equal(invalid.statusCode, 400);

    const created = await run(controller.createLab, {
        body: {
            patientId: 'demo-haruto',
            testDate: '2026-07-12',
            photoDataUrl: 'data:image/jpeg;base64,YQ==',
            values: [{ name: 'ALT (GPT)', value: '22', unit: 'U/L' }],
        },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.record.values[0].value, '22');
    assert.equal(created.body.record.testDate, '2026-07-12');
    assert.equal(created.body.record.photoDataUrl, undefined);
    assert.equal(created.body.record.photoRetained, false);

    const emptyPhotoOnly = await run(controller.createLab, {
        body: { patientId: 'demo-haruto', testDate: '2026-07-12', photoDataUrl: 'data:image/jpeg;base64,YQ==' },
    });
    assert.equal(emptyPhotoOnly.statusCode, 400);

    const after = await run(controller.listLabs, { query: { patientId: 'demo-haruto' } });
    assert.equal(after.body.records.length, 1);
    assert.equal(after.body.records[0].testDate, '2026-07-12');

    const trends = await run(controller.getLabTrends, { query: { patientId: 'demo-haruto' } });
    assert.equal(trends.statusCode, 200);
    assert.equal(trends.body.series[0].name, 'ALT (GPT)');
    assert.equal(trends.body.series[0].points[0].value, 22);

    const updated = await run(controller.updateLab, {
        params: { id: created.body.record.id },
        body: { patientId: 'demo-haruto', testDate: '2026-07-13', hospitalName: '更新病院', values: [{ name: 'ALT (GPT)', value: '21', unit: 'U/L' }] },
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.body.record.hospitalName, '更新病院');
    assert.equal(updated.body.record.values[0].value, '21');

    const deleted = await run(controller.deleteLab, {
        params: { id: created.body.record.id },
        query: { patientId: 'demo-haruto' },
    });
    assert.equal(deleted.statusCode, 200);
    const final = await run(controller.listLabs, { query: { patientId: 'demo-haruto' } });
    assert.equal(final.body.records.length, 0);

    console.log('labController demo tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
