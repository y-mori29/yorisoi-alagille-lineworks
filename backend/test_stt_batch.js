const { SpeechClient } = require('@google-cloud/speech').v2;
const fs = require('fs');
require('dotenv').config();

async function testBatch() {
    const client = new SpeechClient({
        apiEndpoint: 'asia-northeast1-speech.googleapis.com'
    });
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'yorisoi-medical';
    const location = 'asia-northeast1';

    // Using a known short file in our bucket
    // e.g. gs://yorisoi-medical.appspot.com/audio/8f59dfe5-8316-4915-8ff7-1f15bddcc55c.wav

    const sttRequest = {
        recognizer: `projects/${projectId}/locations/${location}/recognizers/_`,
        config: {
            autoDecodingConfig: {},
            model: 'chirp_3',
            languageCodes: ['ja-JP'],
        },
        files: [{ uri: "gs://yorisoi-medical.appspot.com/audio/8f59dfe5-8316-4915-8ff7-1f15bddcc55c.wav" }],
        recognitionOutputConfig: {
            inlineResponseConfig: {}
        }
    };

    try {
        console.log("Starting batchRecognize...");
        const [operation] = await client.batchRecognize(sttRequest);
        console.log("Waiting for operation...");
        const [response] = await operation.promise();
        console.log("Success. Result keys:");
        console.log(Object.keys(response));
        if (response.results) {
            console.log("Got results for file");
            const firstFileResult = response.results['gs://yorisoi-medical.appspot.com/audio/8f59dfe5-8316-4915-8ff7-1f15bddcc55c.wav'];
            if (firstFileResult && firstFileResult.transcript) {
                console.log("Has transcript:", firstFileResult.transcript.results.length, "results");
            } else {
                console.log(JSON.stringify(response.results, null, 2));
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

testBatch();
