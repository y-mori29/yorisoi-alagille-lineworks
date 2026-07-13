const { GoogleGenAI } = require('@google/genai');

const PRIMARY_MODEL = process.env.GEMINI_OCR_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = process.env.GEMINI_OCR_FALLBACK_MODEL || 'gemini-3.5-flash';

const responseJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        documentType: { type: 'string', enum: ['lab_report', 'not_lab_report', 'unknown'] },
        imageQuality: { type: 'string', enum: ['readable', 'partially_readable', 'needs_retake'] },
        testDate: { type: 'string', description: 'YYYY-MM-DD. Empty when unreadable.' },
        hospitalName: { type: 'string' },
        department: { type: 'string' },
        values: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    name: { type: 'string' },
                    value: { type: 'string' },
                    unit: { type: 'string' },
                    referenceRange: { type: 'string' },
                    flag: { type: 'string', enum: ['', 'H', 'L'] },
                },
                required: ['name', 'value', 'unit', 'referenceRange', 'flag'],
            },
        },
        warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['documentType', 'imageQuality', 'testDate', 'hospitalName', 'department', 'values', 'warnings'],
};

const prompt = `
日本の病院が発行した採血・血液検査結果用紙を、目視転記の補助として読み取ってください。

厳守事項:
- 画像に見える文字と数値だけを転記し、医学知識で補完・推測しない。
- 読めない文字や数値は空文字にする。似た文字へ推測変換しない。
- 検査日はYYYY-MM-DDへ変換する。読めない場合は空文字にする。
- 病院名と診療科は読めた場合だけ返す。
- 受付番号、患者ID、氏名、生年月日、住所、電話番号は返さない。
- flagは、用紙にHまたはLが印字されている場合だけ返す。数値と基準範囲から独自判定しない。
- referenceRangeは各検査行に印字された範囲をそのまま返す。無ければ空文字にする。
- 同じ検査項目を重複して作らない。
- 診断、解釈、助言、正常・異常の説明は出力しない。
- 用紙でない画像はdocumentTypeをnot_lab_reportにする。
- 傾き、ぼけ、反射、欠けで安全に転記できない場合はimageQualityをneeds_retakeにする。
`;

function getApiKey() {
    return process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
}

function parseImageDataUri(photoDataUrl) {
    const match = String(photoDataUrl || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i);
    if (!match) {
        const error = new Error('photoDataUrl must be a JPEG, PNG, or WebP data URI');
        error.status = 400;
        throw error;
    }
    return { mimeType: match[1].toLowerCase(), base64Data: match[2].replace(/\s/g, '') };
}

function sanitizeResult(raw) {
    const values = Array.isArray(raw?.values) ? raw.values.slice(0, 60).map((item) => ({
        name: String(item?.name || '').trim().slice(0, 80),
        value: String(item?.value || '').trim().slice(0, 40),
        unit: String(item?.unit || '').trim().slice(0, 40),
        referenceRange: String(item?.referenceRange || '').trim().slice(0, 80),
        flag: ['H', 'L'].includes(String(item?.flag || '').toUpperCase()) ? String(item.flag).toUpperCase() : '',
    })).filter((item) => item.name || item.value) : [];

    return {
        documentType: ['lab_report', 'not_lab_report', 'unknown'].includes(raw?.documentType) ? raw.documentType : 'unknown',
        imageQuality: ['readable', 'partially_readable', 'needs_retake'].includes(raw?.imageQuality) ? raw.imageQuality : 'partially_readable',
        testDate: /^\d{4}-\d{2}-\d{2}$/.test(String(raw?.testDate || '')) ? raw.testDate : '',
        hospitalName: String(raw?.hospitalName || '').trim().slice(0, 120),
        department: String(raw?.department || '').trim().slice(0, 80),
        values,
        warnings: Array.isArray(raw?.warnings) ? raw.warnings.map((item) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 8) : [],
    };
}

function needsFallback(result) {
    return result.documentType === 'unknown'
        || (result.documentType === 'lab_report' && !result.testDate && result.values.length === 0);
}

async function callModel(ai, model, image) {
    const response = await ai.models.generateContent({
        model,
        contents: [
            { text: prompt },
            { inlineData: { data: image.base64Data, mimeType: image.mimeType } },
        ],
        config: {
            temperature: 0,
            thinkingConfig: { thinkingLevel: 'minimal' },
            responseMimeType: 'application/json',
            responseJsonSchema,
        },
    });
    return sanitizeResult(JSON.parse(response.text));
}

async function extractLabReport(photoDataUrl, options = {}) {
    const apiKey = options.apiKey || getApiKey();
    if (!apiKey) {
        const error = new Error('Gemini API key is not configured');
        error.status = 503;
        throw error;
    }
    const image = parseImageDataUri(photoDataUrl);
    const ai = options.ai || new GoogleGenAI({ apiKey });
    const primaryModel = options.primaryModel || PRIMARY_MODEL;
    const fallbackModel = options.fallbackModel || FALLBACK_MODEL;

    let result = await callModel(ai, primaryModel, image);
    let model = primaryModel;
    if (fallbackModel && fallbackModel !== primaryModel && needsFallback(result)) {
        result = await callModel(ai, fallbackModel, image);
        model = fallbackModel;
    }
    return { ...result, model };
}

module.exports = {
    extractLabReport,
    parseImageDataUri,
    sanitizeResult,
    needsFallback,
    responseJsonSchema,
};
