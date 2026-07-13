const { Storage } = require('@google-cloud/storage');
const path = require('path');

// Uses GOOGLE_APPLICATION_CREDENTIALS from .env
const storage = new Storage();
const bucketName = process.env.GCS_BUCKET;
const bucket = storage.bucket(bucketName);

module.exports = { storage, bucket };
