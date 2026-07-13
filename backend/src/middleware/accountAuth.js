const { auth, db } = require('../config/firebase');

const SESSION_COOKIE_NAME = 'yorisoi_alagille_session';

function parseCookies(header) {
    return String(header || '').split(';').reduce((cookies, part) => {
        const separator = part.indexOf('=');
        if (separator < 0) return cookies;
        const name = part.slice(0, separator).trim();
        const value = part.slice(separator + 1).trim();
        if (name) cookies[name] = decodeURIComponent(value);
        return cookies;
    }, {});
}

async function verifyAccountSession(req, res, next) {
    if (process.env.AUTH_REQUIRED !== '1') return next();

    try {
        const sessionCookie = parseCookies(req.headers.cookie)[SESSION_COOKIE_NAME];
        if (!sessionCookie) {
            return res.status(401).json({ ok: false, error: 'ログインが必要です', code: 'AUTH_REQUIRED' });
        }

        const decoded = await auth.verifySessionCookie(sessionCookie, true);
        const accountDoc = await db.collection('users').doc(decoded.uid).get();
        req.user = {
            uid: decoded.uid,
            email: decoded.email || '',
            emailVerified: decoded.email_verified === true,
        };
        req.account = accountDoc.exists ? { id: accountDoc.id, ...accountDoc.data() } : null;
        return next();
    } catch (error) {
        console.warn('[AccountAuth] session rejected:', error.code || error.message);
        return res.status(401).json({ ok: false, error: 'ログインの有効期限が切れました', code: 'SESSION_EXPIRED' });
    }
}

module.exports = { SESSION_COOKIE_NAME, parseCookies, verifyAccountSession };
