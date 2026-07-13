const { db } = require('../config/firebase');

// Tenant強制の鉄則（patientController.jsと同じ）：
// - 書き込み doc には req.tenantId を必ず付与
// - 読み取りクエリには where('tenantId','==', req.tenantId) を必ず付与
// - 単体取得は doc取得後に tenantId 一致を検証。不一致なら 404
// - facility配下のrooms/stays/occupanciesは親facilityのtenant検証で守る

const getRefs = (facilityId) => ({
    rooms: db.collection(`facilities/${facilityId}/rooms`),
    stays: db.collection(`facilities/${facilityId}/stays`),
    occupancies: db.collection(`facilities/${facilityId}/occupancies`),
});

// 親facilityの所有テナント検証ヘルパー
async function assertOwnedFacility(facilityId, tenantId) {
    const doc = await db.collection('facilities').doc(facilityId).get();
    if (!doc.exists || doc.data().tenantId !== tenantId) {
        const err = new Error('Facility not found');
        err.status = 404;
        throw err;
    }
    return doc;
}

// Create Facility
exports.createFacility = async (req, res) => {
    try {
        const { name, address, note } = req.body;
        const docRef = await db.collection('facilities').add({
            tenantId: req.tenantId,
            name, address, note,
            sortIndex: 0,
            createdAt: new Date().toISOString()
        });
        res.status(201).json({ facilityId: docRef.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Bulk Upsert Rooms
exports.bulkUpsertRooms = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { rooms } = req.body;
        if (!rooms || !Array.isArray(rooms)) return res.status(400).json({ error: 'rooms array required' });

        await assertOwnedFacility(facilityId, req.tenantId);

        const batch = db.batch();
        const roomsColl = db.collection(`facilities/${facilityId}/rooms`);
        const resultRooms = [];

        rooms.forEach((roomData, index) => {
            const docRef = roomsColl.doc();
            const payload = {
                ...roomData,
                tenantId: req.tenantId,
                sortIndex: index,
                updatedAt: new Date().toISOString()
            };
            batch.set(docRef, payload);
            resultRooms.push({ roomId: docRef.id, ...payload });
        });

        await batch.commit();
        res.json({ rooms: resultRooms });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Create Stay (and Occupancy)
exports.createStay = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { patient, type, startAt, endAt, initialLane, existingPatientId } = req.body;

        await assertOwnedFacility(facilityId, req.tenantId);

        let patientId = existingPatientId;

        if (!patientId) {
            const patRef = await db.collection('patients').add({
                tenantId: req.tenantId,
                name: patient.displayName,
                kana: patient.kana || '',
                dob: patient.dob || null,
                gender: patient.gender || 'unknown',
                facilityId,
                createdAt: new Date().toISOString()
            });
            patientId = patRef.id;
        } else {
            // 既存患者の所有テナント検証
            const patDoc = await db.collection('patients').doc(patientId).get();
            if (!patDoc.exists || patDoc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Patient not found' });
            }
            await db.collection('patients').doc(patientId).update({
                facilityId,
                updatedAt: new Date().toISOString()
            });
        }

        const { stays, occupancies } = getRefs(facilityId);

        const stayRef = await stays.add({
            tenantId: req.tenantId,
            patientId,
            type: type || 'LONG',
            status: 'ACTIVE',
            startAt: startAt || new Date().toISOString(),
            endAt: endAt || null,
            createdAt: new Date().toISOString()
        });

        const existingOccupancy = await occupancies.doc(patientId).get();
        const existingRoomId = existingOccupancy.exists ? existingOccupancy.data().roomId : null;
        const existingLane = existingOccupancy.exists ? existingOccupancy.data().lane : null;

        const lane = existingRoomId ? existingLane : (initialLane || 'UNASSIGNED');
        const roomId = existingRoomId || null;

        await occupancies.doc(patientId).set({
            tenantId: req.tenantId,
            patientId,
            stayId: stayRef.id,
            roomId: roomId,
            lane: lane,
            state: roomId ? 'IN_ROOM' : (lane === 'UNASSIGNED' ? 'UNASSIGNED' : 'IN_ROOM'),
            updatedAt: new Date().toISOString()
        });

        res.json({
            patientId,
            stayId: stayRef.id,
            occupancy: {
                patientId, stayId: stayRef.id, roomId: roomId, lane, state: roomId ? 'IN_ROOM' : (lane === 'UNASSIGNED' ? 'UNASSIGNED' : 'IN_ROOM')
            }
        });

    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Pause Stay
exports.pauseStay = async (req, res) => {
    try {
        const { facilityId, stayId } = req.params;
        const { reason, note } = req.body;
        await assertOwnedFacility(facilityId, req.tenantId);

        const { stays, occupancies } = getRefs(facilityId);

        await stays.doc(stayId).update({
            status: 'PAUSED',
            pauseReason: reason,
            note,
            updatedAt: new Date().toISOString()
        });

        const stayDoc = await stays.doc(stayId).get();
        if (!stayDoc.exists) return res.status(404).json({ error: 'Stay not found' });
        const { patientId } = stayDoc.data();

        await occupancies.doc(patientId).update({
            lane: 'AWAY_HOSPITAL',
            state: 'AWAY_HOSPITAL',
            roomId: null,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Resume Stay
exports.resumeStay = async (req, res) => {
    try {
        const { facilityId, stayId } = req.params;
        await assertOwnedFacility(facilityId, req.tenantId);

        const { stays, occupancies } = getRefs(facilityId);

        await stays.doc(stayId).update({ status: 'ACTIVE', updatedAt: new Date().toISOString() });

        const stayDoc = await stays.doc(stayId).get();
        const { patientId } = stayDoc.data();

        await occupancies.doc(patientId).update({
            lane: 'UNASSIGNED',
            state: 'UNASSIGNED',
            roomId: null,
            updatedAt: new Date().toISOString()
        });

        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Move Occupancy
exports.moveOccupancy = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const { patientId, to } = req.body;
        await assertOwnedFacility(facilityId, req.tenantId);

        const { occupancies } = getRefs(facilityId);

        const updatePayload = { updatedAt: new Date().toISOString() };
        if (to.kind === 'ROOM') {
            updatePayload.lane = 'ROOM';
            updatePayload.state = 'IN_ROOM';
            updatePayload.roomId = to.roomId;
        } else if (to.kind === 'UNASSIGNED') {
            updatePayload.lane = 'UNASSIGNED';
            updatePayload.state = 'UNASSIGNED';
            updatePayload.roomId = null;
        } else if (to.kind === 'AWAY_HOSPITAL') {
            updatePayload.lane = 'AWAY_HOSPITAL';
            updatePayload.state = 'AWAY_HOSPITAL';
            updatePayload.roomId = null;
        }

        await occupancies.doc(patientId).update(updatePayload);

        const doc = await occupancies.doc(patientId).get();
        res.json({ ok: true, occupancy: { patientId, ...doc.data() } });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Get Board Data
exports.getBoard = async (req, res) => {
    try {
        const { facilityId } = req.params;
        const facSnap = await assertOwnedFacility(facilityId, req.tenantId);

        const [roomsSnap, occSnap, staysSnap] = await Promise.all([
            db.collection(`facilities/${facilityId}/rooms`).orderBy('sortIndex').get(),
            db.collection(`facilities/${facilityId}/occupancies`).get(),
            db.collection(`facilities/${facilityId}/stays`).where('status', '==', 'ACTIVE').get()
        ]);

        // 患者リストもtenant絞り（facilityIdで絞り済だが二重防壁）
        const patientsSnap = await db.collection('patients')
            .where('tenantId', '==', req.tenantId)
            .where('facilityId', '==', facilityId).get();
        const patientsMap = {};
        patientsSnap.docs.forEach(d => { patientsMap[d.id] = d.data(); });

        const occupancies = occSnap.docs.map(d => d.data());
        const staysMap = {};
        staysSnap.docs.forEach(d => { staysMap[d.id] = d.data(); });

        const buildCard = (occ) => {
            const pat = patientsMap[occ.patientId] || {};
            const stay = staysMap[occ.stayId] || {};
            return {
                patientId: occ.patientId,
                displayName: pat.name || 'Unknown',
                alerts: [],
                stayType: stay.type || 'LONG',
                stayId: stay.id,
                occupancyId: occ.patientId
            };
        };

        const lanes = { unassigned: [], awayHospital: [] };
        const roomPatientsMap = {};

        occupancies.forEach(occ => {
            const card = buildCard(occ);
            if (occ.lane === 'UNASSIGNED') {
                lanes.unassigned.push(card);
            } else if (occ.lane === 'AWAY_HOSPITAL') {
                lanes.awayHospital.push(card);
            } else if (occ.roomId) {
                if (!roomPatientsMap[occ.roomId]) roomPatientsMap[occ.roomId] = [];
                roomPatientsMap[occ.roomId].push(card);
            }
        });

        const rooms = roomsSnap.docs.map(d => ({
            roomId: d.id,
            ...d.data(),
            patients: roomPatientsMap[d.id] || []
        }));

        res.json({
            facility: { facilityId: facSnap.id, ...facSnap.data() },
            lanes,
            rooms
        });

    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// List Facilities (tenant強制絞り)
exports.listFacilities = async (req, res) => {
    try {
        const snapshot = await db.collection('facilities')
            .where('tenantId', '==', req.tenantId).get();

        let facilities = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        facilities.sort((a, b) => {
            const aIndex = (a.sortIndex !== undefined && a.sortIndex !== null) ? a.sortIndex : Number.MAX_SAFE_INTEGER;
            const bIndex = (b.sortIndex !== undefined && b.sortIndex !== null) ? b.sortIndex : Number.MAX_SAFE_INTEGER;
            if (aIndex !== bIndex) return aIndex - bIndex;
            return (a.name || '').localeCompare(b.name || '');
        });

        res.json({ facilities });
    } catch (error) {
        console.error("[listFacilities] Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Get specific facility by ID
exports.getFacilityById = async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db.collection('facilities').doc(id).get();
        if (!doc.exists || doc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Facility not found', id });
        }
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("[getFacilityById] Error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Delete Facility
exports.deleteFacility = async (req, res) => {
    try {
        const { facilityId } = req.params;
        await assertOwnedFacility(facilityId, req.tenantId);
        await db.collection('facilities').doc(facilityId).delete();
        res.json({ success: true });
    } catch (error) {
        res.status(error.status || 500).json({ error: error.message });
    }
};

// Reorder Facilities
exports.reorderFacilities = async (req, res) => {
    try {
        const { orders } = req.body;

        // 全対象facilityの所有テナント検証
        for (const item of orders) {
            const doc = await db.collection('facilities').doc(item.id).get();
            if (!doc.exists || doc.data().tenantId !== req.tenantId) {
                return res.status(404).json({ error: 'Facility not found', id: item.id });
            }
        }

        const batch = db.batch();
        orders.forEach(item => {
            const ref = db.collection('facilities').doc(item.id);
            batch.update(ref, { sortIndex: item.sortIndex });
        });

        await batch.commit();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
