// アラジール版で使用しない旧APIを、認証状態にかかわらずサーバー入口で閉じる。
// server.js から app.use('/api', ...) でマウントされるため req.path は /api 以下のパス。

const ALAGILLE_ALLOWED_PATHS = [
    /^\/account(?:\/|$)/,
    /^\/config\/?$/,
    /^\/test\/?$/,
    /^\/family(?:\/|$)/,
    /^\/labs(?:\/|$)/,
    /^\/medications(?:\/|$)/,
    /^\/growth-records(?:\/|$)/,
    /^\/visit-notes(?:\/|$)/,
    /^\/daily-logs(?:\/|$)/,
    /^\/appointments(?:\/|$)/,
    /^\/questions(?:\/|$)/,
    /^\/recent-changes(?:\/|$)/,
    /^\/photos(?:\/|$)/,
    /^\/doctor-view(?:\/|$)/,
];

function isAllowedAlagilleRequest(req) {
    if (req.method === 'GET' && /^\/patients\/liff-config\/?$/.test(req.path)) {
        return true;
    }

    return ALAGILLE_ALLOWED_PATHS.some((pattern) => pattern.test(req.path));
}

function requireAlagilleApiAllowlist(req, res, next) {
    const allowlistEnabled = process.env.ALAGILLE_API_MODE === '1' || process.env.DEMO_MODE === '1';
    if (!allowlistEnabled || isAllowedAlagilleRequest(req)) {
        return next();
    }

    return res.status(403).json({
        ok: false,
        error: 'This API is not available in the Alagille application.',
    });
}

module.exports = { isAllowedAlagilleRequest, requireAlagilleApiAllowlist };
