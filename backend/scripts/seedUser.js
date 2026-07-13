const { db } = require('../src/config/firebase');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('Seeding initial admin user...');
    const uid = '000001';
    const password = '123'; // Default password

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        await db.collection('users').doc(uid).set({
            email: '000001@yorisoi.local',
            displayName: '管理者',
            passwordHash,
            createdAt: new Date().toISOString()
        });

        console.log(`Success! User ${uid} created with password "${password}"`);
        process.exit(0);
    } catch (e) {
        console.error('Error seeding:', e);
        process.exit(1);
    }
}

seed();
