const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { SpeechClient } = require('@google-cloud/speech').v2;
const { admin, db } = require('../config/firebase');
const { bucket } = require('../config/gcs');
const { getFamilyId, assertOwnedFamily } = require('./familyController');
const { composeMany } = require('../utils/gcsUtils');
const { execFFmpeg } = require('../utils/mediaUtils');
const { analyzeVisitNote, sanitizeResult } = require('../services/visitNoteAnalysisService');

const MAX_CHUNKS = 360;

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
    return patient;
}

function notesRef(familyId, patientId) {
    return db.collection('families').doc(familyId).collection('patients').doc(patientId).collection('visitNotes');
}

function recordingsRef() {
    return db.collection('alagilleVisitRecordings');
}

function normalizeDate(value) {
    const date = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const error = new Error('visitDate required');
        error.status = 400;
        throw error;
    }
    return date;
}

function normalizeSummary(body) {
    return sanitizeResult(body.analysis || body);
}

function normalizeNote(body) {
    return {
        visitDate: normalizeDate(body.visitDate),
        clinicName: String(body.clinicName || '').trim().slice(0, 120),
        department: String(body.department || '').trim().slice(0, 80),
        familyMemo: String(body.familyMemo || '').trim().slice(0, 2000),
        transcript: String(body.transcript || '').trim().slice(0, 50000),
        ...normalizeSummary(body),
    };
}

function extensionForContentType(contentType) {
    const normalized = String(contentType || 'audio/webm').split(';')[0].trim().toLowerCase();
    const allowed = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'application/octet-stream': 'raw' };
    return allowed[normalized] || 'webm';
}

function sendError(res, error) {
    return res.status(error.status || 500).json({ ok: false, error: error.message });
}

async function getOwnedRecording(req, allowedRoles = null) {
    const familyId = getFamilyId(req);
    const patientId = getPatientId(req);
    await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, allowedRoles);
    const ref = recordingsRef().doc(req.params.recordingId);
    const snapshot = await ref.get();
    const data = snapshot.data();
    if (!snapshot.exists || data.tenantId !== req.tenantId || data.familyId !== familyId || data.patientId !== patientId) {
        const error = new Error('Recording not found');
        error.status = 404;
        throw error;
    }
    return { familyId, patientId, ref, data };
}

exports.listVisitNotes = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await notesRef(familyId, patientId).orderBy('visitDate', 'desc').limit(50).get();
        return res.json({ ok: true, notes: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) });
    } catch (error) { return sendError(res, error); }
};

exports.createVisitNote = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const now = new Date().toISOString();
        const note = {
            ...normalizeNote(req.body), tenantId: req.tenantId, familyId, patientId,
            status: 'COMPLETED', inputMode: req.body.inputMode === 'voice' ? 'voice' : 'text',
            createdByMemberId: req.user.uid, createdAt: now, updatedAt: now,
        };
        const ref = notesRef(familyId, patientId).doc();
        await ref.set({ ...note, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        return res.status(201).json({ ok: true, note: { id: ref.id, ...note } });
    } catch (error) { return sendError(res, error); }
};

exports.updateVisitNote = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = notesRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Visit note not found' });
        const updates = { ...normalizeNote(req.body), updatedAt: new Date().toISOString() };
        await ref.set({ ...updates, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, note: { id: ref.id, ...snapshot.data(), ...updates } });
    } catch (error) { return sendError(res, error); }
};

exports.deleteVisitNote = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const ref = notesRef(familyId, patientId).doc(req.params.id);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId) return res.status(404).json({ ok: false, error: 'Visit note not found' });
        const data = snapshot.data();
        await ref.delete();
        if (data.audioObject) await bucket.file(data.audioObject).delete({ ignoreNotFound: true });
        if (data.recordingId) await recordingsRef().doc(data.recordingId).delete().catch(() => {});
        return res.json({ ok: true, deletedId: req.params.id });
    } catch (error) { return sendError(res, error); }
};

exports.analyzeText = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const analysis = await analyzeVisitNote({ transcript: req.body.transcript || req.body.text, familyMemo: req.body.familyMemo });
        return res.json({ ok: true, analysis });
    } catch (error) { return sendError(res, error); }
};

exports.initRecording = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid, ['owner', 'editor']);
        const recordingId = randomUUID();
        const now = new Date().toISOString();
        const gcsPrefix = [
            'tenants', req.tenantId, 'families', familyId, 'patients', patientId,
            'visit-recordings', recordingId,
        ].join('/');
        await recordingsRef().doc(recordingId).set({
            recordingId, tenantId: req.tenantId, familyId, patientId,
            createdByMemberId: req.user.uid, status: 'RECORDING',
            contentType: String(req.body.contentType || 'audio/webm').slice(0, 100),
            visitDate: normalizeDate(req.body.visitDate),
            clinicName: String(req.body.clinicName || '').trim().slice(0, 120),
            department: String(req.body.department || '').trim().slice(0, 80),
            familyMemo: String(req.body.familyMemo || '').trim().slice(0, 2000),
            gcsPrefix, createdAt: now, updatedAt: now,
        });
        return res.status(201).json({ ok: true, recordingId });
    } catch (error) { return sendError(res, error); }
};

