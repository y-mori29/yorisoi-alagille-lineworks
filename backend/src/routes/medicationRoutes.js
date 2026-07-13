const express = require('express');
const controller = require('../controllers/medicationController');
const { verifyAccountSession } = require('../middleware/accountAuth');
const { requireOcrCapacity } = require('../middleware/ocrRateLimit');

const router = express.Router();
router.use(verifyAccountSession);

router.get('/', controller.listMedications);
router.get('/:id/photo', controller.getMedicationPhoto);
router.post('/ocr', requireOcrCapacity, controller.readMedicationImage);
router.post('/', controller.createMedication);
router.patch('/:id', controller.updateMedication);
router.delete('/:id', controller.deleteMedication);
router.post('/:id/checks', controller.createMedicationCheck);

module.exports = router;
