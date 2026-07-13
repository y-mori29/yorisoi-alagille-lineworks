const assert = require('node:assert');

process.env.DEMO_MODE = '1';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.GCS_BUCKET = 'dummy-alagille-local-bucket';

const { normalizeDailyLog, parseKeepMediaIds, validateFiles } = require('../src/controllers/dailyLogController');

const normalized = normalizeDailyLog({ occurredAt: '2026-07-13T09:30:00+09:00', category: 'itch', title: '夜のかゆみ', memo: '少し強かった' });
assert.equal(normalized.category, 'itch');
assert.equal(normalized.title, '夜のかゆみ');
assert.ok(normalized.occurredAt.endsWith('Z'));

assert.equal(normalizeDailyLog({ occurredAt: '2026-07-13', category: 'unknown', memo: '記録' }).category, 'other');
assert.throws(() => normalizeDailyLog({ occurredAt: 'invalid', memo: '記録' }), /occurredAt required/);
assert.throws(() => normalizeDailyLog({ occurredAt: '2026-07-13', title: '', memo: '' }, 0), /memo or media required/);
assert.doesNotThrow(() => normalizeDailyLog({ occurredAt: '2026-07-13', title: '', memo: '' }, 1));

const media = [{ id: 'a' }, { id: 'b' }];
assert.deepEqual(parseKeepMediaIds(undefined, media), ['a', 'b']);
assert.deepEqual(parseKeepMediaIds('["b"]', media), ['b']);
assert.throws(() => parseKeepMediaIds('not-json', media), /JSON array/);
assert.throws(() => validateFiles([{ size: 1 }, { size: 1 }], 2), /3 files or fewer/);
assert.throws(() => validateFiles([{ size: 20 * 1024 * 1024 }], 1, 20 * 1024 * 1024), /total media size/);

console.log('daily log controller tests passed');
