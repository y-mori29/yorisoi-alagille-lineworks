require('dotenv').config();
const { GoogleGenerativeAI } = require("@google-cloud/generative-ai");

async function check() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        console.error("❌ GEMINI_API_KEY is not set in .env");
        return;
    }

    // Masked output for safety
    const masked = key.substring(0, 8) + "..." + key.substring(key.length - 6);
    console.log(`🔑 Loaded API Key: ${masked}`);
    console.log(`(Please verify this matches the key you are looking at in the console)`);

    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    try {
        console.log("📡 Testing API connection...");
        const result = await model.generateContent("Hello!");
        const response = await result.response;
        console.log("✅ Success! Response:", response.text());
    } catch (e) {
        console.error("❌ API Call Failed!");
        console.error("Error Details:", e.message);

        if (e.message.includes("leaked")) {
            console.error("\n⚠️  This specific error confirms Google has blocked this key.");
            console.error("    Even if it looks active in the console, it cannot be used.");
            console.error("    Please create a brand NEW key.");
        }
    }
}

check();
