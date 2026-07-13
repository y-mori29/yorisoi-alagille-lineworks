const fs = require('fs');
const os = require('os');
const path = require('path');
const { SpeechClient } = require('@google-cloud/speech');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../config/firebase');
const { execFFmpeg } = require('../utils/mediaUtils');

function today() {
    return new Date().toISOString().slice(0, 10);
}

function parseAudioDataUri(audio) {
    const raw = String(audio || '');
    const match = raw.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
        const err = new Error('audio must be a data URI');
        err.status = 400;
        throw err;
    }
    const contentType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) {
        const err = new Error('audio is empty');
        err.status = 400;
        throw err;
    }
    if (buffer.length > 25 * 1024 * 1024) {
        const err = new Error('audio is too large for direct transcription');
        err.status = 413;
        throw err;
    }
    const extMap = {
        'audio/webm': 'webm',
        'audio/mp4': 'mp4',
        'audio/mpeg': 'mp3',
        'audio/ogg': 'ogg',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
    };
    const baseType = contentType.split(';')[0].toLowerCase();
    return { buffer, contentType, extension: extMap[baseType] || 'webm' };
}

function getPatientId(req) {
    return req.query.patientId || req.headers['x-patient-id'] || req.body?.patientId || '';
}

async function assertOwnedPatient(patientId, tenantId) {
    if (!patientId) {
        const err = new Error('patientId required');
        err.status = 400;
        throw err;
    }
    const doc = await db.collection('patients').doc(patientId).get();
    if (!doc.exists || doc.data().tenantId !== tenantId) {
        const err = new Error('Patient not found');
        err.status = 404;
        throw err;
    }
    return doc;
}

function clinicRef(patientId, id) {
    return db.collection('patients').doc(patientId).collection('clinics').doc(id);
}

function encounterRef(patientId, id) {
    return db.collection('patients').doc(patientId).collection('encounters').doc(id);
}

function timelineRef(patientId, id) {
    return db.collection('patients').doc(patientId).collection('timeline').doc(id);
}

function encounterToVisit(id, data) {
    const pv = data.patient_view || {};
    const date = (data.visitDate || data.date || data.createdAt || '').slice(0, 10);
    return {
        id,
        date,
        clinicId: data.clinicId || null,
        clinicName: data.facilityName || '',
        department: data.department || '',
        chiefComplaint: pv.title || '',
        findings: [pv.headline, ...(pv.points || [])].filter(Boolean).join('\n'),
        nextAction: (pv.care_points || []).join('\n'),
        medTalk: pv.med_talk || '',
        patient_view: pv,
        relatedTimelineEventId: data.relatedTimelineEventId || id,
        sourceEncounterId: id,
        recordType: data.recordType || 'visit',
        inputMode: data.inputMode || '',
    };
}

function encounterToTimeline(id, data) {
    const pv = data.patient_view || {};
    const category = data.recordType === 'self-log' ? 'self-log' : 'visit';
    return {
        id,
        date: (data.visitDate || data.date || data.createdAt || today()).slice(0, 10),
        category,
        title: pv.title || (category === 'visit' ? '受診の記録' : 'ふだんの記録'),
        detail: pv.headline || '',
        source: data.inputMode || 'encounter',
        sourceEncounterId: id,
    };
}

