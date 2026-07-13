const express = require('express');
const controller = require('../controllers/labController');
const { requireOcrCapacity } = require('../middleware/ocrRateLimit');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();

router.get('/tutorial', controller.getLabTutorial);
router.use(verifyAccountSession);
router.get('/', controller.listLabs);
router.get('/trends', controller.getLabTrends);
router.get('/:id/photo', controller.getLabPhoto);
router.post('/', controller.createLab);
router.post('/ocr', requireOcrCapacity, controller.readLabImage);
router.patch('/:id', controller.updateLab);
router.delete('/:id', controller.deleteLab);

module.exports = router;
