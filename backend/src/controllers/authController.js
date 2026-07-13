// スタッフ認証（Firestore版・2026-06-11 jsonDb から移行）
// - staffs コレクション（pharmacy DB）: { tenantId, loginId, passwordHash, name, role }
// - ログインは tenant 単位（X-Tenant-Id 必須）。JWT に tenantId を含め、
//   将来はヘッダ自己申告ではなく JWT claim からテナントを確定する移行パス。
const { db } = require('../config/firebase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 秘密鍵は必須。デフォルト値での運用は禁止（推測可能なトークン偽造を防ぐ）。
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[authController] JWT_SECRET is required. .env / deploy_env.yaml に設定してください。');
}

exports.login = async (req, res) => {
    try {
        const { id, password } = req.body;
        if (!id || !password) {
            return res.status(400).json({ error: 'ID and password are required' });
        }
        if (!req.tenantId) {
            return res.status(400).json({ error: 'X-Tenant-Id header is required' });
        }

        const snap = await db.collection('staffs')
            .where('tenantId', '==', req.tenantId)
            .where('loginId', '==', String(id))
            .limit(1)
            .get();

        if (snap.empty) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const staffDoc = snap.docs[0];
        const staff = staffDoc.data();

        const isMatch = await bcrypt.compare(password, staff.passwordHash || '');
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                uid: staffDoc.id,
                tenantId: staff.tenantId,
                name: staff.name,
                role: staff.role || 'staff',
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                uid: staffDoc.id,
                displayName: staff.name,
                role: staff.role || 'staff',
                tenantId: staff.tenantId,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};
