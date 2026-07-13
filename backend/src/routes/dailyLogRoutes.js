const express = require('express');
const multer = require('multer');
const controller = require('../controllers/dailyLogController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 3 },
    fileFilter: (_req, file, callback) => callback(allowedTypes.has(file.mimetype) ? null : new Error('unsupported media type'), allowedTypes.has(file.mimetype)),
});

function receiveMedia(req, res, next) {
    upload.array('media', 3)(req, res, (error) => {
        if (!error) return next();
        const status = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ ok: false, error: error.code === 'LIMIT_FILE_SIZE' ? '1ファイルは15MBまでです' : '写真または短い動画を選んでください' });
    });
}

const router = express.Router();
router.use(verifyAccountSession);
router.get('/', controller.listDailyLogs);
router.get('/:id', controller.getDailyLog);
router.get('/:id/media/:mediaId', controller.getDailyLogMedia);
router.post('/', receiveMedia, controller.createDailyLog);
router.patch('/:id', receiveMedia, controller.updateDailyLog);
router.delete('/:id', controller.deleteDailyLog);

module.exports = router;
