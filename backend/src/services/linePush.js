// 患者本人のLINEへの診察メモ通知。
// 仕様（.plans/designs/2026-06-11-yakkyoku-yorisoi-patient-owned-spec.md §6）:
//   - LINE本文は「通知のみ」。薬剤名・診断名などの要配慮情報を本文に出さない
//   - 詳細はリッチメニューの1入口から開くLIFF内で見せる
const line = require('@line/bot-sdk');

function isPushEnabled() {
    return process.env.LINE_PUSH_ENABLED === 'true' && !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

let _client = null;
function getClient() {
    if (!_client) {
        _client = new line.messagingApi.MessagingApiClient({
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        });
    }
    return _client;
}

// 「見返す」タブ直行リンク（patient LIFF は ?view=records で見返すタブを開く）
function recordsLink() {
    const liffId = process.env.LIFF_ID;
    return liffId ? `https://liff.line.me/${liffId}?view=records` : null;
}

/**
 * 診察メモ完成通知。patient_view があればタイトル＋要約を本文に載せる
 * （2026-06-12 森さん判断: 詳細を見なくても分かるレベルまで載せてよい）。
 */
function buildNoticeText(patientView) {
    const link = recordsLink();
    const lines = ['診察メモができました 📝'];

    if (patientView?.title) {
        lines.push('', `「${patientView.title}」`);
    }
    if (patientView?.summary) {
        lines.push(patientView.summary);
    }
    if (!patientView?.title && !patientView?.summary) {
        lines.push('あとで見返せるように、今回のお話を整理しました。');
    }

    lines.push('');
    if (link) {
        lines.push('くわしくは、こちらからいつでも見返せます。', link);
    } else {
        lines.push('LINE下部のメニューから「よりそい」を開くと、過去の診察メモも見返せます。');
    }
    return lines.join('\n');
}

async function sendEncounterNotice(lineUserId, patientView = null) {
    const client = getClient();
    await client.pushMessage({
        to: lineUserId,
        messages: [{ type: 'text', text: buildNoticeText(patientView) }],
    });
}

module.exports = { isPushEnabled, sendEncounterNotice };
