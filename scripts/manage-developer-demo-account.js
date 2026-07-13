#!/usr/bin/env node

const path = require('node:path');

process.env.PROJECT_ID ||= 'yorisoi-dev-477515';
process.env.FIRESTORE_DATABASE_ID ||= 'yorisoi-alagille';

const { admin, auth, db } = require(path.join(__dirname, '..', 'backend', 'src', 'config', 'firebase'));

const APPLY = process.argv.includes('--apply');
const EMAIL = String(process.env.YORISOI_DEMO_EMAIL || '').trim().toLowerCase();
const PASSWORD = String(process.env.YORISOI_DEMO_PASSWORD || '');
const TENANT_ID = 'alagille-family';
const FAMILY_ID = 'alagille-developer-demo-family';
const PATIENT_ID = 'alagille-developer-demo-patient';

function dateOnly(offsetDays = 0) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function dateTime(offsetDays = 0, hour = 10, minute = 30) {
    const date = new Date();
    date.setUTCHours(hour - 9, minute, 0, 0);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString();
}

async function ensureUser() {
    try {
        const user = await auth.getUserByEmail(EMAIL);
        await auth.updateUser(user.uid, { password: PASSWORD, displayName: '開発デモ管理者', disabled: false });
        await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), yorisoiDemo: true });
        return user.uid;
    } catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        const user = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: '開発デモ管理者', emailVerified: true });
        await auth.setCustomUserClaims(user.uid, { yorisoiDemo: true });
        return user.uid;
    }
}

