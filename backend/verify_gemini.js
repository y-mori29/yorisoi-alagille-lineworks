const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function main() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("❌ GEMINI_API_KEY is not defined in environment variables.");
        return;
    }

    // Mask key for log safety
    const maskedKey = apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`🔑 Using API Key: ${maskedKey}`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    try {
        console.log("🚀 Testing Gemini API...");
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        const text = response.text();
        console.log("✅ Success! API Response:", text);
    } catch (error) {
        console.error("❌ API Error Details:");
        console.error(JSON.stringify(error, null, 2));

        if (error.message && error.message.includes("API key expired")) {
            console.error("\nCRITICAL: The API key is indeed EXPIRED.");
        }
    }
}

main();