exports.uploadChunk = async (req, res) => {
    try {
        const sequence = Number.parseInt(req.params.seq, 10);
        if (!Number.isInteger(sequence) || sequence < 1 || sequence > MAX_CHUNKS) return res.status(400).json({ ok: false, error: 'Invalid recording chunk' });
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ ok: false, error: 'Recording chunk is empty' });
        const owned = await getOwnedRecording(req, ['owner', 'editor']);
        if (!['RECORDING', 'UPLOADING'].includes(owned.data.status)) return res.status(409).json({ ok: false, error: 'Recording is not accepting chunks' });
        const contentType = String(req.headers['content-type'] || owned.data.contentType || 'audio/webm');
        const objectName = `${owned.data.gcsPrefix}/chunk-${String(sequence).padStart(5, '0')}.${extensionForContentType(contentType)}`;
        await bucket.file(objectName).save(req.body, { resumable: false, validation: 'crc32c', metadata: { contentType, cacheControl: 'private, no-store' } });
        await owned.ref.set({ status: 'UPLOADING', lastChunkSeq: sequence, contentType, updatedAt: new Date().toISOString() }, { merge: true });
        return res.status(201).json({ ok: true, recordingId: req.params.recordingId, seq: sequence });
    } catch (error) { return sendError(res, error); }
};

function extractTranscript(sttResponse, gcsUri) {
    const fileResult = sttResponse.results?.[gcsUri] || Object.values(sttResponse.results || {})[0];
    const results = fileResult?.inlineResult?.transcript?.results || fileResult?.transcript?.results || [];
    return results.map((item) => item.alternatives?.[0]?.transcript || '').filter(Boolean).join('\n').trim();
}

