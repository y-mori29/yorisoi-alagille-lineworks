const { admin, db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily } = require('./familyController');
const { extractMedication } = require('../services/medicationOcrService');
const { parseImageDataUri } = require('../services/labOcrService');
const {
    saveMedicationPhoto,
    deleteMedicationPhoto,
    createMedicationPhotoReadStream,
} = require('../services/medicationPhotoStorage');

const MAX_PHOTO_DATA_URI_LENGTH = 6000000;

const demoMedications = new Map();

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

function medicationsRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('medications');
}

function getDemoKey(familyId, patientId) {
    return `${familyId}:${patientId}`;
}

function normalizeMedication(body, requireName = true) {
    const name = String(body.name || '').trim().slice(0, 120);
    if (requireName && !name) {
        const error = new Error('name required');
        error.status = 400;
        throw error;
    }
    return {
        name,
        dosageText: String(body.dosageText || '').trim().slice(0, 160),
        timingText: String(body.timingText || '').trim().slice(0, 160),
        status: ['active', 'stopped', 'unknown'].includes(body.status) ? body.status : 'active',
        startedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(body.startedAt || '')) ? body.startedAt : '',
        stoppedAt: /^\d{4}-\d{2}-\d{2}$/.test(String(body.stoppedAt || '')) ? body.stoppedAt : '',
        memo: String(body.memo || '').trim().slice(0, 500),
    };
}

