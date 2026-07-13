const { admin, db } = require('../config/firebase');
const { getFamilyId, assertOwnedFamily } = require('./familyController');
const {
    saveDailyLogMedia,
    deleteDailyLogMedia,
    createDailyLogMediaReadStream,
} = require('../services/dailyLogMediaStorage');

const CATEGORIES = new Set(['skin', 'stool', 'itch', 'meal', 'movement', 'other']);
const MAX_MEDIA_COUNT = 3;
const MAX_TOTAL_MEDIA_BYTES = 30 * 1024 * 1024;

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

function dailyLogsRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('dailyLogs');
}

function normalizeOccurredAt(value) {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) {
        const error = new Error('occurredAt required');
        error.status = 400;
        throw error;
    }
    return date.toISOString();
}

function normalizeDailyLog(body, mediaCount = 0) {
    const category = CATEGORIES.has(body.category) ? body.category : 'other';
    const title = String(body.title || '').trim().slice(0, 100);
    const memo = String(body.memo || '').trim().slice(0, 2000);
    if (!title && !memo && mediaCount === 0) {
        const error = new Error('memo or media required');
        error.status = 400;
        throw error;
    }
    return { occurredAt: normalizeOccurredAt(body.occurredAt), category, title, memo };
}

function parseKeepMediaIds(value, currentMedia) {
    if (value === undefined) return currentMedia.map((item) => item.id);
    try {
        const parsed = JSON.parse(String(value || '[]'));
        if (!Array.isArray(parsed)) throw new Error('invalid');
        return parsed.map(String);
    } catch {
        const error = new Error('keepMediaIds must be a JSON array');
        error.status = 400;
        throw error;
    }
}

function validateFiles(files, existingCount = 0, existingBytes = 0) {
    const list = files || [];
    if (list.length + existingCount > MAX_MEDIA_COUNT) {
        const error = new Error(`media must be ${MAX_MEDIA_COUNT} files or fewer`);
        error.status = 413;
        throw error;
    }
    const total = Number(existingBytes || 0) + list.reduce((sum, file) => sum + Number(file.size || 0), 0);
    if (total > MAX_TOTAL_MEDIA_BYTES) {
        const error = new Error('total media size is too large');
        error.status = 413;
        throw error;
    }
}

function serializeDailyLog(id, data, patientId) {
    return {
        id,
        ...data,
        media: (data.media || []).map(({ storagePath, thumbnailPath, ...item }) => ({
            ...item,
            url: `/api/daily-logs/${encodeURIComponent(id)}/media/${encodeURIComponent(item.id)}?patientId=${encodeURIComponent(patientId)}`,
        })),
    };
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

exports.listDailyLogs = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await dailyLogsRef(familyId, patientId).orderBy('occurredAt', 'desc').limit(100).get();
        return res.json({ ok: true, logs: snapshot.docs.map((doc) => serializeDailyLog(doc.id, doc.data(), patientId)) });
    } catch (error) { return sendError(res, error); }
};

exports.getDailyLog = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await dailyLogsRef(familyId, patientId).doc(req.params.id).get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Daily log not found' });
        return res.json({ ok: true, log: serializeDailyLog(snapshot.id, snapshot.data(), patientId) });
    } catch (error) { return sendError(res, error); }
};

exports.createDailyLog = async (req, res) => {
    const uploaded = [];
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        validateFiles(req.files);
        const normalized = normalizeDailyLog(req.body, (req.files || []).length);
        const ref = dailyLogsRef(familyId, patientId).doc();
        for (const file of req.files || []) {
            uploaded.push(await saveDailyLogMedia({ tenantId: req.tenantId, familyId, patientId, dailyLogId: ref.id, file }));
        }
        const now = new Date().toISOString();
        const record = {
            ...normalized, tenantId: req.tenantId, familyId, patientId, media: uploaded,
            createdByMemberId: req.user.uid, createdAt: now, updatedAt: now,
        };
        await ref.set({ ...record, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, log: serializeDailyLog(ref.id, record, patientId) });
    } catch (error) {
        await Promise.all(uploaded.map((item) => deleteDailyLogMedia(item.storagePath).catch(() => {})));
        return sendError(res, error);
    }
};

exports.updateDailyLog = async (req, res) => {
    const uploaded = [];
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = dailyLogsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Daily log not found' });
        const current = snapshot.data();
        const keepIds = new Set(parseKeepMediaIds(req.body.keepMediaIds, current.media || []));
        const kept = (current.media || []).filter((item) => keepIds.has(item.id));
        validateFiles(req.files, kept.length, kept.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0));
        const normalized = normalizeDailyLog(req.body, kept.length + (req.files || []).length);
        for (const file of req.files || []) {
            uploaded.push(await saveDailyLogMedia({ tenantId: req.tenantId, familyId, patientId, dailyLogId: ref.id, file }));
        }
        const media = [...kept, ...uploaded];
        await ref.set({ ...normalized, media, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const removed = (current.media || []).filter((item) => !keepIds.has(item.id));
        await Promise.all(removed.map((item) => deleteDailyLogMedia(item.storagePath)));
        return res.json({ ok: true, log: serializeDailyLog(ref.id, { ...current, ...normalized, media, updatedAt: new Date().toISOString() }, patientId) });
    } catch (error) {
        await Promise.all(uploaded.map((item) => deleteDailyLogMedia(item.storagePath).catch(() => {})));
        return sendError(res, error);
    }
};

exports.getDailyLogMedia = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await dailyLogsRef(familyId, patientId).doc(req.params.id).get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Daily log not found' });
        const media = (snapshot.data().media || []).find((item) => item.id === req.params.mediaId);
        if (!media?.storagePath) return res.status(404).json({ ok: false, error: 'Daily log media not found' });
        const size = Number(media.sizeBytes || 0);
        const range = String(req.headers.range || '').match(/^bytes=(\d+)-(\d*)$/);
        let streamOptions = {};
        res.type(media.contentType).set({ 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'Accept-Ranges': 'bytes' });
        if (range && size > 0) {
            const start = Number(range[1]);
            const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
            if (!Number.isInteger(start) || start < 0 || start >= size || end < start) {
                return res.status(416).set('Content-Range', `bytes */${size}`).end();
            }
            streamOptions = { start, end };
            res.status(206).set({ 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) });
        } else if (size > 0) {
            res.set('Content-Length', String(size));
        }
        const stream = createDailyLogMediaReadStream(media.storagePath, streamOptions);
        stream.on('error', (error) => {
            if (!res.headersSent) sendError(res, error);
            else res.destroy(error);
        });
        return stream.pipe(res);
    } catch (error) { return sendError(res, error); }
};

exports.deleteDailyLog = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = dailyLogsRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Daily log not found' });
        await ref.delete();
        await Promise.all((snapshot.data().media || []).map((item) => deleteDailyLogMedia(item.storagePath)));
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return sendError(res, error); }
};

module.exports.normalizeDailyLog = normalizeDailyLog;
module.exports.parseKeepMediaIds = parseKeepMediaIds;
module.exports.validateFiles = validateFiles;
