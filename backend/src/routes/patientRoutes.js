const express = require('express');
const router = express.Router();
const controller = require('../controllers/patientController');

// Note: In index.js we mount this at /api/patients

// 患者LIFF用（認証なし・固定パスは :id ルートより先に定義）
router.get('/liff-config', controller.getLiffConfig);
router.post('/session', controller.createPatientSession);

module.exports = router;
