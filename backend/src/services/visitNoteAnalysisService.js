const { GoogleGenAI } = require('@google/genai');

const MODEL = process.env.VISIT_NOTE_MODEL || process.env.GEMINI_OCR_MODEL || 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = process.env.VISIT_NOTE_FALLBACK_MODEL || process.env.GEMINI_OCR_FALLBACK_MODEL || 'gemini-3.5-flash';

const responseJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: { type: 'string' },
        doctorSaid: { type: 'array', items: { type: 'string' } },
        nextQuestions: { type: 'array', items: { type: 'string' } },
        medicationChanges: { type: 'array', items: { type: 'string' } },
        labAndTestTopics: { type: 'array', items: { type: 'string' } },
        growthNutritionTopics: { type: 'array', items: { type: 'string' } },
        dailyLifeTopics: { type: 'array', items: { type: 'string' } },
        departments: { type: 'array', items: { type: 'string' } },
    },
    required: ['summary', 'doctorSaid', 'nextQuestions', 'medicationChanges', 'labAndTestTopics', 'growthNutritionTopics', 'dailyLifeTopics', 'departments'],
};

const prompt = `
あなたは、アラジール症候群のご本人と家族が診察内容を見返すための記録整理を補助します。
<transcript>と<family_memo>に実際に書かれている内容だけを、日本語で簡潔に整理してください。

厳守事項:
- 会話にない薬名、検査値、症状、診断、予定を補完しない。
- 医学的な正常・異常、改善・悪化、安全・危険を判定しない。
- 医師や家族が実際に述べた評価語だけを、その発言として記録する。
- 不明な項目は空配列または空文字にする。「特になし」を作らない。
- nextQuestionsには、実際に質問したい・次回聞くと述べた内容だけを入れる。
- medicationChangesには、薬の開始・中止・増減・継続について実際に言及された内容だけを入れる。
- summaryは2文以内のやさしい表現にする。
- 個人名、患者ID、住所、電話番号は出力しない。
`;

function cleanList(value, maxItems = 12) {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').replace(/\s+/g, ' ').trim().slice(0, 240)).filter(Boolean).slice(0, maxItems);
}

function sanitizeResult(raw) {
    return {
        summary: String(raw?.summary || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        doctorSaid: cleanList(raw?.doctorSaid),
        nextQuestions: cleanList(raw?.nextQuestions),
        medicationChanges: cleanList(raw?.medicationChanges),
        labAndTestTopics: cleanList(raw?.labAndTestTopics),
        growthNutritionTopics: cleanList(raw?.growthNutritionTopics),
        dailyLifeTopics: cleanList(raw?.dailyLifeTopics),
        departments: cleanList(raw?.departments, 6),
    };
}

function needsFallback(result) {
    return !result.summary && !result.doctorSaid.length && !result.nextQuestions.length
        && !result.medicationChanges.length && !result.labAndTestTopics.length
        && !result.growthNutritionTopics.length && !result.dailyLifeTopics.length;
}

async function callModel(ai, model, transcript, familyMemo) {
    const response = await ai.models.generateContent({
        model,
        contents: [{
            role: 'user',
            parts: [{ text: `${prompt}\n<transcript>\n${transcript}\n</transcript>\n<family_memo>\n${familyMemo || ''}\n</family_memo>` }],
        }],
        config: {
            temperature: 0,
            thinkingConfig: { thinkingLevel: 'minimal' },
            responseMimeType: 'application/json',
            responseJsonSchema,
        },
    });
    return sanitizeResult(JSON.parse(response.text));
}

async function analyzeVisitNote({ transcript, familyMemo = '', apiKey, ai, primaryModel = MODEL, fallbackModel = FALLBACK_MODEL }) {
    const text = String(transcript || '').trim().slice(0, 50000);
    if (!text) {
        const error = new Error('transcript required');
        error.status = 400;
        throw error;
    }
    const key = apiKey || process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || '';
    if (!key && !ai) {
        const error = new Error('Gemini API key is not configured');
        error.status = 503;
        throw error;
    }
    const client = ai || new GoogleGenAI({ apiKey: key });
    let result = await callModel(client, primaryModel, text, String(familyMemo || '').slice(0, 2000));
    let model = primaryModel;
    if (fallbackModel && fallbackModel !== primaryModel && needsFallback(result)) {
        result = await callModel(client, fallbackModel, text, String(familyMemo || '').slice(0, 2000));
        model = fallbackModel;
    }
    return { ...result, model };
}

module.exports = { analyzeVisitNote, sanitizeResult, needsFallback, responseJsonSchema };