function validatePhoto(photoDataUrl) {
    if (!photoDataUrl) return null;
    const value = String(photoDataUrl);
    if (!/^data:image\/(jpeg|png|webp);base64,/i.test(value)) {
        const error = new Error('photoDataUrl must be a JPEG, PNG, or WebP data URI');
        error.status = 400;
        throw error;
    }
    if (value.length > MAX_PHOTO_DATA_URI_LENGTH) {
        const error = new Error('photo is too large');
        error.status = 413;
        throw error;
    }
    return value;
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listMedications = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        if (isDemoMode()) return res.json({ ok: true, familyId, patientId, medications: demoMedications.get(getDemoKey(familyId, patientId)) || [] });
        const snapshot = await medicationsRef(familyId, patientId).orderBy('updatedAt', 'desc').limit(100).get();
        return res.json({ ok: true, familyId, patientId, medications: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.readMedicationImage = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const photoDataUrl = validatePhoto(req.body.photoDataUrl);
        if (!photoDataUrl) return res.status(400).json({ ok: false, error: 'photoDataUrl required' });
        const result = await extractMedication(photoDataUrl);
        if (result.documentType !== 'medication_document') {
            return res.status(422).json({ ok: false, error: '薬袋・お薬手帳・処方内容が写った写真を確認できませんでした' });
        }
        if (result.imageQuality === 'needs_retake') {
            return res.status(422).json({ ok: false, error: '写真が不鮮明です。薬名と用法が見えるように撮り直してください' });
        }
        return res.json({
            ok: true,
            status: 'needs_review',
            name: result.name,
            dosageText: result.dosageText,
            timingText: result.timingText,
            rawText: result.rawText,
            warnings: result.warnings,
            imageQuality: result.imageQuality,
            model: result.model,
        });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createMedication = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const now = new Date().toISOString();
        const photoDataUrl = validatePhoto(req.body.photoDataUrl);
        const photoStorage = !isDemoMode() && photoDataUrl
            ? await saveMedicationPhoto({ tenantId: req.tenantId, familyId, patientId, photoDataUrl })
            : {};
        const medication = {
            ...normalizeMedication(req.body),
            tenantId: req.tenantId,
            familyId,
            patientId,
            createdByMemberId: req.user?.uid || null,
            source: req.body.rawOcrText ? 'photo_ocr' : 'manual',
            photoName: String(req.body.photoName || '').trim().slice(0, 160),
            rawOcrText: String(req.body.rawOcrText || '').trim().slice(0, 1200),
            ...photoStorage,
            checks: [],
            createdAt: now,
            updatedAt: now,
        };
        if (isDemoMode()) {
            const created = { id: `demo-medication-${Date.now()}`, ...medication, photoDataUrl };
            const demoKey = getDemoKey(familyId, patientId);
            demoMedications.set(demoKey, [created, ...(demoMedications.get(demoKey) || [])].slice(0, 100));
            return res.status(201).json({ ok: true, medication: created });
        }
        const ref = medicationsRef(familyId, patientId).doc();
        try {
            await ref.set({ ...medication, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } catch (error) {
            await deleteMedicationPhoto(photoStorage.photoObject);
            throw error;
        }
        return res.status(201).json({ ok: true, medication: { id: ref.id, ...medication } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.getMedicationPhoto = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        if (isDemoMode()) {
            const medication = (demoMedications.get(getDemoKey(familyId, patientId)) || []).find((item) => item.id === req.params.id);
            if (!medication?.photoDataUrl) return res.status(404).json({ ok: false, error: 'Medication photo not found' });
            const image = parseImageDataUri(medication.photoDataUrl);
            res.type(image.mimeType).set('Cache-Control', 'private, no-store');
            return res.send(Buffer.from(image.base64Data, 'base64'));
        }
        const snapshot = await medicationsRef(familyId, patientId).doc(req.params.id).get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId || !snapshot.data().photoObject) {
            return res.status(404).json({ ok: false, error: 'Medication photo not found' });
        }
        res.type(snapshot.data().photoMimeType || 'image/jpeg').set('Cache-Control', 'private, no-store');
        const stream = createMedicationPhotoReadStream(snapshot.data().photoObject);
        stream.on('error', (error) => {
            if (!res.headersSent) sendError(res, error);
            else res.destroy(error);
        });
        return stream.pipe(res);
    } catch (error) {
        return sendError(res, error);
    }
};

exports.updateMedication = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const photoDataUrl = validatePhoto(req.body.photoDataUrl);
        const updates = { ...normalizeMedication(req.body), updatedAt: new Date().toISOString() };
        if (Object.prototype.hasOwnProperty.call(req.body, 'photoName')) {
            updates.photoName = String(req.body.photoName || '').trim().slice(0, 160);
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'rawOcrText')) {
            updates.rawOcrText = String(req.body.rawOcrText || '').trim().slice(0, 1200);
        }
        if (isDemoMode()) {
            const demoKey = getDemoKey(familyId, patientId);
            const medications = demoMedications.get(demoKey) || [];
            const index = medications.findIndex((item) => item.id === req.params.id);
            if (index < 0) return res.status(404).json({ ok: false, error: 'Medication not found' });
            medications[index] = { ...medications[index], ...updates, ...(photoDataUrl ? { photoDataUrl, source: 'photo_ocr' } : {}) };
            demoMedications.set(demoKey, medications);
            return res.json({ ok: true, medication: medications[index] });
        }
        const ref = medicationsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Medication not found' });
        const photoStorage = photoDataUrl
            ? await saveMedicationPhoto({ tenantId: req.tenantId, familyId, patientId, photoDataUrl })
            : {};
        const persistedUpdates = {
            ...updates,
            ...photoStorage,
            ...(photoDataUrl ? { source: 'photo_ocr' } : {}),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        try {
            await ref.set(persistedUpdates, { merge: true });
        } catch (error) {
            await deleteMedicationPhoto(photoStorage.photoObject);
            throw error;
        }
        if (photoStorage.photoObject && snapshot.data().photoObject !== photoStorage.photoObject) {
            await deleteMedicationPhoto(snapshot.data().photoObject);
        }
        return res.json({ ok: true, medication: { id: req.params.id, ...snapshot.data(), ...updates, ...photoStorage } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.deleteMedication = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        if (isDemoMode()) {
            const demoKey = getDemoKey(familyId, patientId);
            const medications = demoMedications.get(demoKey) || [];
            const next = medications.filter((item) => item.id !== req.params.id);
            if (next.length === medications.length) return res.status(404).json({ ok: false, error: 'Medication not found' });
            demoMedications.set(demoKey, next);
            return res.json({ ok: true, deletedId: req.params.id });
        }
        const ref = medicationsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Medication not found' });
        const checks = await ref.collection('checks').limit(100).get();
        const photoObject = snapshot.data().photoObject;
        const batch = db.batch();
        checks.docs.forEach((doc) => batch.delete(doc.ref));
        batch.delete(ref);
        await batch.commit();
        await deleteMedicationPhoto(photoObject);
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createMedicationCheck = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const status = ['taken', 'skipped', 'unknown'].includes(req.body.status) ? req.body.status : 'taken';
        const check = { id: `check-${Date.now()}`, status, checkedAt: new Date().toISOString() };
        if (isDemoMode()) {
            const medications = demoMedications.get(getDemoKey(familyId, patientId)) || [];
            const medication = medications.find((item) => item.id === req.params.id);
            if (!medication) return res.status(404).json({ ok: false, error: 'Medication not found' });
            medication.checks = [check, ...(medication.checks || [])].slice(0, 30);
            medication.lastCheck = check;
            return res.status(201).json({ ok: true, check });
        }
        const ref = medicationsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Medication not found' });
        const checkRef = ref.collection('checks').doc();
        const savedCheck = { ...check, id: checkRef.id };
        const batch = db.batch();
        batch.set(checkRef, { ...savedCheck, tenantId: req.tenantId, familyId, patientId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(ref, { lastCheck: savedCheck, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await batch.commit();
        return res.status(201).json({ ok: true, check: savedCheck });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports.getPatientId = getPatientId;
module.exports.normalizeMedication = normalizeMedication;
