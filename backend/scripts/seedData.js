const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { db } = require('../src/config/firebase');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
    try {
        console.log('Starting seed...');

        // 1. Check/Create Facility
        const facilitiesRaw = await db.collection('facilities').get();
        let facilityId;

        if (facilitiesRaw.empty) {
            console.log('No facilities found. Creating Demo Facility...');
            const docRef = await db.collection('facilities').add({
                name: 'デモ用ケアセンター',
                address: '東京都千代田区1-1',
                note: 'これは自動生成されたデモ施設です',
                createdAt: new Date().toISOString()
            });
            facilityId = docRef.id;
            console.log(`Created Facility: ${docRef.id}`);
        } else {
            const firstDoc = facilitiesRaw.docs[0];
            facilityId = firstDoc.id;
            console.log(`Using existing Facility: ${firstDoc.data().name} (${facilityId})`);
        }

        // 2. Check Patients
        const patientsRaw = await db.collection('patients').where('facilityId', '==', facilityId).get();

        if (!patientsRaw.empty) {
            console.log(`Patients already exist for facility ${facilityId}. Skipping creation.`);
            process.exit(0);
        }

        console.log('Creating Demo Patients...');

        const demoPatients = [
            { name: '山田 太郎', kana: 'ヤマダ タロウ', gender: 'M', dob: '1940-01-01', roomNumber: '101' },
            { name: '鈴木 花子', kana: 'スズキ ハナコ', gender: 'F', dob: '1945-05-05', roomNumber: '102' },
            { name: '佐藤 次郎', kana: 'サトウ ジロウ', gender: 'M', dob: '1950-10-10', roomNumber: '201' }
        ];

        for (const p of demoPatients) {
            const pid = uuidv4();
            await db.collection('patients').doc(pid).set({
                id: pid,
                ...p,
                facilityId,
                status: 'incomplete',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            console.log(`Created Patient: ${p.name}`);
        }

        console.log('Seed completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Seed Failed:', error);
        process.exit(1);
    }
};

seedData();
