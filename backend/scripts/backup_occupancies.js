const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'yorisoi-medical'
    });
}

const db = admin.firestore();

async function backupOccupancies() {
    console.log('Starting backup of Occupancies...');

    try {
        const facilitiesSnap = await db.collection('facilities').get();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '..', 'backups');

        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir);
        }

        const backupData = {};

        for (const facDoc of facilitiesSnap.docs) {
            const facilityId = facDoc.id;
            console.log(`Scanning Facility: ${facDoc.data().name} (${facilityId})`);

            const occRef = db.collection(`facilities/${facilityId}/occupancies`);
            const occSnap = await occRef.get();

            const records = [];
            occSnap.forEach(doc => {
                records.push({ id: doc.id, ...doc.data() });
            });

            backupData[facilityId] = records;
            console.log(`  Backed up ${records.length} records.`);
        }

        const filepath = path.join(backupDir, `occupancies_backup_${timestamp}.json`);
        fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));
        console.log(`\nBackup saved to: ${filepath}`);

    } catch (e) {
        console.error('Error during backup:', e);
    }
}

backupOccupancies();
