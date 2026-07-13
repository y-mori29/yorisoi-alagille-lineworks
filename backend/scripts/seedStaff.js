// デモスタッフを pharmacy DB の staffs コレクションに作成する。
// 使い方: node scripts/seedStaff.js <tenantId> <loginId> <password> <name> [role]
// 例:     node scripts/seedStaff.js tenant-demo-a 000001 123456 "薬局スタッフ" admin
require('dotenv').config();
const { db } = require('../src/config/firebase');
const bcrypt = require('bcryptjs');

async function main() {
    const [tenantId, loginId, password, name, role] = process.argv.slice(2);
    if (!tenantId || !loginId || !password || !name) {
        console.error('Usage: node scripts/seedStaff.js <tenantId> <loginId> <password> <name> [role]');
        process.exit(1);
    }

    const existing = await db.collection('staffs')
        .where('tenantId', '==', tenantId)
        .where('loginId', '==', loginId)
        .limit(1)
        .get();

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    if (!existing.empty) {
        await existing.docs[0].ref.update({ passwordHash, name, role: role || 'admin', updatedAt: now });
        console.log(`updated staff: ${tenantId}/${loginId} (${existing.docs[0].id})`);
    } else {
        const ref = await db.collection('staffs').add({
            tenantId,
            loginId,
            passwordHash,
            name,
            role: role || 'admin',
            createdAt: now,
            updatedAt: now,
        });
        console.log(`created staff: ${tenantId}/${loginId} (${ref.id})`);
    }
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
