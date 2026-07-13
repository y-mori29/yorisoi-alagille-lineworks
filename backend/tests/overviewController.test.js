const assert = require('node:assert');

process.env.FIRESTORE_DATABASE_ID = 'alagille-local';

const { normalizeRange, buildRecentItems, buildPhotoItems, buildDoctorView, doctorViewToText } = require('../src/controllers/overviewController');

assert.deepEqual(normalizeRange({ from: '2026-06-01', to: '2026-07-13' }), { from: '2026-06-01', to: '2026-07-13' });
assert.throws(() => normalizeRange({ from: '2026-07-14', to: '2026-07-13' }), /before/);

const data = {
    visitNotes: [{ id: 'v1', visitDate: '2026-07-10', summary: '診察内容を確認', nextQuestions: ['薬について聞く'] }],
    labs: [{ id: 'l1', testDate: '2026-07-09', category: 'blood', photoObject: 'internal/lab.png', values: [{ name: 'ALT', value: '58', unit: 'U/L', flag: 'H' }] }],
    growth: [{ id: 'g1', measuredAt: '2026-07-08', heightCm: 107.2, weightKg: 17.6, memo: '' }],
    medications: [{ id: 'm1', name: 'ウルソ', status: 'active', photoObject: 'internal/medicine.png', updatedAt: '2026-07-07T00:00:00Z' }],
    dailyLogs: [{ id: 'd1', occurredAt: '2026-07-12T00:00:00Z', category: 'meal', title: '夕食', memo: '', media: [{ id: 'photo-1', mediaType: 'photo', storagePath: 'internal/daily.png' }, { id: 'video-1', mediaType: 'video', storagePath: 'internal/daily.mp4' }] }],
    questions: [{ id: 'q1', text: '夜のかゆみを聞く', category: 'daily', status: 'open' }],
    appointments: [],
};
const recent = buildRecentItems(data);
assert.equal(recent[0].type, 'daily');
assert.ok(recent.every((item) => !/改善|悪化|正常|異常/.test(item.title + item.detail)));

const photos = buildPhotoItems(data, 'p1');
assert.equal(photos.length, 3);
assert.equal(photos[0].category, 'meal');
assert.equal(photos[0].url, '/api/daily-logs/d1/media/photo-1?patientId=p1');
assert.ok(photos.every((item) => !JSON.stringify(item).includes('internal/')));
assert.deepEqual(new Set(photos.map((item) => item.category)), new Set(['meal', 'lab', 'medication']));

const view = buildDoctorView({ patientId: 'p1', patient: { displayName: 'テスト', birthDate: '2020-01-01' }, data, range: { from: '2026-07-01', to: '2026-07-13' } });
assert.equal(view.visitNotes.length, 1);
assert.equal(view.questions.length, 1);
assert.equal(view.aiQuestionCandidates[0].text, '薬について聞く');
const text = doctorViewToText(view, { medications: false });
assert.ok(text.includes('ALT: 58 U/L (H)'));
assert.ok(text.includes('診察メモからの候補'));
assert.ok(!text.includes('■ お薬'));

console.log('overview controller tests passed');
