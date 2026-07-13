const { randomUUID } = require('node:crypto');
const { bucket } = require('../config/gcs');

const extensions = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
};

function assertBucketConfigured() {
    if (!process.env.GCS_BUCKET) {
        const error = new Error('GCS bucket is not configured');
        error.status = 503;
        throw error;
    }
}

async function saveDailyLogMedia({ tenantId, familyId, patientId, dailyLogId, file }) {
    assertBucketConfigured();
    const mediaId = randomUUID();
    const objectName = [
        'tenants', tenantId,
        'families', familyId,
        'patients', patientId,
        'daily-logs', dailyLogId,
        `${mediaId}.${extensions[file.mimetype]}`,
    ].join('/');
    await bucket.file(objectName).save(file.buffer, {
        resumable: false,
        validation: 'crc32c',
        metadata: { contentType: file.mimetype, cacheControl: 'private, no-store' },
    });
    return {
        id: mediaId,
        mediaType: file.mimetype.startsWith('video/') ? 'video' : 'photo',
        storagePath: objectName,
        contentType: file.mimetype,
        originalName: String(file.originalname || '').slice(0, 160),
        sizeBytes: file.size,
        durationSec: null,
        thumbnailPath: '',
    };
}

async function deleteDailyLogMedia(storagePath) {
    if (!storagePath || !process.env.GCS_BUCKET) return;
    await bucket.file(storagePath).delete({ ignoreNotFound: true });
}

function createDailyLogMediaReadStream(storagePath, options = {}) {
    assertBucketConfigured();
    return bucket.file(storagePath).createReadStream(options);
}

module.exports = { saveDailyLogMedia, deleteDailyLogMedia, createDailyLogMediaReadStream };
