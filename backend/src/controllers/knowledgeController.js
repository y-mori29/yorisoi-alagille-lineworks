const { GoogleGenerativeAI } = require("@google/generative-ai");
// 重要: admin.firestore() は (default)=光本番DB に繋がるため使用禁止。
// 必ず config/firebase の db（FIRESTORE_DATABASE_ID=pharmacy）を使う。
const { db } = require('../config/firebase');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { GEMINI_FLASH_MODEL } = require('../config/genaiModels');

/**
 * uploadKnowledge: 外部ドキュメントをアップロードし、Geminiで解析・テキスト化してFirestoreに保存
 */
exports.uploadKnowledge = async (req, res) => {
    try {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error('[Knowledge Upload] API Key missing');
            return res.status(500).json({ error: 'Server API Key configuration error' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);

        if (!req.file) {
            console.warn('[Knowledge Upload] No file provided');
            return res.status(400).json({ error: 'ファイルが必要です' });
        }

        console.log(`[Knowledge Upload] Processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);

        let extractedText = "";
        const mime = req.file.mimetype;

        // --- Text Extraction for Office Files ---
        if (mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel') {
            // Excel
            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            let allText = [];
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const csv = xlsx.utils.sheet_to_csv(sheet);
                allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            });
            extractedText = allText.join('\n\n');
            console.log(`[Knowledge Upload] Parsed Excel, length: ${extractedText.length}`);

        } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            // Word
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            extractedText = result.value;
            console.log(`[Knowledge Upload] Parsed Word, length: ${extractedText.length}`);
            if (result.messages.length > 0) {
                console.log("[Knowledge Upload] Mammoth messages:", result.messages);
            }
        }

        // Use the latest available model
        const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });

        // Add patient name extraction instruction to prompt
        const extractionInstruction = `
もしこのドキュメントが特定の患者に関するものである場合、その患者の実名（フルネーム）を特定し、回答の1行目に「TARGET_PATIENT_NAME: [名前]」の形式で記述してください。
特定の患者に関するものでない場合は「TARGET_PATIENT_NAME: NONE」としてください。
その後に、ドキュメントの構造化要約を続けてください。
`;

        let finalPrompt = "";
        let contentPart = {};

        if (extractedText) {
            finalPrompt = `
${extractionInstruction}
このドキュメントの内容を解析し、要約された構造化テキストとして抽出してください。
内容を欠落させることなく、Markdown形式で出力してください。

【ドキュメント内容】
${extractedText}
`;
            contentPart = { role: "user", parts: [{ text: finalPrompt }] };
        } else {
            finalPrompt = `
${extractionInstruction}
このドキュメントの内容を解析し、要約された構造化テキストとして抽出してください。
Markdown形式で出力してください。
`;
            contentPart = {
                role: "user",
                parts: [
                    { text: finalPrompt },
                    {
                        inlineData: {
                            data: req.file.buffer.toString("base64"),
                            mimeType: req.file.mimetype
                        }
                    }
                ]
            };
        }

        const result = await model.generateContent({
            contents: [contentPart]
        });

        const response = await result.response;
        const fullText = response.text();

        // Extract patient name from AI response
        let targetPatientName = null;
        let parsedContent = fullText;
        const nameMatch = fullText.match(/^TARGET_PATIENT_NAME:\s*(.+)$/m);
        if (nameMatch && nameMatch[1] !== 'NONE') {
            targetPatientName = nameMatch[1].trim();
            // Remove the metadata line from final content
            parsedContent = fullText.replace(/^TARGET_PATIENT_NAME:.*$/m, '').trim();
        }

        console.log(`[Knowledge Upload] Analysis success. Target Patient: ${targetPatientName || 'None'}`);

        // Firestoreに保存
        const { patientId } = req.body; // Client can explicitly provide patientId
        const knowledgeRef = db.collection('knowledge').doc();
        await knowledgeRef.set({
            tenantId: req.tenantId,
            filename: req.file.originalname,
            mimeType: req.file.mimetype,
            parsedContent: parsedContent,
            patientId: patientId || null,
            targetPatientName: targetPatientName,
            createdAt: new Date().toISOString()
        });

        res.json({
            ok: true,
            knowledgeId: knowledgeRef.id,
            filename: req.file.originalname,
            parsedContent: parsedContent,
            targetPatientName: targetPatientName
        });

    } catch (error) {
        console.error('[Knowledge Upload Error]', error);
        res.status(500).json({ error: `アップロード・解析エラー: ${error.message}` });
    }
};

/**
 * getKnowledgeList: 登録済みのナレッジ一覧を取得
 */
exports.getKnowledgeList = async (req, res) => {
    try {
        // tenant絞り＋メモリ上ソート（where+orderByの複合インデックスを要求しないため）
        const snapshot = await db.collection('knowledge')
            .where('tenantId', '==', req.tenantId).get();
        const list = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        res.json({ ok: true, list });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * deleteKnowledge: ナレッジを削除
 */
exports.deleteKnowledge = async (req, res) => {
    try {
        const { id } = req.params;
        // 所有テナント検証：他テナントのナレッジ削除は404で隠す
        const doc = await db.collection('knowledge').doc(id).get();
        if (!doc.exists || doc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Knowledge not found' });
        }
        await db.collection('knowledge').doc(id).delete();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
