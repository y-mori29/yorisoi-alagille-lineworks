// デモ用患者・診察記録の投入スクリプト（2026-06-12 デモ用）。
// 使い方: node scripts/seedDemoData.js <jsonDir>
//   jsonDir 内の *.json（{patient:{name,lineUserId}, records:[...]} 形式）を pharmacy DB へ投入する。
// - 患者は lineUserId で upsert（「A太郎」だけは既存 demo-a-patient-01 へ転用し、
//   LINEから取得できない dob/gender/kana を削除する）
// - 再実行可能: demoSeed:true の既存 encounter を消してから入れ直す
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { admin, db } = require('../src/config/firebase');
const { v4: uuidv4 } = require('uuid');

const TENANT_ID = 'tenant-demo-a';
const FACILITY_ID = 'demo-a-store-01';
const ATARO_FIXED_ID = 'demo-a-patient-01';

async function upsertPatient(p) {
    const now = new Date().toISOString();

    if (p.name === 'A太郎') {
        // 既存デモ患者を転用。LINEから取れない属性は削除する（2026-06-12 森さん指示）
        await db.collection('patients').doc(ATARO_FIXED_ID).set({
            id: ATARO_FIXED_ID,
            tenantId: TENANT_ID,
            name: p.name,
            lineUserId: p.lineUserId,
            lineLinkedAt: now,
            lineLinkSource: 'DEMO_SEED',
            facilityId: FACILITY_ID,
            status: 'active',
            updatedAt: now,
        }, { merge: true });
        await db.collection('patients').doc(ATARO_FIXED_ID).update({
            dob: admin.firestore.FieldValue.delete(),
            gender: admin.firestore.FieldValue.delete(),
            kana: admin.firestore.FieldValue.delete(),
            roomNumber: admin.firestore.FieldValue.delete(),
        });
        return ATARO_FIXED_ID;
    }

    const snap = await db.collection('patients')
        .where('tenantId', '==', TENANT_ID)
        .where('lineUserId', '==', p.lineUserId)
        .limit(1).get();
    if (!snap.empty) return snap.docs[0].id;

    const id = uuidv4();
    await db.collection('patients').doc(id).set({
        id,
        tenantId: TENANT_ID,
        name: p.name,
        lineUserId: p.lineUserId,
        lineLinkedAt: now,
        lineLinkSource: 'DEMO_SEED',
        facilityId: FACILITY_ID,
        status: 'active',
        createdVia: 'DEMO_SEED',
        createdAt: now,
        updatedAt: now,
    });
    return id;
}

async function clearDemoEncounters(patientId) {
    const snap = await db.collection(`patients/${patientId}/encounters`)
        .where('demoSeed', '==', true).get();
    for (const doc of snap.docs) await doc.ref.delete();
    return snap.size;
}

async function insertEncounters(patientId, records) {
    for (const r of records) {
        const iso = new Date(r.date).toISOString();
        const deliveredAt = new Date(new Date(r.date).getTime() + 5 * 60 * 1000).toISOString();
        await db.collection(`patients/${patientId}/encounters`).add({
            demoSeed: true,
            tenantId: TENANT_ID,
            patientId,
            facilityId: FACILITY_ID,
            date: iso,
            status: 'COMPLETED',
            type: 'VISIT_RECORDING',
            patient_view: r.patient_view,
            soap: r.soap,
            report_100: r.soap?.report_100 || '',
            summary: '',
            changes_from_last_time: r.soap?.changes_from_last_time || '',
            pharmacy_focus: r.pharmacy_focus,
            alerts: r.alerts,
            meta: r.meta,
            transcript: r.transcript,
            patientMemo: r.patientMemo || '',
            lineDeliveryStatus: r.lineDeliveryStatus || 'SENT',
            lineDeliveredAt: deliveredAt,
            recordedByRole: 'patient',
            createdAt: iso,
            updatedAt: iso,
        });
    }
}

async function main() {
    const dir = process.argv[2];
    if (!dir) { console.error('Usage: node scripts/seedDemoData.js <jsonDir>'); process.exit(1); }

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const j = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        const patientId = await upsertPatient(j.patient);
        const cleared = await clearDemoEncounters(patientId);
        await insertEncounters(patientId, j.records);
        console.log(`${j.patient.name} (${patientId}): 旧demo ${cleared}件削除 → ${j.records.length}件投入`);
    }
    console.log('done');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
