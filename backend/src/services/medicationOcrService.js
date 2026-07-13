const { GoogleGenAI } = require('@google/genai');
const { parseImageDataUri } = require('./labOcrService');

const PRIMARY_MODEL = process.env.MEDICATION_OCR_MODEL || process.env.GEMINI_OCR_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = process.env.MEDICATION_OCR_FALLBACK_MODEL || process.env.GEMINI_OCR_FALLBACK_MODEL || 'gemini-3.5-flash';

const responseJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        documentType: { type: 'string', enum: ['medication_document', 'not_medication_document', 'unknown'] },
        imageQuality: { type: 'string', enum: ['readable', 'partially_readable', 'needs_retake'] },
        name: { type: 'string' },
        dosageText: { type: 'string' },
        timingText: { type: 'string' },
        rawText: { type: 'string' },
        warnings: { type: 'array', items: { type: 'string' } },
    },
    required: ['documentType', 'imageQuality', 'name', 'dosageText', 'timingText', 'rawText', 'warnings'],
};

const prompt = `
薬袋、お薬手帳、処方内容の控え、薬の外箱のいずれかを、家族が目視転記する補助として読み取ってください。

厳守事項:
- 画像に見える文字だけを転記し、薬剤知識や一般的な用法から補完しない。
- nameは画像に印字された薬名と規格を、読める範囲でそのまま返す。
- dosageTextは1回量として明記された内容だけを返す。
- timingTextは回数、朝昼夕、食前食後など画像に明記された内容だけを返す。
- 読めない欄は空文字にし、似た薬名を推測しない。
- 患者氏名、患者ID、住所、電話番号、医療機関の受付番号は返さない。
- 診断、効能、注意、副作用、服用提案は出力しない。
- 対象書類や薬パッケージでない画像はdocumentTypeをnot_medication_documentにする。
- ぼけ、反射、欠けで安全に転記できない場合はimageQualityをneeds_retakeにする。
`;

function getApiKey() {
    return process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
}

function sanitizeResult(raw) {
    return {
        documentType: ['medication_document', 'not_medication_document', 'unknown'].includes(raw?.documentType)
            ? raw.documentType
            : 'unknown',
        imageQuality: ['readable', 'partially_readable', 'needs_retake'].includes(raw?.imageQuality)
            ? raw.imageQuality
            : 'partially_readable',
        name: String(raw?.name || '').trim().slice(0, 120),
        dosageText: String(raw?.dosageText || '').trim().slice(0, 160),
        timingText: String(raw?.timingText || '').trim().slice(0, 160),
        rawText: String(raw?.rawText || '').trim().slice(0, 1200),
        warnings: Array.isArray(raw?.warnings)
            ? raw.warnings.map((item) => String(item).trim().slice(0, 160)).filter(Boolean).slice(0, 8)
            : [],
    };
}

function needsFallback(result) {
    return result.documentType === 'unknown'
        || (result.documentType === 'medication_document' && !result.name && !result.rawText);
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

async function extractMedication(photoDataUrl, options = {}) {
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

module.exports = { extractMedication, sanitizeResult, needsFallback, responseJsonSchema };
