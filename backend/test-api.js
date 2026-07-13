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
        // 1. Validating Health
        console.log('Testing GET /api/test...');
        const test = await request({
            hostname: 'localhost',
            port: 8081,
            path: '/api/test',
            method: 'GET'
        });
        console.log('Result:', test.statusCode, test.body);

        // 2. Creating Facility
        console.log('Testing POST /api/facilities...');
        const postData = JSON.stringify({ name: "Firestore Test Facility", address: "Cloud City" });
        const create = await request({
            hostname: 'localhost',
            port: 8081,
            path: '/api/facilities',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, postData);
        console.log('Result:', create.statusCode, create.body);

    } catch (e) {
        console.error('Error:', e);
    }
}

run();
