const { admin, db } = require('../config/firebase');
const { randomUUID } = require('node:crypto');

const DEMO_FAMILY_ID = 'alagille-demo-family';

const demoFamily = {
    id: DEMO_FAMILY_ID,
    displayName: 'はるくんの家族ノート',
    primaryContactMemberId: 'demo-mother',
    lineWorksScope: 'members-only',
};

const demoMembers = [
    {
        id: 'demo-mother',
        displayName: 'お母さん',
        relationship: 'mother',
        role: 'owner',
        status: 'active',
        avatarKey: 'adult-woman',
    },
    {
        id: 'demo-father',
        displayName: 'お父さん',
        relationship: 'father',
        role: 'editor',
        status: 'active',
        avatarKey: 'adult-man',
    },
];

const demoPatients = [
    {
        id: 'demo-haruto',
        displayName: 'はるくん',
        birthDate: '2020-04-10',
        ageLabel: '6歳3か月',
        relationshipLabel: 'お子さん',
        diseaseId: 'alagille',
        active: true,
        avatarKey: 'child-boy',
    },
    {
        id: 'demo-mio',
        displayName: 'みおちゃん',
        birthDate: '2023-05-18',
        ageLabel: '3歳1か月',
        relationshipLabel: 'お子さん',
        diseaseId: 'alagille',
        active: true,
        avatarKey: 'child-girl',
    },
];

function isDemoMode() {
    return process.env.DEMO_MODE === '1';
}

function getFamilyId(req) {
    const requested = req.query.familyId || req.headers['x-family-id'] || '';
    if (req.account) {
        const familyIds = Array.isArray(req.account.familyIds) ? req.account.familyIds : [];
        if (requested && requested !== req.account.activeFamilyId && !familyIds.includes(requested)) {
            const error = new Error('Family access denied');
            error.status = 403;
            throw error;
        }
        return requested || req.account.activeFamilyId;
    }
    if (process.env.AUTH_REQUIRED === '1') {
        const error = new Error('Account onboarding required');
        error.status = 409;
        throw error;
    }
    return requested || process.env.DEMO_FAMILY_ID || DEMO_FAMILY_ID;
}

function familyRef(familyId) {
    return db.collection('families').doc(familyId);
}

function toRecord(doc) {
    return { id: doc.id, ...doc.data() };
}

function ageLabelFromBirthDate(birthDate, today = new Date()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(birthDate || ''))) return '';
    const [year, month, day] = String(birthDate).split('-').map(Number);
    const birth = new Date(Date.UTC(year, month - 1, day));
    const current = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    if (!Number.isFinite(birth.getTime()) || birth > current) return '';
    let years = current.getUTCFullYear() - birth.getUTCFullYear();
    let months = current.getUTCMonth() - birth.getUTCMonth();
    if (current.getUTCDate() < birth.getUTCDate()) months -= 1;
    if (months < 0) { years -= 1; months += 12; }
    if (years < 0) return '';
    return years === 0 ? `${months}か月` : `${years}歳${months}か月`;
}

function patientRecord(doc) {
    const record = toRecord(doc);
    return { ...record, ageLabel: ageLabelFromBirthDate(record.birthDate) };
}

async function assertOwnedFamily(familyId, tenantId, accountUid, allowedRoles = null) {
    const doc = await familyRef(familyId).get();
    if (!doc.exists || doc.data().tenantId !== tenantId) {
        const error = new Error('Family not found');
        error.status = 404;
        throw error;
    }
    if (process.env.AUTH_REQUIRED === '1') {
        if (!accountUid) {
            const error = new Error('Account authentication required');
            error.status = 401;
            throw error;
        }
        const member = await familyRef(familyId).collection('members').doc(accountUid).get();
        if (!member.exists || member.data().status !== 'active') {
            const error = new Error('Family access denied');
            error.status = 403;
            throw error;
        }
        if (allowedRoles && !allowedRoles.includes(member.data().role)) {
            const error = new Error('この操作を行う権限がありません');
            error.status = 403;
            throw error;
        }
        return { family: doc, member };
    }
    return { family: doc, member: null };
}

function sendError(res, error) {
    const status = error.status || 500;
    return res.status(status).json({ ok: false, error: error.message });
}

