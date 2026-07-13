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
        const facilityId = '8HjrjwVSTsvcoUscxlwr'; // From seed
        console.log(`Testing GET /api/facilities/${facilityId}/board...`);
        const res = await request({
            hostname: 'localhost',
            port: 8081,
            path: `/api/facilities/${facilityId}/board`,
            method: 'GET'
        });

        console.log('Status:', res.statusCode);
        console.log('Body:', res.body.substring(0, 500) + '...');
        // Truncate output
    } catch (e) {
        console.error('Error:', e);
    }
}

run();
