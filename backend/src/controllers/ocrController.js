const { db } = require('../config/firebase');
const admin = require('firebase-admin');
const { GoogleGenAI } = require('@google/genai');
const { GEMINI_FLASH_MODEL } = require('../config/genaiModels');

/**
 * processPrescription: 処方箋画像をGemini 3.0 Flash で解析し、JSON形式で返す
 */
exports.processPrescription = async (req, res) => {
    try {
        const { patientId } = req.body;

        if (!process.env.GOOGLE_GENAI_API_KEY && !process.env.GEMINI_API_KEY) {
            console.error('[OCR Error] API Key is missing in environment variables');
            return res.status(500).json({ error: 'サーバー設定エラー: APIキーが見つかりません' });
        }

        if (!req.file) {
            return res.status(400).json({ error: '画像ファイルが必要です' });
        }

        // Initialize SDK (using GOOGLE_GENAI_API_KEY or GEMINI_API_KEY)
        const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY });

        const prompt = `
あなたは優秀な薬剤師です。提供された処方箋の画像から、以下の情報をJSON形式で抽出してください。
日本語で回答してください。

期待するJSONフォーマット:
{
  "institutionName": "医療機関名",
  "prescriptionDate": "処方日 (YYYY-MM-DD)",
  "medications": [
    {
      "name": "薬品名",
      "dosage": "分量 (例: 3錠)",
      "usage": "用法 (例: 1日3回 毎食後)",
      "duration": "期間 (例: 7日分)"
    }
  ],
  "rawText": "画像から読み取れた全テキスト（要約）"
}
`;

        const imagePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const response = await ai.models.generateContent({
            model: GEMINI_FLASH_MODEL,
            contents: [
                prompt,
                imagePart
            ]
        });

        const text = response.text;

        // JSON部分を抽出
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(500).json({ error: 'OCR結果からJSONを抽出できませんでした', raw: text });
        }

        const prescriptionData = JSON.parse(jsonMatch[0]);

        // Firestoreに保存 (patientIdがある場合)
        let savedDocId = null;
        if (patientId) {
            const prescriptionRef = db.collection('patients').doc(patientId).collection('prescriptions').doc();
            await prescriptionRef.set({
                ...prescriptionData,
                source: 'OCR',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                date: new Date().toISOString()
            });
            savedDocId = prescriptionRef.id;

            // エンカウンター（記録）としても登録して一覧に出るようにする
            const encRef = db.collection('patients').doc(patientId).collection('encounters').doc();
            await encRef.set({
                patientId,
                date: new Date().toISOString(),
                status: 'COMPLETED',
                type: 'PRESCRIPTION_OCR',
                source: 'OCR',
                data: prescriptionData,
                soap: { s: `【処方箋OCR】${prescriptionData.institutionName || ''}`, o: "", a: "", p: "" },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        res.json({
            ok: true,
            data: prescriptionData,
            prescriptionId: savedDocId
        });

    } catch (error) {
        console.error('[OCR Error]', error);
        res.status(500).json({ error: error.message });
    }
};
