const express = require('express');
const controller = require('../controllers/visitNoteController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);

router.get('/', controller.listVisitNotes);
router.post('/', controller.createVisitNote);
router.post('/analyze', controller.analyzeText);
router.post('/recordings', controller.initRecording);
router.put('/recordings/:recordingId/chunks/:seq', express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '8mb' }), controller.uploadChunk);
router.post('/recordings/:recordingId/finalize', controller.finalizeRecording);
router.get('/recordings/:recordingId/status', controller.getRecordingStatus);
router.delete('/recordings/:recordingId', controller.cancelRecording);
router.get('/:id/audio', controller.getVisitNoteAudio);
router.patch('/:id', controller.updateVisitNote);
router.delete('/:id', controller.deleteVisitNote);

module.exports = router;
