const assert = require('node:assert/strict');

const {
    extractLabReport,
    parseImageDataUri,
    sanitizeResult,
    needsFallback,
} = require('../src/services/labOcrService');

function mockAi(responses) {
    const calls = [];
    return {
        calls,
        models: {
            async generateContent(request) {
                calls.push(request);
                return { text: JSON.stringify(responses.shift()) };
            },
        },
    };
}

async function main() {
    const image = parseImageDataUri('data:image/jpeg;base64,YQ==');
    assert.equal(image.mimeType, 'image/jpeg');
    assert.equal(image.base64Data, 'YQ==');

    const sanitized = sanitizeResult({
        documentType: 'lab_report',
        imageQuality: 'readable',
        testDate: '2026-07-12',
        hospitalName: ' よりそい病院 ',
        department: '小児科',
        values: [
            { name: 'ALT', value: '58', unit: 'U/L', referenceRange: '9～30', flag: 'h' },
            { name: '', value: '', unit: '', referenceRange: '', flag: 'X' },
        ],
        warnings: ['反射あり'],
    });
    assert.equal(sanitized.hospitalName, 'よりそい病院');
    assert.equal(sanitized.values.length, 1);
    assert.equal(sanitized.values[0].flag, 'H');
    assert.equal(needsFallback(sanitized), false);

    const primary = mockAi([sanitized]);
    const primaryResult = await extractLabReport('data:image/jpeg;base64,YQ==', {
        apiKey: 'test-key',
        ai: primary,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.5-flash',
    });
    assert.equal(primary.calls.length, 1);
    assert.equal(primary.calls[0].model, 'gemini-3.1-flash-lite');
    assert.equal(primaryResult.model, 'gemini-3.1-flash-lite');
    assert.equal(primary.calls[0].config.responseMimeType, 'application/json');

    const fallback = mockAi([
        {
            documentType: 'unknown', imageQuality: 'partially_readable', testDate: '',
            hospitalName: '', department: '', values: [], warnings: [],
        },
        {
            documentType: 'lab_report', imageQuality: 'readable', testDate: '2026-07-12',
            hospitalName: 'よりそい病院', department: '小児科',
            values: [{ name: 'AST', value: '42', unit: 'U/L', referenceRange: '24～43', flag: '' }],
            warnings: [],
        },
    ]);
    const fallbackResult = await extractLabReport('data:image/png;base64,YQ==', {
        apiKey: 'test-key',
        ai: fallback,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.5-flash',
    });
    assert.equal(fallback.calls.length, 2);
    assert.equal(fallback.calls[1].model, 'gemini-3.5-flash');
    assert.equal(fallbackResult.model, 'gemini-3.5-flash');
    assert.equal(fallbackResult.values[0].value, '42');

    console.log('labOcrService tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
