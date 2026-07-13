const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function testGemini() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    try {
        const result = await model.generateContent("Hello, are you working?");
        console.log("Gemini Response:", result.response.text());
    } catch (e) {
        console.error("Gemini Error:", e);
    }
}

testGemini();
