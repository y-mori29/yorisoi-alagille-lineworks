// pharmacy DB に【2テナント】のデモデータを投入し、テナント分離の構造を実証する。
// 6/12 副田MTG向け。光本番(default)には絶対に書かない（firebase.js のガードで弾かれる）。
//
// 投入内容：
//   tenant-demo-a（デモ薬局A）
//     - facility: demo-a-store-01（A店舗）
//     - patient:  demo-a-patient-01（A太郎）
//   tenant-demo-b（デモ薬局B）
//     - facility: demo-b-store-01（B店舗）
//     - patient:  demo-b-patient-01（B花子）
//
// 実行: node scripts/seed-demo-pharmacy.js

require('dotenv').config();
const { db } = require('../src/config/firebase');

const TENANTS = [
    {
        tenantId: 'tenant-demo-a',
        facility: { id: 'demo-a-store-01', name: 'デモ薬局A（梅田店）', address: '大阪市北区' },
        patient:  { id: 'demo-a-patient-01', name: 'A太郎', kana: 'エータロウ', dob: '1960-04-01', gender: 'male' },
    },
    {
        tenantId: 'tenant-demo-b',
        facility: { id: 'demo-b-store-01', name: 'デモ薬局B（難波店）', address: '大阪市中央区' },
        patient:  { id: 'demo-b-patient-01', name: 'B花子', kana: 'ビーハナコ', dob: '1955-07-15', gender: 'female' },
    },
];

(async () => {
    try {
        const now = new Date().toISOString();

        for (const t of TENANTS) {
            await db.collection('facilities').doc(t.facility.id).set({
                tenantId: t.tenantId,
                name: t.facility.name,
                address: t.facility.address,
                note: '2026-06-12 副田MTGデモ用',
                sortIndex: 0,
                createdAt: now,
            }, { merge: true });

            await db.collection('patients').doc(t.patient.id).set({
                id: t.patient.id,
                tenantId: t.tenantId,
                name: t.patient.name,
                kana: t.patient.kana,
                dob: t.patient.dob,
                gender: t.patient.gender,
                facilityId: t.facility.id,
                roomNumber: '',
                status: 'incomplete',
                createdAt: now,
                updatedAt: now,
            }, { merge: true });

            console.log(`✅ ${t.tenantId}: facility=${t.facility.id}, patient=${t.patient.id}`);
        }

        // 古いdemo-pharmacy-01 / demo-patient-01 がPhase2で投入されていれば、tenantIdを付けて tenant-demo-a に統合（または削除）
        // → 越境テストの邪魔になるので削除する
        for (const oldId of ['demo-pharmacy-01']) {
            const doc = await db.collection('facilities').doc(oldId).get();
            if (doc.exists && !doc.data().tenantId) {
                await db.collection('facilities').doc(oldId).delete();
                console.log(`🧹 旧データ削除: facilities/${oldId}（tenantId未設定）`);
            }
        }
        for (const oldId of ['demo-patient-01']) {
            const doc = await db.collection('patients').doc(oldId).get();
            if (doc.exists && !doc.data().tenantId) {
                await db.collection('patients').doc(oldId).delete();
                console.log(`🧹 旧データ削除: patients/${oldId}（tenantId未設定）`);
            }
        }

        const facSnap = await db.collection('facilities').get();
        const patSnap = await db.collection('patients').get();
        console.log(`\n📊 pharmacy DB 現在の件数：facilities=${facSnap.size}, patients=${patSnap.size}`);

        // tenant別件数表示
        for (const t of TENANTS) {
            const fc = await db.collection('facilities').where('tenantId', '==', t.tenantId).get();
            const pc = await db.collection('patients').where('tenantId', '==', t.tenantId).get();
            console.log(`   ${t.tenantId}: facilities=${fc.size}, patients=${pc.size}`);
        }

        process.exit(0);
    } catch (e) {
        console.error('❌ seed失敗:', e);
        process.exit(1);
    }
})();
