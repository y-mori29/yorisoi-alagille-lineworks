const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function run() {
    try {
        // 1. Create Encounter
        console.log('Testing (1) POST /api/encounters...');
        const encData = JSON.stringify({
            patientId: "test_pat_1",
            facilityId: "test_fac_1",
            source: "TEST_SCRIPT"
        });
        const encRes = await request({
            hostname: 'localhost',
            port: 8081,
            path: '/api/encounters',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(encData) }
        }, encData);
        console.log('Result:', encRes.statusCode, encRes.body);
        const encJson = JSON.parse(encRes.body);
        const encounterId = encJson.encounterId;

        if (!encounterId) {
            console.error("No encounter ID returned");
            return;
        }

        // 2. Sign Upload
        console.log('Testing (2) POST /api/recordings:signUpload...');
        const signData = JSON.stringify({
            encounterId: encounterId,
            contentType: "audio/webm"
        });
        const signRes = await request({
            hostname: 'localhost',
            port: 8081,
            path: '/api/recordings:signUpload',
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(signData) }
        }, signData);
        console.log('Result:', signRes.statusCode, signRes.body);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
