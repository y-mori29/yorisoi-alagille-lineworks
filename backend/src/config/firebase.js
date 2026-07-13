const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.PROJECT_ID || 'yorisoi-medical',
    });
}

// 本番事故防止：接続先DBを必ず明示させる。未設定なら起動拒否。
// 光本番(default)に誤って繋がないよう、空文字や 'default' も拒否する。
const databaseId = process.env.FIRESTORE_DATABASE_ID;
if (!databaseId || databaseId.trim() === '' || databaseId === 'default' || databaseId === '(default)') {
    throw new Error(
        '[firebase.js] FIRESTORE_DATABASE_ID is required and must NOT be (default). ' +
        '光本番(default) には繋がない設計です。アラジール症候群版専用のデータベースIDを指定してください。'
    );
}

const db = getFirestore(admin.app(), databaseId);
db.settings({ ignoreUndefinedProperties: true });
const auth = admin.auth();

console.log(`[firebase.js] connected to Firestore database: ${databaseId} (project: ${process.env.PROJECT_ID || 'yorisoi-medical'})`);

module.exports = { admin, db, auth };
