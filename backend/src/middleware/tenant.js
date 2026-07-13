// テナント識別ミドルウェア。
// 一般患者向けLINEでは単一運用なので、X-Tenant-Id が無い場合は DEFAULT_TENANT_ID を注入する。
//
// 設計意図：
// - tenant = この患者向けLINEアプリの論理境界。facility は必須ではない。
// - 全ての書き込み doc に tenantId を必ず付与し、全ての読み取りクエリに where('tenantId','==', req.tenantId) を強制する。
// - 患者LIFFではヘッダを持たせづらいため、未指定ならサーバ側の DEFAULT_TENANT_ID に寄せる。
//
// 注意：このミドルウェアは「テナントを名乗らせる」だけ。実際に他テナントになりすませるリスクは
// 将来の認証実装（idToken claim など）で強化する。今はサーバ側で「tenantIdの範囲しか触れない」
// ことを構造的に保証することが目的。

// テナントIDフォーマット検証（小文字英数とハイフンのみ・3〜64文字）
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

// 一部のエンドポイントはテナント不要（health等）。
// 注意: このミドルウェアは app.use('/api', requireTenant) でマウントされるため、
// req.path はマウント以下の相対パス（例: /auth/login）。/api プレフィクスを書かない。
const TENANT_EXEMPT_PATHS = [
    /^\/$/,                          // health root
    /^\/health$/,                    // health check
    /^\/patients\/liff-config$/,     // LIFF起動設定（デフォルトテナントの配布元なのでテナント不要）
];

function isExempt(path) {
    return TENANT_EXEMPT_PATHS.some((re) => re.test(path));
}

function requireTenant(req, res, next) {
    if (isExempt(req.path)) {
        return next();
    }

    const tenantId = req.headers['x-tenant-id'] || process.env.DEFAULT_TENANT_ID || 'general-patient';

    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
        return res.status(400).json({
            error: 'tenant id is required',
            hint: 'Set DEFAULT_TENANT_ID or send X-Tenant-Id.',
        });
    }

    const trimmed = tenantId.trim();
    if (!TENANT_ID_PATTERN.test(trimmed)) {
        return res.status(400).json({
            error: 'X-Tenant-Id must match /^[a-z0-9][a-z0-9-]{2,63}$/',
            received: trimmed,
        });
    }

    req.tenantId = trimmed;
    next();
}

module.exports = { requireTenant };
