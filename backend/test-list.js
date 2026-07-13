const http = require('http');

function request(options) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function run() {
    console.log('Testing GET /api/facilities (List)...');
    const res = await request({
        hostname: 'localhost',
        port: 8081,
        path: '/api/facilities',
        method: 'GET'
    });
    console.log('Status:', res.statusCode);
    console.log('Body:', res.body);
}

run();
