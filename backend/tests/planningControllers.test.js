const assert = require('node:assert');

process.env.FIRESTORE_DATABASE_ID = 'alagille-local';

const { normalizeAppointment } = require('../src/controllers/appointmentController');
const { normalizeQuestion } = require('../src/controllers/questionController');

const appointment = normalizeAppointment({ scheduledAt: '2026-07-15T10:30:00+09:00', clinicName: 'よりそい病院', department: '小児科', location: '2階', memo: '採血あり' });
assert.equal(appointment.clinicName, 'よりそい病院');
assert.equal(appointment.status, 'scheduled');
assert.ok(appointment.scheduledAt.endsWith('Z'));
assert.throws(() => normalizeAppointment({ scheduledAt: 'invalid' }), /scheduledAt required/);
assert.equal(normalizeAppointment({ scheduledAt: '2026-07-15', status: 'invalid' }).status, 'scheduled');

const question = normalizeQuestion({ text: '夜のかゆみについて聞く', category: 'daily' });
assert.equal(question.category, 'daily');
assert.equal(question.status, 'open');
assert.equal(question.askedAt, '');
const asked = normalizeQuestion({ text: '薬について聞いた', category: 'medication', status: 'asked', answerMemo: '継続' });
assert.equal(asked.status, 'asked');
assert.ok(asked.askedAt.endsWith('Z'));
assert.throws(() => normalizeQuestion({ text: '' }), /text required/);

console.log('planning controller tests passed');
