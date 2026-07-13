const express = require('express');
const controller = require('../controllers/overviewController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);
router.get('/recent-changes', controller.getRecentChanges);
router.get('/photos', controller.getPhotos);
router.get('/doctor-view', controller.getDoctorView);
router.post('/doctor-view/preview', controller.previewDoctorView);
router.post('/doctor-view/export', controller.exportDoctorView);

module.exports = router;
