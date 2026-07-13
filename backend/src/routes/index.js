const express = require('express');
const router = express.Router();

// Feature routes（server.js が /api にマウントする前提の相対パス）
const configRoutes = require('./configRoutes');
const patientRoutes = require('./patientRoutes');
const patientDataRoutes = require('./patientDataRoutes');
const recordingRoutes = require('./recordingRoutes');
const familyRoutes = require('./familyRoutes');
const labRoutes = require('./labRoutes');
const medicationRoutes = require('./medicationRoutes');
const growthRoutes = require('./growthRoutes');
const visitNoteRoutes = require('./visitNoteRoutes');
const dailyLogRoutes = require('./dailyLogRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const questionRoutes = require('./questionRoutes');
const overviewRoutes = require('./overviewRoutes');
const accountRoutes = require('./accountRoutes');

router.use('/', configRoutes);
router.use('/', patientDataRoutes);
router.use('/account', accountRoutes);
router.use('/family', familyRoutes);
router.use('/labs', labRoutes);
router.use('/medications', medicationRoutes);
router.use('/growth-records', growthRoutes);
router.use('/visit-notes', visitNoteRoutes);
router.use('/daily-logs', dailyLogRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/questions', questionRoutes);
router.use('/', overviewRoutes);

// 患者LIFF＋スタッフ混在: patientRoutes内で公開/認証を分離
router.use('/patients', patientRoutes);

// 患者LIFF用（recordings/encounters）: LIFFセッション前提のため認証なし
router.use('/', recordingRoutes);

router.get('/test', (req, res) => {
    res.json({ message: 'API is working' });
});

module.exports = router;
