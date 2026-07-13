const express = require('express');
const router = express.Router();
const controller = require('../controllers/ocrController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/ocr/prescription
router.post('/prescription', upload.single('image'), controller.processPrescription);

module.exports = router;
