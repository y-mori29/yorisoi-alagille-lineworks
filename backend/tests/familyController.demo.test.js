const assert = require('node:assert/strict');

process.env.DEMO_MODE = '1';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.DEFAULT_TENANT_ID = 'alagille-family';

const controller = require('../src/controllers/familyController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
}

async function run(handler, req = {}) {
    const response = createResponse();
    await handler({
        tenantId: 'alagille-family',
        query: {},
        headers: {},
        body: {},
        ...req,
    }, response);
    return response;
}

async function main() {
    assert.equal(controller.ageLabelFromBirthDate('2020-04-10', new Date('2026-07-13T00:00:00Z')), '6歳3か月');
    assert.equal(controller.ageLabelFromBirthDate('', new Date('2026-07-13T00:00:00Z')), '');
    const current = await run(controller.getCurrentFamily);
    assert.equal(current.statusCode, 200);
    assert.equal(current.body.family.id, 'alagille-demo-family');
    assert.equal(current.body.memberCount, 2);

    const members = await run(controller.listFamilyMembers);
    assert.equal(members.body.members.length, 2);
    assert.equal(members.body.members[0].role, 'owner');
    assert.equal(members.body.members[0].avatarKey, 'adult-woman');

    const before = await run(controller.listFamilyPatients);
    assert.equal(before.body.patients.length, 2);

    const invalid = await run(controller.createFamilyPatient, { body: {} });
    assert.equal(invalid.statusCode, 400);

    const created = await run(controller.createFamilyPatient, {
        body: { displayName: 'ひなたくん', birthDate: '2025-11-10', avatarKey: 'child-boy' },
    });
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.patient.displayName, 'ひなたくん');
    assert.equal(created.body.patient.diseaseId, 'alagille');
    assert.equal(created.body.patient.avatarKey, 'child-boy');

    const after = await run(controller.listFamilyPatients);
    assert.equal(after.body.patients.length, 3);

    const invitation = await run(controller.createFamilyInvitation, {
        protocol: 'http',
        get(name) {
            if (name === 'host') return '127.0.0.1:8082';
            return null;
        },
        body: { role: 'viewer' },
    });
    assert.equal(invitation.statusCode, 201);
    assert.equal(invitation.body.invitation.role, 'viewer');
    assert.match(invitation.body.invitation.shareUrl, /\?invite=/);
    const invitationList = await run(controller.listFamilyInvitations);
    assert.deepEqual(invitationList.body.invitations, []);
    const malformedRevoke = await run(controller.revokeFamilyInvitation, { params: { token: 'invalid' } });
    assert.equal(malformedRevoke.statusCode, 400);

    console.log('familyController demo tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
