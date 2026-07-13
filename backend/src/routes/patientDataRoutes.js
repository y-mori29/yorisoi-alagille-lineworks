const express = require('express');
const controller = require('../controllers/patientDataController');

const router = express.Router();

router.get('/clinics', controller.listClinics);
router.post('/clinics', controller.createClinic);
router.put('/clinics/:id', controller.updateClinic);
router.delete('/clinics/:id', controller.deleteClinic);

router.get('/visits', controller.listVisits);
router.post('/visits', controller.createVisit);
router.put('/visits/:id', controller.updateVisit);

router.get('/timeline', controller.listTimeline);
router.post('/timeline', controller.createTimeline);

router.post('/ai/parse-record', controller.parseRecord);
router.post('/ai/transcribe', controller.transcribeAudio);
router.post('/ai/chat-record', controller.chatRecord);
router.post('/ai/summarize-other-visits', controller.summarizeOtherVisits);

module.exports = router;
