const { admin, auth, db } = require('../config/firebase');
const { SESSION_COOKIE_NAME } = require('../middleware/accountAuth');

const SESSION_EXPIRES_MS = 5 * 24 * 60 * 60 * 1000;
const AVATAR_KEYS = new Set(['adult-man', 'adult-woman', 'child-boy', 'child-girl']);
const RELATIONSHIPS = new Set(['mother', 'father', 'self', 'grandparent', 'other']);

function sessionCookieOptions(req) {
    return [
        `${SESSION_COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        req.secure ? 'Secure' : '',
    ].filter(Boolean);
}

function cleanText(value, maxLength) {
    return String(value || '').trim().slice(0, maxLength);
}

function normalizeBootstrapInput(body = {}) {
    const recordTarget = body.recordTarget === 'self' ? 'self' : 'family';
    const displayName = cleanText(body.displayName, 80);
    const patientName = recordTarget === 'self' ? displayName : cleanText(body.patientName, 80);
    const relationship = recordTarget === 'self'
        ? 'self'
        : (RELATIONSHIPS.has(body.relationship) ? body.relationship : 'other');
    const avatarKey = AVATAR_KEYS.has(body.avatarKey)
        ? body.avatarKey
        : (recordTarget === 'self' ? 'adult-man' : 'child-boy');
    const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.birthDate || '')) ? body.birthDate : null;

    return { recordTarget, displayName, patientName, relationship, avatarKey, birthDate };
}

exports.createSession = async (req, res) => {
    try {
        const authorization = String(req.headers.authorization || '');
        if (!authorization.startsWith('Bearer ')) {
            return res.status(401).json({ ok: false, error: 'Firebase ID token required' });
        }
        const idToken = authorization.slice('Bearer '.length);
        await auth.verifyIdToken(idToken, true);
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_EXPIRES_MS });
        const cookie = sessionCookieOptions(req);
        cookie[0] += encodeURIComponent(sessionCookie);
        cookie.push(`Max-Age=${Math.floor(SESSION_EXPIRES_MS / 1000)}`);
        res.set('Set-Cookie', cookie.join('; '));
        return res.json({ ok: true });
    } catch (error) {
        console.warn('[Account] session creation failed:', error.code || error.message);
        return res.status(401).json({ ok: false, error: 'ログイン情報を確認できませんでした' });
    }
};

exports.deleteSession = async (req, res) => {
    const cookie = sessionCookieOptions(req);
    cookie.push('Max-Age=0');
    res.set('Set-Cookie', cookie.join('; '));
    return res.json({ ok: true });
};

exports.getMe = async (req, res) => res.json({
    ok: true,
    user: req.user,
    account: req.account,
    needsOnboarding: !req.account?.activeFamilyId,
});

exports.bootstrapAccount = async (req, res) => {
    try {
        if (req.account?.activeFamilyId) {
            return res.json({ ok: true, account: req.account, alreadyCreated: true });
        }

        const {
            displayName,
            patientName,
            relationship,
            avatarKey,
            birthDate,
        } = normalizeBootstrapInput(req.body);
        if (!displayName || !patientName) {
            return res.status(400).json({ ok: false, error: '呼び名を入力してください' });
        }

        const familyRef = db.collection('families').doc();
        const memberRef = familyRef.collection('members').doc(req.user.uid);
        const patientRef = familyRef.collection('patients').doc();
        const userRef = db.collection('users').doc(req.user.uid);
        const now = admin.firestore.FieldValue.serverTimestamp();

        await db.runTransaction(async (transaction) => {
            const existing = await transaction.get(userRef);
            if (existing.exists && existing.data().activeFamilyId) return;

            transaction.set(familyRef, {
                tenantId: req.tenantId,
                displayName: cleanText(req.body.familyName, 100) || `${patientName}さんの家族ノート`,
                primaryContactMemberId: req.user.uid,
                lineWorksScope: 'members-only',
                createdAt: now,
                updatedAt: now,
            });
            transaction.set(memberRef, {
                familyId: familyRef.id,
                accountUid: req.user.uid,
                email: req.user.email,
                displayName,
                relationship,
                role: 'owner',
                status: 'active',
                joinedAt: now,
            });
            transaction.set(patientRef, {
                familyId: familyRef.id,
                tenantId: req.tenantId,
                displayName: patientName,
                birthDate,
                sex: ['male', 'female', 'other', 'unknown'].includes(req.body.sex) ? req.body.sex : 'unknown',
                relationshipLabel: cleanText(req.body.relationshipLabel, 40) || (relationship === 'self' ? 'ご本人' : 'ご家族'),
                diseaseId: 'alagille',
                active: true,
                avatarKey,
                createdAt: now,
                updatedAt: now,
            });
            transaction.set(userRef, {
                email: req.user.email,
                displayName,
                activeFamilyId: familyRef.id,
                familyIds: [familyRef.id],
                createdAt: now,
                updatedAt: now,
            }, { merge: true });
        });

        const accountDoc = await userRef.get();
        return res.status(201).json({
            ok: true,
            account: { id: accountDoc.id, ...accountDoc.data() },
            familyId: familyRef.id,
            patientId: patientRef.id,
        });
    } catch (error) {
        console.error('[Account] bootstrap failed:', error);
        return res.status(500).json({ ok: false, error: '家族ノートを作成できませんでした' });
    }
};

module.exports.normalizeBootstrapInput = normalizeBootstrapInput;