async function processRecording({ recordingId, ref, data, noteRef }) {
    const localInput = path.join(os.tmpdir(), `${recordingId}-assembled`);
    const localWav = path.join(os.tmpdir(), `${recordingId}.wav`);
    const chunkPrefix = `${data.gcsPrefix}/chunk-`;
    const assembledObject = `${data.gcsPrefix}/assembled.bin`;
    const audioObject = `${data.gcsPrefix}/audio.wav`;
    let stage = 'COMPOSE';
    try {
        const [files] = await bucket.getFiles({ prefix: chunkPrefix });
        if (!files.length) throw new Error('No recording chunks found');
        files.sort((a, b) => a.name.localeCompare(b.name));
        await composeMany(files.map((file) => file.name), assembledObject, 'application/octet-stream');
        stage = 'FFMPEG';
        await bucket.file(assembledObject).download({ destination: localInput });
        const raw = files[0].name.endsWith('.raw') || data.contentType === 'application/octet-stream';
        const inputArgs = raw ? ['-f', 's16le', '-ar', '16000', '-ac', '1', '-i', localInput] : ['-i', localInput];
        await execFFmpeg([...inputArgs, '-af', 'dynaudnorm=p=0.9:m=20:g=15', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', localWav]);
        await bucket.upload(localWav, { destination: audioObject, metadata: { contentType: 'audio/wav', cacheControl: 'private, no-store' } });
        stage = 'SPEECH';
        const gcsUri = `gs://${bucket.name}/${audioObject}`;
        const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.PROJECT_ID || 'yorisoi-dev-477515';
        // Keep diagnosis audio in the Tokyo regional endpoint. The long model
        // is the verified Japanese V2 path used by the related Yorisoi app.
        const location = process.env.STT_LOCATION || 'asia-northeast1';
        const model = process.env.STT_MODEL || 'long';
        const speechClient = new SpeechClient({ apiEndpoint: `${location}-speech.googleapis.com` });
        const [operation] = await speechClient.batchRecognize({
            recognizer: `projects/${projectId}/locations/${location}/recognizers/_`,
            config: { autoDecodingConfig: {}, model, languageCodes: ['ja-JP'], features: { enableAutomaticPunctuation: true } },
            files: [{ uri: gcsUri }],
            recognitionOutputConfig: { inlineResponseConfig: {} },
        });
        const [sttResponse] = await operation.promise();
        const transcript = extractTranscript(sttResponse, gcsUri);
        if (transcript.length < 2) throw new Error('音声から会話を文字起こしできませんでした');
        await noteRef.set({ status: 'ANALYZING', transcript, audioObject, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        stage = 'ANALYSIS';
        const analysis = await analyzeVisitNote({ transcript, familyMemo: data.familyMemo });
        await noteRef.set({ ...analysis, status: 'COMPLETED', transcript, audioObject, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        await ref.set({ status: 'PROCESSED', transcript, audioObject, analysisModel: analysis.model, processedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
        stage = 'CLEANUP';
        await Promise.all([...files.map((file) => file.delete({ ignoreNotFound: true })), bucket.file(assembledObject).delete({ ignoreNotFound: true })]);
    } catch (error) {
        console.error(`[VisitRecording] processing failed recording=${recordingId} stage=${stage} type=${error.code || error.name || 'Error'} message=${String(error.message || '').slice(0, 240)}`);
        await ref.set({ status: 'FAILED', failureStage: stage, errorMessage: String(error.message || 'processing failed').slice(0, 300), updatedAt: new Date().toISOString() }, { merge: true });
        await noteRef.set({ status: 'FAILED', errorMessage: '録音の処理を完了できませんでした。もう一度お試しください。', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    } finally {
        await Promise.all([fs.promises.unlink(localInput).catch(() => {}), fs.promises.unlink(localWav).catch(() => {})]);
    }
}

exports.finalizeRecording = async (req, res) => {
    try {
        const owned = await getOwnedRecording(req, ['owner', 'editor']);
        if (['PROCESSING', 'PROCESSED'].includes(owned.data.status)) return res.json({ ok: true, status: owned.data.status, noteId: owned.data.noteId || null });
        const noteRef = notesRef(owned.familyId, owned.patientId).doc();
        const now = new Date().toISOString();
        await noteRef.set({
            tenantId: req.tenantId, familyId: owned.familyId, patientId: owned.patientId,
            recordingId: req.params.recordingId, createdByMemberId: req.user.uid,
            visitDate: owned.data.visitDate, clinicName: owned.data.clinicName || '', department: owned.data.department || '',
            familyMemo: String(req.body.familyMemo || owned.data.familyMemo || '').trim().slice(0, 2000),
            status: 'PROCESSING', inputMode: 'voice', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await owned.ref.set({ status: 'PROCESSING', noteId: noteRef.id, updatedAt: now }, { merge: true });
        res.status(202).json({ ok: true, status: 'PROCESSING', recordingId: req.params.recordingId, noteId: noteRef.id });
        setImmediate(() => processRecording({ recordingId: req.params.recordingId, ref: owned.ref, data: { ...owned.data, familyMemo: req.body.familyMemo || owned.data.familyMemo }, noteRef }));
    } catch (error) { return sendError(res, error); }
};

exports.getRecordingStatus = async (req, res) => {
    try {
        const owned = await getOwnedRecording(req);
        let note = null;
        if (owned.data.noteId) {
            const noteSnapshot = await notesRef(owned.familyId, owned.patientId).doc(owned.data.noteId).get();
            if (noteSnapshot.exists) note = { id: noteSnapshot.id, ...noteSnapshot.data() };
        }
        return res.json({ ok: true, recordingId: req.params.recordingId, status: owned.data.status, failureStage: owned.data.status === 'FAILED' ? owned.data.failureStage || 'UNKNOWN' : null, note });
    } catch (error) { return sendError(res, error); }
};

exports.cancelRecording = async (req, res) => {
    try {
        const owned = await getOwnedRecording(req, ['owner', 'editor']);
        if (owned.data.status === 'PROCESSED') return res.status(409).json({ ok: false, error: 'Processed recording must be deleted from the visit note' });
        const [files] = await bucket.getFiles({ prefix: `${owned.data.gcsPrefix}/` });
        await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
        if (owned.data.noteId) await notesRef(owned.familyId, owned.patientId).doc(owned.data.noteId).delete().catch(() => {});
        await owned.ref.delete();
        return res.json({ ok: true, deletedRecordingId: req.params.recordingId });
    } catch (error) { return sendError(res, error); }
};

exports.getVisitNoteAudio = async (req, res) => {
    try {
        const familyId = getFamilyId(req);
        const patientId = getPatientId(req);
        await assertPatient(familyId, patientId, req.tenantId, req.user?.uid);
        const snapshot = await notesRef(familyId, patientId).doc(req.params.id).get();
        if (!snapshot.exists || snapshot.data().tenantId !== req.tenantId || !snapshot.data().audioObject) return res.status(404).json({ ok: false, error: 'Audio not found' });
        res.type('audio/wav').set('Cache-Control', 'private, no-store');
        const stream = bucket.file(snapshot.data().audioObject).createReadStream();
        stream.on('error', (error) => { if (!res.headersSent) sendError(res, error); else res.destroy(error); });
        return stream.pipe(res);
    } catch (error) { return sendError(res, error); }
};

module.exports.normalizeNote = normalizeNote;
module.exports.extractTranscript = extractTranscript;
