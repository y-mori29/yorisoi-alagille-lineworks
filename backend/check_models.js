const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function listModels() {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API KEY found");
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // List models that support generateContent
        // Note: The SDK might map this to GET /v1beta/models
        // We want to see what's actually available.
        // Since SDK specific method to list models might be admin only or specific, 
        // we can try fetching a known model or just error dump if SDK doesn't support listing easily.
        // But GoogleGenerativeAI class doesn't strictly have listModels on the instance usually, 
        // it's often on a specific manager or we have to use REST.
        // Let's try to verify if the model exists by just initializing it and running a dry run, 
        // OR use the actual list endpoint via fetch if SDK fails.

        console.log("Checking API Key availability...");

        // Fetch via REST API to be sure about available models
        // Using v1beta as per existing error
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("=== Available Models ===");
            const generateModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
            generateModels.forEach(m => {
                console.log(`- ${m.name} (${m.displayName}): ${m.description}`);
            });
        } else {
            console.error("Error listing models:", JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
