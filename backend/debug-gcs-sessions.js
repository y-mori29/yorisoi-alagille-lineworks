const { Storage } = require("@google-cloud/storage");
const path = require("path");
require("dotenv").config();

async function checkGCS() {
    const storage = new Storage({ keyFilename: path.join(__dirname, "sa-key.json") });
    const bucket = storage.bucket(process.env.GCS_BUCKET);

    console.log("Listing sessions...");
    try {
        const [files] = await bucket.getFiles({ prefix: "sessions/", maxResults: 50 });
        console.log(`Found ${files.length} files in sessions/`);

        // Group by session
        const sessions = {};
        files.forEach(f => {
            const parts = f.name.split("/");
            if (parts.length > 1) {
                const sid = parts[1];
                if (!sessions[sid]) sessions[sid] = [];
                sessions[sid].push({ name: f.name, size: f.metadata.size });
            }
        });

        Object.entries(sessions).slice(-3).forEach(([sid, files]) => {
            console.log(`Session: ${sid}`);
            files.forEach(f => console.log(`  - ${f.name} (${f.size} bytes)`));
        });

    } catch (e) {
        console.error("GCS Error:", e);
    }
}

checkGCS();
