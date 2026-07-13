const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requireSameOriginMutation(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const fetchSite = String(req.headers['sec-fetch-site'] || '');
    if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) {
        return res.status(403).json({ ok: false, error: 'Cross-site request rejected' });
    }

    const origin = String(req.headers.origin || '');
    if (origin) {
        const expectedOrigin = `${req.protocol}://${req.get('host')}`;
        if (origin !== expectedOrigin) {
            return res.status(403).json({ ok: false, error: 'Origin mismatch' });
        }
    }

    return next();
}

module.exports = { requireSameOriginMutation };
