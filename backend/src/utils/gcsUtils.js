const { bucket } = require('../config/gcs');
const path = require('path');

// GCS Compose Limit is 32 source objects
const COMPOSE_LIMIT = 32;

/**
 * Combines multiple GCS files into a single destination file using GCS Compose.
 * Handles the 32-file limit by performing recursive composition.
 * 
 * @param {string[]} sourceNames - Array of GCS object names (paths) to combine.
 * @param {string} destName - Destination GCS object name.
 * @param {string} contentType - Content type for the destination file.
 */
async function composeMany(sourceNames, destName, contentType = 'audio/webm') {
    if (sourceNames.length === 0) return;
    if (sourceNames.length === 1) {
        // Just copy if only one file
        if (sourceNames[0] !== destName) {
            await bucket.file(sourceNames[0]).copy(bucket.file(destName));
        }
        return;
    }

    // If sources <= 32, compose directly
    if (sourceNames.length <= COMPOSE_LIMIT) {
        const sourceFiles = sourceNames.map(name => bucket.file(name));
        const destFile = bucket.file(destName);
        await destFile.request({
            uri: `https://storage.googleapis.com/storage/v1/b/${bucket.name}/o/${encodeURIComponent(destName)}/compose`,
            method: 'POST',
            json: {
                sourceObjects: sourceFiles.map(f => ({ name: f.name })),
                destination: { contentType }
            }
        });
        return;
    }

    // If > 32, split into batches and compose recursively
    const intermediateFiles = [];
    const roundId = Date.now();
    let batchIndex = 0;

    for (let i = 0; i < sourceNames.length; i += COMPOSE_LIMIT) {
        const batch = sourceNames.slice(i, i + COMPOSE_LIMIT);
        const tempName = `${destName}.temp.${roundId}.${batchIndex}`;
        await composeMany(batch, tempName, contentType);
        intermediateFiles.push(tempName);
        batchIndex++;
    }

    // Finally compose the intermediates
    await composeMany(intermediateFiles, destName, contentType);

    // Cleanup intermediates
    try {
        await Promise.all(intermediateFiles.map(f => bucket.file(f).delete()));
    } catch (e) {
        console.warn('Failed to cleanup intermediate composition files:', e);
    }
}

module.exports = { composeMany };
