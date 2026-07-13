const { GoogleGenerativeAI } = require("@google/generative-ai");
// 重要: admin.firestore() は (default)=光本番DB に繋がるため使用禁止。
// 必ず config/firebase の db（FIRESTORE_DATABASE_ID=pharmacy）を使う。
const { db } = require('../config/firebase');

// Initialize Gemini
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const { GEMINI_FLASH_MODEL } = require('../config/genaiModels');
const model = genAI.getGenerativeModel({ model: GEMINI_FLASH_MODEL });

/**
 * chatWithPatientContext: 患者の全情報をコンテキストとしてチャットを行う
 */
exports.chatWithPatientContext = async (req, res) => {
    try {
        const { patientId, message, history } = req.body;

        if (!patientId || !message) {
            return res.status(400).json({ error: 'Patient ID and message are required' });
        }

        console.log(`[Chat] Request for patient: ${patientId}, query: ${message.substring(0, 50)}...`);

        // --- 1. Data Collection (RAG) ---

        // A. Patient Basic Info
        const patientDoc = await db.collection('patients').doc(patientId).get();
        if (!patientDoc.exists || patientDoc.data().tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        const patientData = patientDoc.data();
        const patientInfoStr = `【基本情報】\n名前: ${patientData.name}\nID: ${patientId}\n施設: ${patientData.facilityId || '不明'}`;

        // B. Knowledge Base (Filtering by Patient)
        let knowledgeBaseStr = "【学習資料・マニュアル】\n(登録なし)";
        const kwDocs = await db.collection('knowledge')
            .where('tenantId', '==', req.tenantId).get();
        if (!kwDocs.empty) {
            const filteredKw = kwDocs.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter(data => {
                    // Filter: 
                    // 1. Explicitly linked to THIS patient
                    // 2. Automated name extraction matched THIS patient name
                    // 3. No patient link (Global facility material)
                    // 4. EXCLUDE if linked to OTHER patient
                    if (data.patientId && data.patientId !== patientId) return false;
                    if (data.targetPatientName && data.targetPatientName !== patientData.name) {
                        // If it has a name but doesn't match current patient, it's a mix-up risk
                        return false;
                    }
                    return true;
                });

            if (filteredKw.length > 0) {
                knowledgeBaseStr = "【学習資料・マニュアル】\n" + filteredKw.map(data => {
                    return `[資料名: ${data.filename}]\n${data.parsedContent}`;
                }).join('\n\n');
            }
        }

        // C. Past Encounters
        let historyStr = "【過去の診療・訪問記録】\n(記録なし)";
        const encDocs = await db.collection('patients').doc(patientId)
            .collection('encounters')
            .orderBy('date', 'desc')
            .limit(20)
            .get();

        if (!encDocs.empty) {
            historyStr = "【過去の診療・訪問記録 (新しい順)】\n" + encDocs.docs.map(d => {
                const data = d.data();
                return `[日付: ${data.date}]\n` +
                    `SOAP要約: ${JSON.stringify(data.soap)}\n` +
                    `薬剤情報: ${JSON.stringify(data.pharmacy_focus?.medications)}\n` +
                    `前回からの変更点: ${data.changes_from_last_time || 'なし'}`;
            }).join('\n----------------\n');
        }

        // D. Latest Prescription OCR
        let ocrStr = "【最新の処方箋OCR情報】\n(データなし)";
        const recsSnap = await db.collection('recordings')
            .where('patientId', '==', patientId)
            .where('tenantId', '==', req.tenantId)
            .get();

        if (!recsSnap.empty) {
            const ocrDocs = recsSnap.docs
                .map(d => d.data())
                .filter(d => d.source === 'OCR')
                .sort((a, b) => {
                    const dateA = new Date(a.createdAt || 0);
                    const dateB = new Date(b.createdAt || 0);
                    return dateB - dateA;
                });

            if (ocrDocs.length > 0) {
                const ocrData = ocrDocs[0];
                ocrStr = `【最新の処方箋OCR情報 (日付: ${ocrData.date || ocrData.createdAt})】\n${JSON.stringify(ocrData.data)}`;
            }
        }

        // --- 2. Construct Prompt ---
        const systemInstruction = `
あなたは、在宅医療を支援する高度なAIアシスタントです。
現在、表示中の患者は「${patientData.name}」様です。

【最重要ルール（厳守）】
1. **文章を完結させる**: 回答は必ず文末（句点「。」）まで書ききってください。途中で文章を終わらせることは絶対に避けてください。
2. **情報の整合性**: 以下の資料（ナレッジ）の中に、現在の患者名「${patientData.name}」と異なる氏名が含まれている場合、その情報は絶対に回答に使用しないでください。
3. **事実に基づく**: 記録（Encounters, OCR）にないことは「記録にありません」と答えてください。

【役割】
- 記録の中から質問に関連する情報を探し、NotebookLMのように根拠を持って答える。
- 時系列の変化や処方の変更点に注目する。

【回答スタイル】
- 丁寧語（です・ます）。
- 箇条書きを活用し、参照元の日付を明記する。
`;

        const context = `
### 表示中の患者情報
${patientInfoStr}

### 最新の処方箋 (OCR)
${ocrStr}

### 診療・訪問記録履歴
${historyStr}

### 学習資料・マニュアル
${knowledgeBaseStr}
`;

        // --- 3. Generate Chat ---
        const chatHistory = (history || []).map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
        }));

        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: systemInstruction + "\n\n以下が現在のコンテキストデータです:\n" + context }] },
                { role: "model", parts: [{ text: "承知いたしました。患者様の情報と学習資料を読み込みました。どのようなことでもご質問ください。" }] },
                ...chatHistory
            ],
            generationConfig: {
                maxOutputTokens: 8192,
                temperature: 0.7,
            },
            safetySettings: [
                { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ]
        });

        const result = await chat.sendMessage(message + "\n\n(重要: 回答は、結論や今後の展望を含め、必ず最後の文末の句点まで完全に書ききってください。途中で切れることは絶対に許されません。)");
        const response = result.response;
        const responseText = response.text();

        // Log finish reason for debugging if it's not STOP
        const candidate = response.candidates?.[0];
        if (candidate && candidate.finishReason !== 'STOP') {
            console.warn(`[Chat] Response finished with reason: ${candidate.finishReason}. Text might be truncated.`);
        }

        res.json({ ok: true, reply: responseText });

    } catch (e) {
        console.error('[Chat] Error:', e);
        res.status(500).json({ error: e.message });
    }
};
