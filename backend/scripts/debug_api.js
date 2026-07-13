const fetch = require('node-fetch'); // running in node environment

const API_BASE = 'http://localhost:8081';

async function verify() {
    try {
        console.log('--- Fetching Facilities ---');
        const facRes = await fetch(`${API_BASE}/api/facilities`);
        const facJson = await facRes.json();
        console.log('Facilities Response:', JSON.stringify(facJson, null, 2));

        let demoFacilityId = null;
        const facilities = facJson.facilities || facJson;
        if (Array.isArray(facilities)) {
            const demo = facilities.find(f => f.name.includes('デモ'));
            if (demo) {
                demoFacilityId = demo.id;
                console.log(`\nFound Demo Facility: ${demo.name} (ID: ${demoFacilityId})`);
            }
        }

        console.log('\n--- Fetching Patients ---');
        const patRes = await fetch(`${API_BASE}/api/patients`);
        const patJson = await patRes.json();
        console.log('Patients Response:', JSON.stringify(patJson, null, 2));

        const patients = patJson.patients || patJson;
        if (Array.isArray(patients)) {
            console.log(`\nTotal Patients: ${patients.length}`);
            if (demoFacilityId) {
                const matched = patients.filter(p => String(p.facilityId) === String(demoFacilityId));
                console.log(`Patients matching Demo Facility ID (${demoFacilityId}): ${matched.length}`);
                matched.forEach(p => console.log(` - ${p.name} (fid: ${p.facilityId})`));
            }
        } else {
            console.log('Patients data is not an array.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

verify();
