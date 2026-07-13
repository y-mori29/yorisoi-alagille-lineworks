const { admin, db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily } = require('./familyController');
const { extractLabReport, parseImageDataUri } = require('../services/labOcrService');
const { saveLabPhoto, deleteLabPhoto, createLabPhotoReadStream } = require('../services/labPhotoStorage');

const DEMO_PATIENT_ID = 'demo-haruto';
const MAX_PHOTO_DATA_URI_LENGTH = 6000000;
const DEMO_SESSION_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;

const demoRecords = new Map();

const tutorialRecords = [
        {
            id: 'tutorial-lab-20260628',
            testDate: '2026-06-28',
            category: 'blood',
            ocrStatus: 'confirmed',
            hospitalName: 'よりそい総合医療センター',
            department: '小児科',
            values: [
                { name: '総ビリルビン', value: '0.8', unit: 'mg/dL', referenceRange: '0.2-1.2' },
                { name: 'AST (GOT)', value: '28', unit: 'U/L', referenceRange: '' },
                { name: 'ALT (GPT)', value: '24', unit: 'U/L', referenceRange: '' },
                { name: 'γ-GTP', value: '35', unit: 'U/L', referenceRange: '' },
                { name: 'ALP', value: '416', unit: 'U/L', referenceRange: '' },
            ],
            createdAt: '2026-06-28T01:30:00.000Z',
        },
        {
            id: 'tutorial-lab-20260614',
            testDate: '2026-06-14',
            category: 'blood',
            ocrStatus: 'confirmed',
            values: [
                { name: '総ビリルビン', value: '1.1', unit: 'mg/dL', referenceRange: '0.2-1.2' },
                { name: 'AST (GOT)', value: '31', unit: 'U/L', referenceRange: '' },
                { name: 'ALT (GPT)', value: '29', unit: 'U/L', referenceRange: '' },
            ],
            createdAt: '2026-06-14T01:30:00.000Z',
        },
        {
            id: 'tutorial-lab-20260531',
            testDate: '2026-05-31',
            category: 'blood',
            ocrStatus: 'confirmed',
            values: [
                { name: '総ビリルビン', value: '1.0', unit: 'mg/dL', referenceRange: '0.2-1.2' },
                { name: 'AST (GOT)', value: '34', unit: 'U/L', referenceRange: '' },
                { name: 'ALT (GPT)', value: '33', unit: 'U/L', referenceRange: '' },
            ],
            createdAt: '2026-05-31T01:30:00.000Z',
        },
];

function isDemoMode() {
    return process.env.DEMO_MODE === '1';
}

function usesGeminiOcr() {
    return process.env.LAB_OCR_MODE === 'gemini' || !isDemoMode();
}

function getPatientId(req) {
    return req.query.patientId || req.headers['x-patient-id'] || req.body?.patientId || '';
}

function getDemoRecordKey(req, patientId) {
    const requestedSession = String(req.headers['x-demo-session'] || 'anonymous');
    const sessionId = DEMO_SESSION_PATTERN.test(requestedSession) ? requestedSession : 'anonymous';
    return `${sessionId}:${patientId}`;
}

function normalizeValues(values) {
    if (!Array.isArray(values)) return [];
    return values.slice(0, 40).map((item) => ({
        name: String(item?.name || '').trim().slice(0, 80),
        value: String(item?.value || '').trim().slice(0, 40),
        unit: String(item?.unit || '').trim().slice(0, 40),
        referenceRange: String(item?.referenceRange || '').trim().slice(0, 80),
        flag: ['H', 'L'].includes(String(item?.flag || '').toUpperCase()) ? String(item.flag).toUpperCase() : '',
        confidence: Number.isFinite(Number(item?.confidence)) ? Number(item.confidence) : null,
    })).filter((item) => item.name || item.value);
}

function normalizeMetadata(body) {
    return {
        hospitalName: String(body.hospitalName || '').trim().slice(0, 120),
        department: String(body.department || '').trim().slice(0, 80),
        notes: String(body.notes || '').trim().slice(0, 500),
    };
}

