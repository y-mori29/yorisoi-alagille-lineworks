const jwt = require('jsonwebtoken');

// 秘密鍵は必須。デフォルト値での運用は禁止（authController と同一ポリシー）。
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('[auth middleware] JWT_SECRET is required. .env / deploy_env.yaml に設定してください。');
}

/**
 * スタッフ用JWT検証ミドルウェア。
 * Expected format: "Authorization: Bearer <token>"
 * - JWT payload: { uid, tenantId, name, role }
 * - JWTのtenantIdとX-Tenant-Idの不一致は403（他テナントへのなりすまし防止）
 */
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    // MOCKバイパスはローカル開発時のみ（ALLOW_MOCK_AUTH=true を明示した場合）
    if (token.startsWith('MOCK_TOKEN_')) {
        if (process.env.ALLOW_MOCK_AUTH === 'true') {
            const dummyUid = token.replace('MOCK_TOKEN_', '');
            req.user = { uid: dummyUid, name: 'Mock User', role: 'admin', tenantId: req.tenantId };
            return next();
        }
        return res.status(401).json({ error: 'Unauthorized: Mock auth is disabled' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.tenantId && req.tenantId && decoded.tenantId !== req.tenantId) {
            return res.status(403).json({ error: 'Forbidden: tenant mismatch' });
        }
        req.user = decoded; // { uid, tenantId, name, role, iat, exp }
        next();
    } catch (error) {
        console.error('VERIFY TOKEN ERROR:', error.message);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

module.exports = { verifyToken };
