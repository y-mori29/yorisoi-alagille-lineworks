const assert = require('node:assert/strict');

process.env.GCS_BUCKET = 'dummy-alagille-test-bucket';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';

const { analyzeVisitNote, sanitizeResult, needsFallback } = require('../src/services/visitNoteAnalysisService');
const { normalizeNote, extractTranscript } = require('../src/controllers/visitNoteController');

function mockAi(responses) {
    const calls = [];
    return {
        calls,
        models: { async generateContent(request) { calls.push(request); return { text: JSON.stringify(responses.shift()) }; } },
    };
}

async function main() {
    const sanitized = sanitizeResult({
        summary: ' 血液検査と、次回の受診について話しました。 ',
        doctorSaid: ['ALTは58でした。'],
        nextQuestions: ['夜のかゆみについて聞く'],
        medicationChanges: [],
        labAndTestTopics: ['ALT 58'],
        growthNutritionTopics: [],
        dailyLifeTopics: ['夜にかゆみがあった'],
        departments: ['小児肝臓外来'],
    });
    assert.equal(sanitized.summary, '血液検査と、次回の受診について話しました。');
    assert.equal(needsFallback(sanitized), false);

    const ai = mockAi([sanitized]);
    const result = await analyzeVisitNote({ transcript: '医師: ALTは58です。家族: 次回、夜のかゆみについて聞きます。', apiKey: 'test', ai, primaryModel: 'primary', fallbackModel: 'fallback' });
    assert.equal(ai.calls.length, 1);
    assert.equal(result.model, 'primary');
    assert.equal(result.nextQuestions[0], '夜のかゆみについて聞く');

    const fallbackAi = mockAi([
        { summary: '', doctorSaid: [], nextQuestions: [], medicationChanges: [], labAndTestTopics: [], growthNutritionTopics: [], dailyLifeTopics: [], departments: [] },
        sanitized,
    ]);
    const fallback = await analyzeVisitNote({ transcript: '診察内容', apiKey: 'test', ai: fallbackAi, primaryModel: 'primary', fallbackModel: 'fallback' });
    assert.equal(fallbackAi.calls.length, 2);
    assert.equal(fallback.model, 'fallback');

    const note = normalizeNote({
        visitDate: '2026-07-13', clinicName: 'よりそい病院', department: '小児科',
        transcript: '診察内容', analysis: sanitized,
    });
    assert.equal(note.visitDate, '2026-07-13');
    assert.equal(note.department, '小児科');
    assert.throws(() => normalizeNote({ visitDate: '', transcript: '内容' }), /visitDate required/);

    const transcript = extractTranscript({ results: { 'gs://bucket/audio.wav': { inlineResult: { transcript: { results: [
        { alternatives: [{ transcript: '最初の発言です。' }] },
        { alternatives: [{ transcript: '次の発言です。' }] },
    ] } } } } }, 'gs://bucket/audio.wav');
    assert.equal(transcript, '最初の発言です。\n次の発言です。');

    console.log('visit note service tests passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
