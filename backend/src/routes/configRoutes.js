const express = require('express');
const { listTemplates, getTemplate, getMedicationMaster } = require('../lib/templates');

const router = express.Router();

const DEMO_MODE = process.env.DEMO_MODE === '1' || !process.env.GOOGLE_CLOUD_PROJECT;

router.get('/templates', (_req, res) => {
    res.json(listTemplates());
});

router.get('/config', (req, res) => {
    const diseaseId = req.query.disease || 'general';
    const tmpl = getTemplate(diseaseId);
    if (!tmpl) return res.status(404).json({ error: `Template '${diseaseId}' not found` });

    res.json({
        ...tmpl,
        liff_id: process.env.LIFF_ID || '',
        isDemoMode: DEMO_MODE,
    });
});

router.get('/master/medications', (req, res) => {
    const diseaseId = req.query.disease || 'general';
    const master = getMedicationMaster(diseaseId);
    if (!master) return res.status(404).json({ error: `Medication master for '${diseaseId}' not found` });
    res.json(master);
});

module.exports = router;

