/**
 * Gemini 等から返るテキストから、先頭の完全な JSON オブジェクトを括弧対応で抽出する。
 * 単純な firstIndex/lastIndex はネストや文字列内の } で失敗するため使用しない。
 */
function extractFirstJsonObject(str) {
    if (!str || typeof str !== 'string') return null;
    const start = str.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < str.length; i++) {
        const c = str[i];
        if (inString) {
            if (escape) {
                escape = false;
                continue;
            }
            if (c === '\\') {
                escape = true;
                continue;
            }
            if (c === '"') inString = false;
            continue;
        }
        if (c === '"') {
            inString = true;
            continue;
        }
        if (c === '{') depth++;
        if (c === '}') {
            depth--;
            if (depth === 0) return str.substring(start, i + 1);
        }
    }
    return null;
}

/**
 * JSON パースを試み、失敗時は null
 */
function tryParseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

const MAX_TRANSCRIPT_CHARS = 28000;
const MAX_KNOWLEDGE_CHARS = 14000;

function truncateForPrompt(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '\n\n[…以降省略（長文のため切り詰め）]';
}

/**
 * 返却テキストから SOAP 用オブジェクトを取り出す（多段フォールバック）
 */
function parseSoapFromModelText(rawText) {
    if (!rawText || typeof rawText !== 'string') return { ok: false, data: null, error: 'empty' };

    const trimmed = rawText.trim();
    let parsed = tryParseJson(trimmed);
    if (parsed && parsed.soap) return { ok: true, data: parsed, error: null };

    const extracted = extractFirstJsonObject(trimmed);
    if (extracted) {
        parsed = tryParseJson(extracted);
        if (parsed && parsed.soap) return { ok: true, data: parsed, error: null };
        if (parsed) return { ok: true, data: parsed, error: null };
    }

    return { ok: false, data: null, error: 'parse_failed', fragment: extracted || trimmed.slice(0, 2000) };
}

module.exports = {
    extractFirstJsonObject,
    tryParseJson,
    parseSoapFromModelText,
    truncateForPrompt,
    MAX_TRANSCRIPT_CHARS,
    MAX_KNOWLEDGE_CHARS,
};
