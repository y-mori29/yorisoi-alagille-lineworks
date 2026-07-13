const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const admin = require('firebase-admin');
require('dotenv').config();

// Init Firebase
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS || './sa-key.json')
    });
}
const db = admin.firestore();

// Target Files
const FILES = [
    { path: '../さんごの家.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
    { path: '../さんご診療情報.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
];

async function main() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found");
        return;
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

    for (const fileInfo of FILES) {
        const filePath = path.join(__dirname, fileInfo.path);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
        }

        console.log(`Processing ${path.basename(filePath)}...`);
        const buffer = fs.readFileSync(filePath);
        let extractedText = "";

        // Parse
        if (fileInfo.mime.includes('spreadsheetml')) {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            let allText = [];
            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const csv = xlsx.utils.sheet_to_csv(sheet);
                allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            });
            extractedText = allText.join('\n\n');
        } else if (fileInfo.mime.includes('wordprocessingml')) {
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
        }

        if (!extractedText) {
            console.error(`Failed to extract text from ${filePath}`);
            continue;
        }

        // Gemini Summary
        console.log(`Analyzing text length: ${extractedText.length}`);
        const prompt = `
このドキュメント（以前にテキスト変換済み）の内容を解析し、後でAIが参照しやすいように「要約された構造化テキスト」として抽出してください。
内容を欠落させることなく、重要なポイントを整理してMarkdown形式で出力してください。
特に、患者ケア、施設ルール、重要な薬品情報、連絡体制などが含まれている場合は重点的に抽出してください。
出力はMarkdownのテキストのみにしてください。

【ドキュメント内容】
${extractedText.substring(0, 100000)} 
`;
        // Truncate if too huge, though Gemini context window is large.

        try {
            const result = await model.generateContent(prompt);
            const parsedContent = result.response.text();

            // Save
            await db.collection('knowledge').add({
                filename: path.basename(filePath),
                mimeType: fileInfo.mime,
                parsedContent,
                createdAt: new Date().toISOString()
            });
            console.log(`Success: Registered ${path.basename(filePath)}`);
        } catch (e) {
            console.error(`Error processing ${path.basename(filePath)}:`, e);
        }
    }
}

main();
