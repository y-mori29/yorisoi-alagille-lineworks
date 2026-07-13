const { admin, db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily } = require('./familyController');

const CATEGORIES = new Set(['doctor', 'medication', 'test', 'growth', 'daily', 'other']);
const STATUSES = new Set(['open', 'asked']);

function getPatientId(req) {
    return req.query.patientId || req.headers['x-patient-id'] || req.body?.patientId || '';
}

async function assertPatient(familyId, patientId, tenantId, accountUid, allowedRoles = null) {
    if (!patientId) {
        const error = new Error('patientId required');
        error.status = 400;
        throw error;
    }
    await assertOwnedFamily(familyId, tenantId, accountUid, allowedRoles);
    const patient = await db.collection('families').doc(familyId).collection('patients').doc(patientId).get();
    if (!patient.exists || patient.data().tenantId !== tenantId || patient.data().active === false) {
        const error = new Error('Patient not found');
        error.status = 404;
        throw error;
    }
}

function questionsRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('questions');
}

function normalizeQuestion(body) {
    const text = String(body.text || '').trim().slice(0, 500);
    if (!text) {
        const error = new Error('text required');
        error.status = 400;
        throw error;
    }
    const status = STATUSES.has(body.status) ? body.status : 'open';
    return {
        text,
        category: CATEGORIES.has(body.category) ? body.category : 'other',
        status,
        answerMemo: String(body.answerMemo || '').trim().slice(0, 1000),
        appointmentId: String(body.appointmentId || '').trim().slice(0, 120),
        askedAt: status === 'asked' ? (body.askedAt && !Number.isNaN(new Date(body.askedAt).getTime()) ? new Date(body.askedAt).toISOString() : new Date().toISOString()) : '',
    };
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listQuestions = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await questionsRef(familyId, patientId).orderBy('updatedAt', 'desc').limit(100).get();
        let questions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        if (req.query.status && STATUSES.has(req.query.status)) questions = questions.filter((item) => item.status === req.query.status);
        return res.json({ ok: true, questions });
    } catch (error) { return sendError(res, error); }
};

exports.createQuestion = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const now = new Date().toISOString();
        const question = {
            ...normalizeQuestion(req.body), tenantId: req.tenantId, familyId, patientId,
            createdByMemberId: req.user.uid, createdAt: now, updatedAt: now,
        };
        const ref = questionsRef(familyId, patientId).doc();
        await ref.set({ ...question, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, question: { id: ref.id, ...question } });
    } catch (error) { return sendError(res, error); }
};

exports.updateQuestion = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = questionsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Question not found' });
        const updates = { ...normalizeQuestion(req.body), updatedAt: new Date().toISOString() };
        await ref.set({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, question: { id: ref.id, ...snapshot.data(), ...updates } });
    } catch (error) { return sendError(res, error); }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = questionsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Question not found' });
        await ref.delete();
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return sendError(res, error); }
};

module.exports.normalizeQuestion = normalizeQuestion;
