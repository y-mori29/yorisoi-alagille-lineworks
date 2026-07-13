const assert = require('node:assert/strict');

process.env.PROJECT_ID = 'yorisoi-dev-477515';
process.env.FIRESTORE_DATABASE_ID = 'alagille-local';
process.env.AUTH_REQUIRED = '1';
process.env.DEMO_MODE = '0';

const { parseCookies, verifyAccountSession } = require('../src/middleware/accountAuth');
const { getFamilyId } = require('../src/controllers/familyController');

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

async function main() {
    assert.deepEqual(parseCookies('a=1; yorisoi_alagille_session=token%201'), {
        a: '1',
        yorisoi_alagille_session: 'token 1',
    });

    const response = createResponse();
    let nextCalled = false;
    await verifyAccountSession({ headers: {} }, response, () => { nextCalled = true; });
    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 401);
    assert.equal(response.body.code, 'AUTH_REQUIRED');

    const accountRequest = {
        query: {},
        headers: {},
        account: { activeFamilyId: 'family-a', familyIds: ['family-a', 'family-b'] },
    };
    assert.equal(getFamilyId(accountRequest), 'family-a');
    assert.equal(getFamilyId({ ...accountRequest, query: { familyId: 'family-b' } }), 'family-b');
    assert.throws(
        () => getFamilyId({ ...accountRequest, query: { familyId: 'family-c' } }),
        (error) => error.status === 403,
    );
    assert.throws(
        () => getFamilyId({ query: {}, headers: {}, account: null }),
        (error) => error.status === 409,
    );

    console.log('account boundary tests passed');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
