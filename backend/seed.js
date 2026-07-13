require('dotenv').config();
const { db } = require('./src/config/firebase');

async function seed() {
    console.log('Starting seed...');

    try {
        // 1. Create Facility
        console.log('Creating Facility...');
        const facRef = await db.collection('facilities').add({
            name: 'デモ用ケアセンター',
            address: '東京都千代田区1-1-1',
            createdAt: new Date().toISOString()
        });
        const facilityId = facRef.id;
        console.log(`Facility Created: ${facilityId}`);

        // 2. Create Rooms
        console.log('Creating Rooms...');
        const rooms = [
            { roomNumber: "101", label: "101号室", sortIndex: 1010 },
            { roomNumber: "102", label: "102号室", sortIndex: 1020 },
            { roomNumber: "201", label: "201号室", sortIndex: 2010 },
            { roomNumber: "202", label: "202号室", sortIndex: 2020 }
        ];
        const batch = db.batch();
        const roomsColl = db.collection(`facilities/${facilityId}/rooms`);

        // Keep track of room IDs for assignment
        const roomIds = [];

        rooms.forEach(r => {
            const doc = roomsColl.doc();
            batch.set(doc, r);
            roomIds.push(doc.id);
        });
        await batch.commit();

        // 3. Create Patients
        console.log('Creating Patients...');
        const patientsData = [
            { name: '山田 太郎', kana: 'ヤマダ タロウ', gender: 'male' },
            { name: '佐藤 花子', kana: 'サトウ ハナコ', gender: 'female' },
            { name: '鈴木 一郎', kana: 'スズキ イチロウ', gender: 'male' },
        ];

        for (const p of patientsData) {
            const pRef = await db.collection('patients').add({
                ...p,
                facilityId,
                createdAt: new Date().toISOString()
            });
            const patientId = pRef.id;

            // Create ACTIVE Stay (Long Term)
            const stayRef = await db.collection(`facilities/${facilityId}/stays`).add({
                patientId,
                type: 'LONG',
                status: 'ACTIVE',
                startAt: new Date().toISOString(),
                createdAt: new Date().toISOString()
            });

            // Create Occupancy (Unassigned for now)
            await db.collection(`facilities/${facilityId}/occupancies`).doc(patientId).set({
                patientId,
                stayId: stayRef.id,
                roomId: null,
                lane: 'UNASSIGNED',
                state: 'UNASSIGNED',
                updatedAt: new Date().toISOString()
            });
        }

        console.log('Seed completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Seed failed:', e);
        process.exit(1);
    }
}

seed();