function requireTestDate(value) {
    const testDate = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
        const error = new Error('testDate required');
        error.status = 400;
        throw error;
    }
    return testDate;
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
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('labs');
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listLabs = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        if (isDemoMode()) {
            const records = demoRecords.get(getDemoRecordKey(req, patientId)) || [];
            return res.json({ ok: true, familyId, patientId, records });
        }
        const snapshot = await recordsRef(familyId, patientId).orderBy('testDate', 'desc').limit(50).get();
        return res.json({ ok: true, familyId, patientId, records: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch (error) {
        return sendError(res, error);
    }
};

function buildTrends(records) {
    const series = new Map();
    records.forEach((record) => {
        (record.values || []).forEach((item) => {
            const numericValue = Number(item.value);
            if (!item.name || !Number.isFinite(numericValue)) return;
            if (!series.has(item.name)) {
                series.set(item.name, { name: item.name, unit: item.unit || '', points: [] });
            }
            series.get(item.name).points.push({
                recordId: record.id,
                testDate: record.testDate,
                value: numericValue,
            });
        });
    });
    return [...series.values()].map((item) => ({
        ...item,
        points: item.points.sort((a, b) => a.testDate.localeCompare(b.testDate)),
    }));
}

exports.getLabTrends = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        let records;
        if (isDemoMode()) {
            records = demoRecords.get(getDemoRecordKey(req, patientId)) || [];
        } else {
            const snapshot = await recordsRef(familyId, patientId).orderBy('testDate', 'asc').limit(200).get();
            records = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        }
        return res.json({ ok: true, familyId, patientId, series: buildTrends(records) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.getLabTutorial = (_req, res) => res.json({
    ok: true,
    tutorial: true,
    sampleImageUrl: '/assets/alagille-brand/generated/lab-report-tutorial-sample-v3.png',
    records: tutorialRecords,
});

exports.readLabImage = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        validatePhoto(req.body.photoDataUrl);
        if (usesGeminiOcr()) {
            const result = await extractLabReport(req.body.photoDataUrl);
            if (result.documentType !== 'lab_report') {
                return res.status(422).json({ ok: false, error: '検査結果用紙を確認できませんでした', canSavePhoto: true });
            }
            if (result.imageQuality === 'needs_retake') {
                return res.status(422).json({ ok: false, error: '写真が不鮮明です。明るい場所で用紙全体を撮り直してください', canSavePhoto: true });
            }
            return res.json({
                ok: true,
                mode: 'gemini',
                status: 'needs_review',
                testDate: result.testDate || req.body.testDate || '',
                hospitalName: result.hospitalName,
                department: result.department,
                values: result.values,
                warnings: result.warnings,
                imageQuality: result.imageQuality,
                model: result.model,
            });
        }
        return res.json({
            ok: true,
            mode: 'demo',
            status: 'needs_review',
            testDate: req.body.testDate || '2026-07-12',
            hospitalName: 'よりそい総合医療センター',
            department: '小児科',
            values: [
                { name: '総ビリルビン', value: '1.8', unit: 'mg/dL', referenceRange: '0.3～0.9', flag: 'H' },
                { name: '直接ビリルビン', value: '0.9', unit: 'mg/dL', referenceRange: '0.05～0.30', flag: 'H' },
                { name: 'AST (GOT)', value: '42', unit: 'U/L', referenceRange: '24～43', flag: '' },
                { name: 'ALT (GPT)', value: '58', unit: 'U/L', referenceRange: '9～30', flag: 'H' },
                { name: 'γ-GTP', value: '135', unit: 'U/L', referenceRange: '6～20', flag: 'H' },
                { name: 'ALP (IFCC)', value: '416', unit: 'U/L', referenceRange: '147～431', flag: '' },
                { name: 'アルブミン', value: '3.2', unit: 'g/dL', referenceRange: '3.5～4.7', flag: 'L' },
                { name: 'PT-INR', value: '1.02', unit: '', referenceRange: '0.90～1.10', flag: '' },
            ],
        });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createLab = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const testDate = requireTestDate(req.body.testDate);
        const values = normalizeValues(req.body.values);
        const photoDataUrl = validatePhoto(req.body.photoDataUrl);
        if (!values.length && (!photoDataUrl || isDemoMode())) {
            return res.status(400).json({ ok: false, error: 'values or photo required' });
        }
        const now = new Date().toISOString();
        const photoStorage = !isDemoMode() && photoDataUrl
            ? await saveLabPhoto({ tenantId: req.tenantId, familyId, patientId, photoDataUrl })
            : {};
        const record = {
            patientId,
            familyId,
            tenantId: req.tenantId,
            createdByMemberId: req.user?.uid || null,
            testDate,
            category: ['blood', 'ultrasound', 'ecg', 'other'].includes(req.body.category) ? req.body.category : 'blood',
            ocrStatus: values.length ? 'confirmed' : 'photo_only',
            photoName: String(req.body.photoName || '').slice(0, 160),
            ...photoStorage,
            values,
            ...normalizeMetadata(req.body),
            createdAt: now,
            updatedAt: now,
        };
        if (isDemoMode()) {
            // Public demo records are browser-session scoped and never retain the source image.
            const created = { id: `demo-lab-${Date.now()}`, ...record, photoRetained: false };
            const recordKey = getDemoRecordKey(req, patientId);
            const records = demoRecords.get(recordKey) || [];
            demoRecords.set(recordKey, [created, ...records].slice(0, 50));
            return res.status(201).json({ ok: true, record: created });
        }
        const docRef = recordsRef(familyId, patientId).doc();
        await docRef.set({ ...record, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, record: { id: docRef.id, ...record } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.getLabPhoto = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        if (isDemoMode()) {
            const record = (demoRecords.get(getDemoRecordKey(req, patientId)) || []).find((item) => item.id === req.params.id);
            if (!record?.photoDataUrl) return res.status(404).json({ ok: false, error: 'Lab photo not found' });
            const image = parseImageDataUri(record.photoDataUrl);
            res.type(image.mimeType).set('Cache-Control', 'private, no-store');
            return res.send(Buffer.from(image.base64Data, 'base64'));
        }
        const snapshot = await recordsRef(familyId, patientId).doc(req.params.id).get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId || !snapshot.data().photoObject) {
            return res.status(404).json({ ok: false, error: 'Lab photo not found' });
        }
        res.type(snapshot.data().photoMimeType || 'image/jpeg').set('Cache-Control', 'private, no-store');
        const stream = createLabPhotoReadStream(snapshot.data().photoObject);
        stream.on('error', (error) => {
            if (!res.headersSent) sendError(res, error);
            else res.destroy(error);
        });
        return stream.pipe(res);
    } catch (error) {
        return sendError(res, error);
    }
};

exports.updateLab = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const updates = {
            testDate: requireTestDate(req.body.testDate),
            values: normalizeValues(req.body.values),
            ...normalizeMetadata(req.body),
            updatedAt: new Date().toISOString(),
        };
        if (isDemoMode()) {
            const recordKey = getDemoRecordKey(req, patientId);
            const records = demoRecords.get(recordKey) || [];
            const index = records.findIndex((record) => record.id === req.params.id);
            if (index < 0) return res.status(404).json({ ok: false, error: 'Lab record not found' });
            records[index] = { ...records[index], ...updates };
            demoRecords.set(recordKey, records);
            return res.json({ ok: true, record: records[index] });
        }
        const docRef = recordsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await docRef.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) {
            return res.status(404).json({ ok: false, error: 'Lab record not found' });
        }
        await docRef.set({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, record: { id: req.params.id, ...snapshot.data(), ...updates } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.deleteLab = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        if (isDemoMode()) {
            const recordKey = getDemoRecordKey(req, patientId);
            const records = demoRecords.get(recordKey) || [];
            const next = records.filter((record) => record.id !== req.params.id);
            if (next.length === records.length) return res.status(404).json({ ok: false, error: 'Lab record not found' });
            demoRecords.set(recordKey, next);
            return res.json({ ok: true, deletedId: req.params.id });
        }
        const docRef = recordsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await docRef.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) {
            return res.status(404).json({ ok: false, error: 'Lab record not found' });
        }
        const photoObject = snapshot.data().photoObject;
        await docRef.delete();
        await deleteLabPhoto(photoObject);
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports.getPatientId = getPatientId;
module.exports.getDemoRecordKey = getDemoRecordKey;
module.exports.normalizeValues = normalizeValues;
module.exports.buildTrends = buildTrends;
