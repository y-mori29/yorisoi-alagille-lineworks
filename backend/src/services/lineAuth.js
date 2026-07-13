// LINE idToken のサーバー検証。
// LIFFクライアントが liff.getIDToken() で得た idToken を LINE の verify API に投げ、
// LINE userId (sub) をサーバー側で確定する。URLパラメータの自己申告 patientId を
// 信用しないための要（red team review Critical 1 への対応）。
const fetch = require('node-fetch');

async function verifyLineIdToken(idToken) {
    const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
    if (!channelId) {
        throw new Error('LINE_LOGIN_CHANNEL_ID is not configured');
    }

    const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: idToken, client_id: channelId }).toString(),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        // 期限切れ・改ざん・チャネル不一致など。詳細はログのみ（PHIなし）
        throw new Error(`LINE idToken verify failed: ${body.error_description || body.error || res.status}`);
    }

    // body: { iss, sub, aud, exp, iat, name?, picture?, ... }
    if (!body.sub) {
        throw new Error('LINE idToken verify returned no sub');
    }
    return { lineUserId: body.sub, displayName: body.name || null };
}

module.exports = { verifyLineIdToken };
