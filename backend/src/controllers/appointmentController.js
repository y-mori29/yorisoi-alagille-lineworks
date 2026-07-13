const { admin, db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily } = require('./familyController');

const STATUSES = new Set(['scheduled', 'completed', 'cancelled']);

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

function appointmentsRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('appointments');
}

function normalizeAppointment(body) {
    const scheduled = new Date(String(body.scheduledAt || ''));
    if (Number.isNaN(scheduled.getTime())) {
        const error = new Error('scheduledAt required');
        error.status = 400;
        throw error;
    }
    return {
        scheduledAt: scheduled.toISOString(),
        clinicName: String(body.clinicName || '').trim().slice(0, 120),
        department: String(body.department || '').trim().slice(0, 80),
        location: String(body.location || '').trim().slice(0, 160),
        memo: String(body.memo || '').trim().slice(0, 1000),
        status: STATUSES.has(body.status) ? body.status : 'scheduled',
    };
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listAppointments = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        let query = appointmentsRef(familyId, patientId).orderBy('scheduledAt', 'asc');
        if (req.query.upcoming === '1') query = query.where('scheduledAt', '>=', new Date().toISOString());
        const snapshot = await query.limit(req.query.upcoming === '1' ? 20 : 100).get();
        return res.json({ ok: true, appointments: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch (error) { return sendError(res, error); }
};

exports.createAppointment = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const now = new Date().toISOString();
        const appointment = {
            ...normalizeAppointment(req.body), tenantId: req.tenantId, familyId, patientId,
            createdByMemberId: req.user.uid, createdAt: now, updatedAt: now,
        };
        const ref = appointmentsRef(familyId, patientId).doc();
        await ref.set({ ...appointment, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, appointment: { id: ref.id, ...appointment } });
    } catch (error) { return sendError(res, error); }
};

exports.updateAppointment = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = appointmentsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Appointment not found' });
        const updates = { ...normalizeAppointment(req.body), updatedAt: new Date().toISOString() };
        await ref.set({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, appointment: { id: ref.id, ...snapshot.data(), ...updates } });
    } catch (error) { return sendError(res, error); }
};

exports.deleteAppointment = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = appointmentsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Appointment not found' });
        await ref.delete();
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return sendError(res, error); }
};

module.exports.normalizeAppointment = normalizeAppointment;
