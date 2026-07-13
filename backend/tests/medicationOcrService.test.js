const assert = require('node:assert/strict');

const {
    extractMedication,
    sanitizeResult,
    needsFallback,
} = require('../src/services/medicationOcrService');

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
    const sanitized = sanitizeResult({
        documentType: 'medication_document',
        imageQuality: 'readable',
        name: ' ウルソデオキシコール酸錠100mg ',
        dosageText: '1回1錠',
        timingText: '朝・夕食後',
        rawText: '患者氏名を含めず薬の記載だけを保持',
        warnings: [],
    });
    assert.equal(sanitized.name, 'ウルソデオキシコール酸錠100mg');
    assert.equal(needsFallback(sanitized), false);

    const primary = mockAi([sanitized]);
    const primaryResult = await extractMedication('data:image/jpeg;base64,YQ==', {
        apiKey: 'test-key',
        ai: primary,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.5-flash',
    });
    assert.equal(primary.calls.length, 1);
    assert.equal(primary.calls[0].model, 'gemini-3.1-flash-lite');
    assert.equal(primary.calls[0].config.responseMimeType, 'application/json');
    assert.equal(primaryResult.model, 'gemini-3.1-flash-lite');

    const fallback = mockAi([
        {
            documentType: 'unknown', imageQuality: 'partially_readable', name: '',
            dosageText: '', timingText: '', rawText: '', warnings: [],
        },
        {
            documentType: 'medication_document', imageQuality: 'readable',
            name: 'ウルソデオキシコール酸錠100mg', dosageText: '1回1錠',
            timingText: '朝・夕食後', rawText: '薬名と用法', warnings: [],
        },
    ]);
    const fallbackResult = await extractMedication('data:image/png;base64,YQ==', {
        apiKey: 'test-key',
        ai: fallback,
        primaryModel: 'gemini-3.1-flash-lite',
        fallbackModel: 'gemini-3.5-flash',
    });
    assert.equal(fallback.calls.length, 2);
    assert.equal(fallback.calls[1].model, 'gemini-3.5-flash');
    assert.equal(fallbackResult.name, 'ウルソデオキシコール酸錠100mg');

    console.log('medicationOcrService tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