async function resetFamily(uid) {
    const familyRef = db.collection('families').doc(FAMILY_ID);
    await db.recursiveDelete(familyRef);

    const invitationSnapshot = await db.collection('familyInvitations').where('familyId', '==', FAMILY_ID).get();
    if (!invitationSnapshot.empty) {
        const invitationBatch = db.batch();
        invitationSnapshot.docs.forEach((doc) => invitationBatch.delete(doc.ref));
        await invitationBatch.commit();
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const patientRef = familyRef.collection('patients').doc(PATIENT_ID);
    const batch = db.batch();

    batch.set(familyRef, {
        tenantId: TENANT_ID,
        displayName: '開発デモの家族ノート',
        primaryContactMemberId: uid,
        lineWorksScope: 'members-only',
        isDemo: true,
        createdAt: now,
        updatedAt: now,
    });
    batch.set(familyRef.collection('members').doc(uid), {
        familyId: FAMILY_ID,
        accountUid: uid,
        email: EMAIL,
        displayName: 'デモ利用者',
        relationship: 'mother',
        role: 'owner',
        status: 'active',
        avatarKey: 'adult-woman',
        isDemo: true,
        joinedAt: now,
    });
    batch.set(patientRef, {
        familyId: FAMILY_ID,
        tenantId: TENANT_ID,
        displayName: 'よりそい はるさん',
        birthDate: '2020-04-10',
        sex: 'male',
        relationshipLabel: 'ご家族',
        diseaseId: 'alagille',
        active: true,
        avatarKey: 'child-boy',
        isDemo: true,
        createdAt: now,
        updatedAt: now,
    });
    batch.set(db.collection('users').doc(uid), {
        email: EMAIL,
        displayName: 'デモ利用者',
        activeFamilyId: FAMILY_ID,
        familyIds: [FAMILY_ID],
        isDemo: true,
        createdAt: now,
        updatedAt: now,
    }, { merge: true });

    batch.set(patientRef.collection('labs').doc('demo-lab-current'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        testDate: dateOnly(-7), category: 'blood', ocrStatus: 'confirmed', hospitalName: 'よりそいこども病院（架空）', department: '小児肝臓外来',
        values: [
            { name: '総ビリルビン', value: '1.8', unit: 'mg/dL', referenceRange: '0.3～0.9', flag: 'H' },
            { name: '直接ビリルビン', value: '0.9', unit: 'mg/dL', referenceRange: '0.05～0.30', flag: 'H' },
            { name: 'AST (GOT)', value: '42', unit: 'U/L', referenceRange: '24～43', flag: '' },
            { name: 'ALT (GPT)', value: '58', unit: 'U/L', referenceRange: '9～30', flag: 'H' },
            { name: 'γ-GTP', value: '135', unit: 'U/L', referenceRange: '6～20', flag: 'H' },
        ],
        isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('labs').doc('demo-lab-previous'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        testDate: dateOnly(-35), category: 'blood', ocrStatus: 'confirmed', hospitalName: 'よりそいこども病院（架空）', department: '小児肝臓外来',
        values: [
            { name: '総ビリルビン', value: '2.1', unit: 'mg/dL', referenceRange: '0.3～0.9', flag: 'H' },
            { name: 'ALT (GPT)', value: '64', unit: 'U/L', referenceRange: '9～30', flag: 'H' },
            { name: 'γ-GTP', value: '148', unit: 'U/L', referenceRange: '6～20', flag: 'H' },
        ],
        isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('medications').doc('demo-medication-active'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        name: 'ウルソデオキシコール酸（架空データ）', dosageText: '1回1錠', timingText: '朝・夕食後', status: 'active',
        startedAt: dateOnly(-90), stoppedAt: '', memo: '診察で確認するためのデモ記録です。', source: 'manual', isDemo: true,
        createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('growthRecords').doc('demo-growth-current'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        measuredAt: dateOnly(-5), heightCm: 107.2, weightKg: 17.6, headCircumferenceCm: null,
        memo: '自宅で測定した架空データ', source: 'manual', isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('growthRecords').doc('demo-growth-previous'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        measuredAt: dateOnly(-65), heightCm: 105.8, weightKg: 17.1, headCircumferenceCm: null,
        memo: '', source: 'manual', isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('dailyLogs').doc('demo-daily-itch'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        occurredAt: dateTime(-2, 21, 0), category: 'itch', title: '夜のかゆみ', memo: '寝る前に少しかゆがっていました。', media: [],
        isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('appointments').doc('demo-appointment-next'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        scheduledAt: dateTime(14, 10, 30), clinicName: 'よりそいこども病院（架空）', department: '小児肝臓外来', location: '本館2階',
        memo: '検査結果の用紙を持参', status: 'scheduled', isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('questions').doc('demo-question-next'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        text: '次回の採血前に気をつけることはありますか？', category: 'tests', status: 'open', answerMemo: '', appointmentId: '', askedAt: '',
        isDemo: true, createdAt: now, updatedAt: now,
    });
    batch.set(patientRef.collection('visitNotes').doc('demo-visit-note'), {
        tenantId: TENANT_ID, familyId: FAMILY_ID, patientId: PATIENT_ID, createdByMemberId: uid,
        visitDate: dateOnly(-7), clinicName: 'よりそいこども病院（架空）', department: '小児肝臓外来', familyMemo: '夜のかゆみについて相談しました。',
        transcript: '検査結果を確認し、お薬は今の量を続けると説明がありました。', summary: '検査結果とお薬、夜のかゆみについて確認しました。',
        doctorSaid: ['お薬は今の量を続けます。'], nextQuestions: ['次回の採血前に気をつけることはありますか？'], medicationChanges: [],
        labAndTestTopics: ['検査結果を確認しました。'], growthNutritionTopics: [], dailyLifeTopics: ['夜のかゆみについて相談しました。'], departments: ['小児肝臓外来'],
        status: 'COMPLETED', inputMode: 'text', isDemo: true, createdAt: now, updatedAt: now,
    });

    await batch.commit();
}

async function main() {
    if (!EMAIL || PASSWORD.length < 12) {
        throw new Error('YORISOI_DEMO_EMAIL and YORISOI_DEMO_PASSWORD (12 characters or more) are required.');
    }
    if (!APPLY) {
        console.log(JSON.stringify({ mode: 'dry-run', email: EMAIL, familyId: FAMILY_ID, patientId: PATIENT_ID }));
        console.log('Run again with --apply to create or reset only this developer demo family.');
        return;
    }

    const uid = await ensureUser();
    await resetFamily(uid);
    console.log(JSON.stringify({ ok: true, email: EMAIL, uid, familyId: FAMILY_ID, patientId: PATIENT_ID, reset: true }));
}

main().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
