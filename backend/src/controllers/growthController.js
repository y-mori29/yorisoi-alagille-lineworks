const { admin, db } = require('../config/firebase');
const { randomUUID } = require('node:crypto');
const { getFamilyId, assertOwnedFamily } = require('./familyController');

const demoRecords = new Map();

function isDemoMode() {
    return process.env.DEMO_MODE === '1';
}

function getPatientId(req) {
    return req.query.patientId || req.headers['x-patient-id'] || req.body?.patientId || '';
}

async function assertPatient(familyId, patientId, tenantId, accountUid, allowedRoles = null) {
    if (!patientId) {
        const error = new Error('patientId required');
        error.status = 400;
        throw error;
    }
    if (isDemoMode()) return;
    await assertOwnedFamily(familyId, tenantId, accountUid, allowedRoles);
    const patient = await db.collection('families').doc(familyId).collection('patients').doc(patientId).get();
    if (!patient.exists || patient.data().tenantId !== tenantId || patient.data().active === false) {
        const error = new Error('Patient not found');
        error.status = 404;
        throw error;
    }
}

function recordsRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('growthRecords');
}

function demoKey(familyId, patientId) {
    return `${familyId}:${patientId}`;
}

function optionalNumber(value, min, max, field) {
    if (value === '' || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        const error = new Error(`${field} is out of range`);
        error.status = 400;
        throw error;
    }
    return Math.round(number * 10) / 10;
}

function normalizeGrowth(body) {
    const measuredAt = String(body.measuredAt || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(measuredAt)) {
        const error = new Error('measuredAt required');
        error.status = 400;
        throw error;
    }
    const heightCm = optionalNumber(body.heightCm, 20, 250, 'heightCm');
    const weightKg = optionalNumber(body.weightKg, 0.5, 500, 'weightKg');
    const headCircumferenceCm = optionalNumber(body.headCircumferenceCm, 10, 100, 'headCircumferenceCm');
    if (heightCm === null && weightKg === null) {
        const error = new Error('heightCm or weightKg required');
        error.status = 400;
        throw error;
    }
    return {
        measuredAt,
        heightCm,
        weightKg,
        headCircumferenceCm,
        memo: String(body.memo || '').trim().slice(0, 500),
    };
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listGrowthRecords = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        if (isDemoMode()) return res.json({ ok: true, records: demoRecords.get(demoKey(familyId, patientId)) || [] });
        const snapshot = await recordsRef(familyId, patientId).orderBy('measuredAt', 'desc').limit(100).get();
        return res.json({ ok: true, records: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.getGrowthTrends = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        let records;
        if (isDemoMode()) records = demoRecords.get(demoKey(familyId, patientId)) || [];
        else {
            const snapshot = await recordsRef(familyId, patientId).orderBy('measuredAt', 'asc').limit(200).get();
            records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        const ordered = [...records].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
        return res.json({
            ok: true,
            height: ordered.filter((item) => item.heightCm !== null).map((item) => ({ id: item.id, measuredAt: item.measuredAt, value: item.heightCm })),
            weight: ordered.filter((item) => item.weightKg !== null).map((item) => ({ id: item.id, measuredAt: item.measuredAt, value: item.weightKg })),
        });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createGrowthRecord = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const now = new Date().toISOString();
        const record = {
            ...normalizeGrowth(req.body), tenantId: req.tenantId, familyId, patientId,
            source: 'manual', createdByMemberId: req.user?.uid || null, createdAt: now, updatedAt: now,
        };
        if (isDemoMode()) {
            const created = { id: `demo-growth-${randomUUID()}`, ...record };
            const key = demoKey(familyId, patientId);
            demoRecords.set(key, [created, ...(demoRecords.get(key) || [])].sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)).slice(0, 100));
            return res.status(201).json({ ok: true, record: created });
        }
        const ref = recordsRef(familyId, patientId).doc();
        await ref.set({ ...record, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, record: { id: ref.id, ...record } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.updateGrowthRecord = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const updates = { ...normalizeGrowth(req.body), updatedAt: new Date().toISOString() };
        if (isDemoMode()) {
            const key = demoKey(familyId, patientId);
            const records = demoRecords.get(key) || [];
            const index = records.findIndex((item) => item.id === req.params.id);
            if (index < 0) return res.status(404).json({ ok: false, error: 'Growth record not found' });
            records[index] = { ...records[index], ...updates };
            records.sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
            demoRecords.set(key, records);
            return res.json({ ok: true, record: records[index] });
        }
        const ref = recordsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Growth record not found' });
        await ref.set({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, record: { id: req.params.id, ...snapshot.data(), ...updates } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.deleteGrowthRecord = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        if (isDemoMode()) {
            const key = demoKey(familyId, patientId);
            const records = demoRecords.get(key) || [];
            const next = records.filter((item) => item.id !== req.params.id);
            if (next.length === records.length) return res.status(404).json({ ok: false, error: 'Growth record not found' });
            demoRecords.set(key, next);
            return res.json({ ok: true, deletedId: req.params.id });
        }
        const ref = recordsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Growth record not found' });
        await ref.delete();
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports.normalizeGrowth = normalizeGrowth;
