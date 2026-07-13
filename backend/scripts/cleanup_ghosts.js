const admin = require('firebase-admin');

// Initialize Firebase Admin
// Assumes GOOGLE_APPLICATION_CREDENTIALS is set or gcloud auth is active
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'yorisoi-medical'
    });
}

const db = admin.firestore();

async function cleanupGhosts() {
    console.log('Starting cleanup of Unknown (ghost) patients...');

    try {
        // 1. Get all facilities to scan
        const facilitiesSnap = await db.collection('facilities').get();
        console.log(`Found ${facilitiesSnap.size} facilities.`);

        for (const facDoc of facilitiesSnap.docs) {
            const facilityId = facDoc.id;
            console.log(`\nScanning Facility: ${facDoc.data().name} (${facilityId})`);

            // 2. Get matched patients (to check existence efficiently)
            // We can't fetch all patients at once if too many, but for now let's query by facilityId
            const patientsSnap = await db.collection('patients').where('facilityId', '==', facilityId).get();
            const validPatientIds = new Set(patientsSnap.docs.map(d => d.id));
            console.log(`  Valid Patients in DB: ${validPatientIds.size}`);

            // 3. Get occupancies
            const occRef = db.collection(`facilities/${facilityId}/occupancies`);
            const occSnap = await occRef.get();
            console.log(`  Occupancies found: ${occSnap.size}`);

            const ghosts = [];

            for (const occDoc of occSnap.docs) {
                const data = occDoc.data();
                const patientId = data.patientId;

                // Check if patientId exists in our valid set
                // Note: If patient moved facilities but header wasn't updated, validPatientIds check might be insufficient?
                // `patientController` creates occupancy with patientId as key.

                // Better check: Verify if the patient document exists globally?
                // Since this script is consistent, let's double check individual doc if not in facility list
                // (To avoid deleting valid patients just moved to another facility but keeping old occupancy? That shouldn't happen in proper logic but...)

                let isValid = validPatientIds.has(patientId);
                if (!isValid) {
                    // Double check existence to be safe (GET request per suspect)
                    const pDoc = await db.collection('patients').doc(patientId).get();
                    if (pDoc.exists) {
                        isValid = true;
                    }
                }

                if (!isValid) {
                    ghosts.push(occDoc.id);
                    console.log(`    Found Ghost! Occupancy ID: ${occDoc.id} (Patient ID: ${patientId})`);
                }
            }

            // 4. Delete ghosts
            if (ghosts.length > 0) {
                console.log(`  Deleting ${ghosts.length} ghost records...`);
                const batch = db.batch();
                ghosts.forEach(id => {
                    batch.delete(occRef.doc(id));
                });
                await batch.commit();
                console.log('  Deleted.');
            } else {
                console.log('  No ghosts found.');
            }
        }
        console.log('\nCleanup Complete.');

    } catch (e) {
        console.error('Error during cleanup:', e);
    }
}

cleanupGhosts();
