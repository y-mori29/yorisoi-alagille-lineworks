const { db } = require('../config/firebase');

// 親patientの所有テナント検証ヘルパー
async function assertOwnedPatient(patientId, tenantId) {
    const doc = await db.collection('patients').doc(patientId).get();
    if (!doc.exists || doc.data().tenantId !== tenantId) {
        const err = new Error('Patient not found');
        err.status = 404;
        throw err;
    }
    return doc;
}

// Create Encounter
exports.createEncounter = async (req, res) => {
    try {
        const { patientId, facilityId, roomId, stayId, source, data } = req.body;

        if (!patientId || !facilityId) {
            return res.status(400).json({ error: 'patientId and facilityId are required' });
        }

        await assertOwnedPatient(patientId, req.tenantId);

        const newEncounter = {
            tenantId: req.tenantId,
            patientId,
            facilityId,
            roomId: roomId || null,
            stayId: stayId || null,
            source: source || 'MOBILE_RECORDING',
            data: data || null,
            status: 'OPEN',
            createdAt: new Date().toISOString()
        };

        const docRef = await db.collection(`patients/${patientId}/encounters`).add(newEncounter);
        res.status(201).json({ encounterId: docRef.id, patientId });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// List Encounters
exports.listEncounters = async (req, res) => {
    try {
        const { patientId } = req.query;
        if (!patientId) return res.status(400).json({ error: 'patientId required' });

        await assertOwnedPatient(patientId, req.tenantId);

        // tenant絞りを足す（親patient所有検証で実質越境不可だが二重防壁）
        const snapshot = await db.collection(`patients/${patientId}/encounters`)
            .where('tenantId', '==', req.tenantId).get();

        const encounters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        encounters.sort((a, b) => {
            const dateA = a.date || a.createdAt || '';
            const dateB = b.date || b.createdAt || '';
            return dateB.localeCompare(dateA);
        });

        res.json({ ok: true, encounters: encounters.slice(0, 20) });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Create family visit note for disease-specific patient app.
// This is separate from the legacy facility-bound encounter API.
exports.createVisitNote = async (req, res) => {
    try {
        const patientId = req.body.patientId || req.query.patientId || req.headers['x-patient-id'];
        if (!patientId) return res.status(400).json({ error: 'patientId required' });

        await assertOwnedPatient(patientId, req.tenantId);

        const now = new Date().toISOString();
        const visitDate = req.body.visitDate || now.slice(0, 10);
        const patientView = req.body.patient_view || req.body.patientView || null;
        const newEncounter = {
            tenantId: req.tenantId,
            patientId,
            diseaseId: req.body.diseaseId || req.query.disease || 'alagille',
            facilityId: req.body.facilityId || null,
            clinicId: req.body.clinicId || null,
            clinicName: req.body.clinicName || req.body.facilityName || '',
            facilityName: req.body.facilityName || req.body.clinicName || '',
            department: req.body.department || '',
            visitDate,
            date: visitDate,
            status: 'COMPLETED',
            type: 'VISIT_NOTE',
            recordType: 'visit-note',
            inputMode: req.body.inputMode || 'text',
            source: 'ALAGILLE_VISIT_NOTE',
            patient_view: patientView,
            summary: patientView?.headline || '',
            rawText: req.body.rawText || '',
            patientMemo: req.body.familyNote || req.body.patientMemo || '',
            questionNote: req.body.questionNote || '',
            createdAt: now,
            updatedAt: now,
        };

        const docRef = await db.collection(`patients/${patientId}/encounters`).add(newEncounter);
        res.status(201).json({ ok: true, encounterId: docRef.id, id: docRef.id, ...newEncounter });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

exports.listVisitNotes = async (req, res) => {
    try {
        const patientId = req.query.patientId || req.headers['x-patient-id'];
        if (!patientId) return res.status(400).json({ error: 'patientId required' });

        await assertOwnedPatient(patientId, req.tenantId);

        const snapshot = await db.collection(`patients/${patientId}/encounters`)
            .where('tenantId', '==', req.tenantId)
            .where('source', '==', 'ALAGILLE_VISIT_NOTE')
            .get();

        const notes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        notes.sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
        res.json({ ok: true, notes: notes.slice(0, 20) });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};