exports.listClinics = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const snap = await db.collection('patients').doc(patientId).collection('clinics').get();
        const clinics = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        clinics.sort((a, b) => Number(Boolean(b.isPrimary)) - Number(Boolean(a.isPrimary)) || (a.name || '').localeCompare(b.name || ''));
        res.json(clinics);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.createClinic = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const now = new Date().toISOString();
        const docRef = db.collection('patients').doc(patientId).collection('clinics').doc();
        const data = {
            name: req.body.name || '',
            departments: Array.isArray(req.body.departments) ? req.body.departments : [],
            address: req.body.address || '',
            phone: req.body.phone || '',
            note: req.body.note || '',
            isPrimary: Boolean(req.body.isPrimary),
            createdAt: now,
            updatedAt: now,
        };
        await docRef.set(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.updateClinic = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const updates = {
            name: req.body.name || '',
            departments: Array.isArray(req.body.departments) ? req.body.departments : [],
            address: req.body.address || '',
            phone: req.body.phone || '',
            note: req.body.note || '',
            isPrimary: Boolean(req.body.isPrimary),
            updatedAt: new Date().toISOString(),
        };
        await clinicRef(patientId, req.params.id).set(updates, { merge: true });
        res.json({ id: req.params.id, ...updates });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.deleteClinic = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        await clinicRef(patientId, req.params.id).delete();
        res.json({ ok: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.listVisits = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const snap = await db.collection('patients').doc(patientId).collection('encounters')
            .where('tenantId', '==', req.tenantId).get();
        const visits = snap.docs
            .map((doc) => encounterToVisit(doc.id, doc.data()))
            .filter((visit) => visit.recordType !== 'self-log');
        visits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.json(visits);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.createVisit = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const now = new Date().toISOString();
        const docRef = db.collection('patients').doc(patientId).collection('encounters').doc();
        const patientView = {
            title: (req.body.chiefComplaint || '受診の記録').slice(0, 30),
            headline: req.body.findings || '',
            points: req.body.findings ? String(req.body.findings).split('\n').filter(Boolean).slice(0, 5) : [],
            med_talk: '',
            care_points: req.body.nextAction ? [req.body.nextAction] : [],
        };
        const data = {
            tenantId: req.tenantId,
            patientId,
            clinicId: req.body.clinicId || null,
            facilityName: req.body.clinicName || '',
            department: req.body.department || '',
            visitDate: req.body.date || today(),
            date: req.body.date || today(),
            status: 'COMPLETED',
            type: 'VISIT_MANUAL',
            recordType: 'visit',
            inputMode: req.body.inputMode || 'memo',
            patient_view: patientView,
            relatedTimelineEventId: req.body.relatedTimelineEventId || null,
            createdAt: now,
            updatedAt: now,
        };
        await docRef.set(data);
        res.status(201).json(encounterToVisit(docRef.id, data));
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.updateVisit = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        await encounterRef(patientId, req.params.id).set({
            relatedTimelineEventId: req.body.relatedTimelineEventId || null,
            updatedAt: new Date().toISOString(),
        }, { merge: true });
        res.json({ ok: true, id: req.params.id });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.listTimeline = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const [timelineSnap, encounterSnap] = await Promise.all([
            db.collection('patients').doc(patientId).collection('timeline').get(),
            db.collection('patients').doc(patientId).collection('encounters').where('tenantId', '==', req.tenantId).get(),
        ]);
        const explicit = timelineSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const explicitSourceIds = new Set(explicit.map((item) => item.sourceEncounterId).filter(Boolean));
        const derived = encounterSnap.docs
            .filter((doc) => !explicitSourceIds.has(doc.id))
            .map((doc) => encounterToTimeline(doc.id, doc.data()));
        const items = [...explicit, ...derived];
        items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        res.json(items);
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.createTimeline = async (req, res) => {
    try {
        const patientId = getPatientId(req);
        await assertOwnedPatient(patientId, req.tenantId);
        const now = new Date().toISOString();
        const docRef = db.collection('patients').doc(patientId).collection('timeline').doc();
        const data = {
            date: req.body.date || today(),
            category: req.body.category || 'other',
            title: req.body.title || '',
            detail: req.body.detail || '',
            source: req.body.source || 'manual',
            sourceEncounterId: req.body.sourceEncounterId || null,
            createdAt: now,
            updatedAt: now,
        };
        await docRef.set(data);
        res.status(201).json({ id: docRef.id, ...data });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.listMedications = (_req, res) => res.json([]);
exports.listLabs = (_req, res) => res.json([]);

exports.parseRecord = (req, res) => {
    const rawText = String(req.body.rawText || req.body.text || '').trim();
    const knownClinics = Array.isArray(req.body.knownClinics) ? req.body.knownClinics : [];
    const suggested = knownClinics[0] || null;
    res.json({
        type: rawText.includes('受診') || rawText.includes('先生') || rawText.includes('病院') ? 'visit' : 'self-log',
        confidence: rawText ? 0.72 : 0,
        findings: rawText,
        nextActionDraft: '',
        selfLogTitle: rawText.slice(0, 30) || 'ふだんの記録',
        selfLogDetail: rawText,
        suggestedClinicId: suggested?.id || null,
        suggestedDepartment: suggested?.departments?.[0] || '',
    });
};

exports.transcribeAudio = async (req, res) => {
    const workId = uuidv4();
    const tempDir = os.tmpdir();
    let inputPath = '';
    let wavPath = '';

    try {
        const { buffer, extension } = parseAudioDataUri(req.body.audio);
        inputPath = path.join(tempDir, `${workId}.${extension}`);
        wavPath = path.join(tempDir, `${workId}.wav`);
        await fs.promises.writeFile(inputPath, buffer);

        await execFFmpeg([
            '-i', inputPath,
            '-af', 'dynaudnorm=p=0.9:m=20:g=15',
            '-ar', '16000',
            '-ac', '1',
            '-c:a', 'pcm_s16le',
            wavPath,
        ]);

        const wavBuffer = await fs.promises.readFile(wavPath);
        const speechClient = new SpeechClient({
            projectId: process.env.PROJECT_ID || 'yorisoi-medical',
        });
        const [response] = await speechClient.recognize({
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: 16000,
                languageCode: 'ja-JP',
                enableAutomaticPunctuation: true,
            },
            audio: {
                content: wavBuffer.toString('base64'),
            },
        });

        const transcript = (response.results || [])
            .map((result) => result.alternatives?.[0]?.transcript || '')
            .filter(Boolean)
            .join('\n')
            .trim();

        res.json({
            ok: true,
            transcript,
            confidence: response.results?.[0]?.alternatives?.[0]?.confidence || null,
        });
    } catch (error) {
        console.error('TranscribeAudio error:', error);
        res.status(error.status || 500).json({ error: error.message });
    } finally {
        await Promise.all([
            inputPath ? fs.promises.unlink(inputPath).catch(() => {}) : null,
            wavPath ? fs.promises.unlink(wavPath).catch(() => {}) : null,
        ]);
    }
};

exports.chatRecord = (req, res) => {
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const last = [...messages].reverse().find((m) => m && m.role === 'user');
    const message = String(req.body.message || last?.content || '').trim();
    const suggestEnd = /もう?(大丈夫|いい|ok|オーケー|十分)|これで|終わ(り|る|ろ)|保存|次へ|ありがとう|おやすみ/.test(message.toLowerCase());
    res.json({
        reply: suggestEnd
            ? 'ここまでの内容で記録に進めます。必要ならあとで言い回しを直せます。'
            : message
                ? 'ありがとうございます。診察で言われたこと、薬の変更、次に聞きたいことがあれば続けて書けます。'
                : '今日はどんなことを記録しておきますか？',
        suggestEnd,
    });
};

exports.summarizeOtherVisits = (req, res) => {
    const visits = Array.isArray(req.body.otherVisits) ? req.body.otherVisits : [];
    const summary = visits
        .slice(0, 3)
        .map((v) => `・${v.clinicName || '他の医療機関'} ${v.department || ''}: ${(v.findings || '').replace(/\s+/g, ' ').slice(0, 60)}`)
        .join('\n');
    res.json({ summary: summary || '他の診療科での記録はまだありません。' });
};

module.exports.getPatientId = getPatientId;
module.exports.assertOwnedPatient = assertOwnedPatient;