exports.getCurrentFamily = async (req, res) => {
    try {
        if (isDemoMode()) {
            return res.json({
                ok: true,
                family: { ...demoFamily, tenantId: req.tenantId },
                memberCount: demoMembers.length,
                patientCount: demoPatients.length,
            });
        }

        const familyId = getFamilyId(req);
        const access = await assertOwnedFamily(familyId, req.tenantId, req.user?.uid);
        return res.json({ ok: true, family: toRecord(access.family), currentMember: toRecord(access.member) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.listFamilyMembers = async (req, res) => {
    try {
        if (isDemoMode()) {
            return res.json({ ok: true, familyId: DEMO_FAMILY_ID, members: demoMembers });
        }

        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid);
        const snapshot = await familyRef(familyId).collection('members').get();
        return res.json({ ok: true, familyId, members: snapshot.docs.map(toRecord) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.listFamilyPatients = async (req, res) => {
    try {
        if (isDemoMode()) {
            return res.json({ ok: true, familyId: DEMO_FAMILY_ID, patients: demoPatients });
        }

        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid);
        const snapshot = await familyRef(familyId).collection('patients')
            .where('active', '==', true)
            .get();
        return res.json({ ok: true, familyId, patients: snapshot.docs.map(patientRecord) });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createFamilyPatient = async (req, res) => {
    try {
        const displayName = String(req.body.displayName || '').trim();
        if (!displayName) {
            return res.status(400).json({ ok: false, error: 'displayName required' });
        }

        const allowedAvatarKeys = new Set(['adult-man', 'adult-woman', 'child-boy', 'child-girl']);
        const avatarKey = allowedAvatarKeys.has(req.body.avatarKey) ? req.body.avatarKey : 'child-boy';
        const patient = {
            displayName,
            birthDate: req.body.birthDate || null,
            sex: req.body.sex || 'unknown',
            relationshipLabel: req.body.relationshipLabel || 'お子さん',
            diseaseId: 'alagille',
            active: true,
            avatarKey,
        };

        if (isDemoMode()) {
            const created = { id: `demo-patient-${Date.now()}`, ...patient, ageLabel: ageLabelFromBirthDate(patient.birthDate) };
            demoPatients.push(created);
            return res.status(201).json({ ok: true, familyId: DEMO_FAMILY_ID, patient: created });
        }

        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid, ['owner']);
        const now = admin.firestore.FieldValue.serverTimestamp();
        const docRef = familyRef(familyId).collection('patients').doc();
        await docRef.set({
            ...patient,
            familyId,
            tenantId: req.tenantId,
            createdAt: now,
            updatedAt: now,
        });
        return res.status(201).json({ ok: true, familyId, patient: { id: docRef.id, ...patient, ageLabel: ageLabelFromBirthDate(patient.birthDate) } });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.createFamilyInvitation = async (req, res) => {
    try {
        const role = req.body.role === 'editor' ? 'editor' : 'viewer';
        const token = randomUUID().replaceAll('-', '');
        const createdAt = new Date();
        const expiresAt = new Date(createdAt.getTime() + (7 * 24 * 60 * 60 * 1000));
        const baseUrl = req.get?.('origin')
            || `${req.protocol || 'http'}://${req.get?.('host') || '127.0.0.1:8082'}`;
        const invitation = {
            token,
            role,
            status: 'active',
            createdAt: createdAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            shareUrl: `${baseUrl}/login.html?invite=${encodeURIComponent(token)}`,
        };

        if (isDemoMode()) {
            return res.status(201).json({ ok: true, familyId: DEMO_FAMILY_ID, invitation });
        }

        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid, ['owner']);
        const invitationRecord = {
            ...invitation,
            familyId,
            tenantId: req.tenantId,
            createdByMemberId: req.user?.uid || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        };
        await db.collection('familyInvitations').doc(token).set(invitationRecord);
        return res.status(201).json({ ok: true, familyId, invitation });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.listFamilyInvitations = async (req, res) => {
    try {
        if (isDemoMode()) return res.json({ ok: true, familyId: DEMO_FAMILY_ID, invitations: [] });
        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid, ['owner']);
        const snapshot = await db.collection('familyInvitations').where('familyId', '==', familyId).limit(50).get();
        const now = new Date();
        const invitations = snapshot.docs.map((doc) => {
            const data = doc.data();
            const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
            const createdAt = data.createdAt?.toDate?.() || new Date(data.createdAt);
            const status = data.status === 'active' && Number.isFinite(expiresAt.getTime()) && expiresAt <= now ? 'expired' : data.status;
            return {
                token: doc.id,
                role: data.role === 'editor' ? 'editor' : 'viewer',
                status,
                shareUrl: data.shareUrl || '',
                createdAt: Number.isFinite(createdAt.getTime()) ? createdAt.toISOString() : '',
                expiresAt: Number.isFinite(expiresAt.getTime()) ? expiresAt.toISOString() : '',
            };
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return res.json({ ok: true, familyId, invitations });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.revokeFamilyInvitation = async (req, res) => {
    try {
        const token = String(req.params.token || '');
        if (!/^[a-f0-9]{32}$/.test(token)) return res.status(400).json({ ok: false, error: '招待リンクが正しくありません' });
        const familyId = getFamilyId(req);
        await assertOwnedFamily(familyId, req.tenantId, req.user?.uid, ['owner']);
        const ref = db.collection('familyInvitations').doc(token);
        const snapshot = await ref.get();
        if (!snapshot.exists || snapshot.data().familyId !== familyId || snapshot.data().tenantId !== req.tenantId) {
            return res.status(404).json({ ok: false, error: '招待が見つかりません' });
        }
        if (snapshot.data().status !== 'active') return res.status(409).json({ ok: false, error: 'この招待はすでに使用済みまたは無効です' });
        await ref.set({ status: 'revoked', revokedBy: req.user.uid, revokedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        return res.json({ ok: true, token, status: 'revoked' });
    } catch (error) {
        return sendError(res, error);
    }
};

exports.acceptFamilyInvitation = async (req, res) => {
    try {
        const token = String(req.params.token || '');
        if (!/^[a-f0-9]{32}$/.test(token)) {
            return res.status(400).json({ ok: false, error: '招待リンクが正しくありません' });
        }

        const invitationRef = db.collection('familyInvitations').doc(token);
        const userRef = db.collection('users').doc(req.user.uid);
        let joinedFamilyId = '';

        await db.runTransaction(async (transaction) => {
            const invitation = await transaction.get(invitationRef);
            if (!invitation.exists) {
                const error = new Error('招待が見つかりません');
                error.status = 404;
                throw error;
            }
            const data = invitation.data();
            const expiresAt = data.expiresAt?.toDate?.() || new Date(data.expiresAt);
            if (data.status !== 'active' || !Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
                const error = new Error('この招待は期限切れです');
                error.status = 410;
                throw error;
            }

            const family = await transaction.get(familyRef(data.familyId));
            if (!family.exists || family.data().tenantId !== req.tenantId) {
                const error = new Error('家族ノートが見つかりません');
                error.status = 404;
                throw error;
            }

            const existingUser = await transaction.get(userRef);
            const account = existingUser.exists ? existingUser.data() : {};
            const displayName = String(account.displayName || req.body.displayName || req.user.email || '家族').trim().slice(0, 80);
            const relationship = ['mother', 'father', 'self', 'grandparent', 'other'].includes(req.body.relationship)
                ? req.body.relationship
                : 'other';
            const memberRef = familyRef(data.familyId).collection('members').doc(req.user.uid);
            const now = admin.firestore.FieldValue.serverTimestamp();

            transaction.set(memberRef, {
                familyId: data.familyId,
                accountUid: req.user.uid,
                email: req.user.email,
                displayName,
                relationship,
                role: data.role === 'editor' ? 'editor' : 'viewer',
                status: 'active',
                joinedAt: now,
                invitedBy: data.createdByMemberId || null,
            }, { merge: true });
            transaction.set(userRef, {
                email: req.user.email,
                displayName,
                activeFamilyId: data.familyId,
                familyIds: admin.firestore.FieldValue.arrayUnion(data.familyId),
                updatedAt: now,
                ...(!existingUser.exists ? { createdAt: now } : {}),
            }, { merge: true });
            transaction.set(invitationRef, {
                status: 'accepted',
                acceptedBy: req.user.uid,
                acceptedAt: now,
            }, { merge: true });
            joinedFamilyId = data.familyId;
        });

        return res.json({ ok: true, familyId: joinedFamilyId });
    } catch (error) {
        return sendError(res, error);
    }
};

module.exports.getFamilyId = getFamilyId;
module.exports.assertOwnedFamily = assertOwnedFamily;
module.exports.ageLabelFromBirthDate = ageLabelFromBirthDate;
