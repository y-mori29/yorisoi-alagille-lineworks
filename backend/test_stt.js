const { SpeechClient } = require('@google-cloud/speech').v2;
async function test() {
    try {
        const client = new SpeechClient({ apiEndpoint: 'asia-northeast1-speech.googleapis.com' });
        const req = {
            recognizer: 'projects/yorisoi-medical/locations/asia-northeast1/recognizers/_',
            config: {
                autoDecodingConfig: {},
                model: 'chirp_3',
                languageCodes: ['ja-JP'],
                features: {
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true,
                    diarizationConfig: { minSpeakerCount: 1, maxSpeakerCount: 4 }
                }
            },
            files: [{ uri: 'gs://yorisoi-medical.firebasestorage.app/audio/test.wav' }],
            recognitionOutputConfig: { inlineResponseConfig: {} }
        };
        console.log("Sending batchRecognize request...");
        const [op] = await client.batchRecognize(req);
        console.log("Wait for op...");
        const [res] = await op.promise();
        console.log("Response:", JSON.stringify(res, null, 2));
    } catch (e) {
        console.error("Caught error:", e);
    }
}
test();
