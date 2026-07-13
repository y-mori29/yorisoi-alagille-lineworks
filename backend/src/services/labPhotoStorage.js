const { randomUUID } = require('node:crypto');
const { bucket } = require('../config/gcs');
const { parseImageDataUri } = require('./labOcrService');

const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function assertBucketConfigured() {
    if (!process.env.GCS_BUCKET) {
        const error = new Error('GCS bucket is not configured');
        error.status = 503;
        throw error;
    }
}

async function saveLabPhoto({ tenantId, familyId, patientId, photoDataUrl }) {
    assertBucketConfigured();
    const { mimeType, base64Data } = parseImageDataUri(photoDataUrl);
    const objectName = [
        'tenants', tenantId,
        'families', familyId,
        'patients', patientId,
        'labs', `${randomUUID()}.${extensions[mimeType] || 'jpg'}`,
    ].join('/');
    await bucket.file(objectName).save(Buffer.from(base64Data, 'base64'), {
        resumable: false,
        validation: 'crc32c',
        metadata: {
            contentType: mimeType,
            cacheControl: 'private, no-store',
        },
    });
    return { photoObject: objectName, photoMimeType: mimeType };
}

async function deleteLabPhoto(objectName) {
    if (!objectName || !process.env.GCS_BUCKET) return;
    await bucket.file(objectName).delete({ ignoreNotFound: true });
}

function createLabPhotoReadStream(objectName) {
    assertBucketConfigured();
    return bucket.file(objectName).createReadStream();
}

module.exports = { saveLabPhoto, deleteLabPhoto, createLabPhotoReadStream };
