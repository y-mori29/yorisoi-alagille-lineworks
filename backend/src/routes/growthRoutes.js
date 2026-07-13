const express = require('express');
const controller = require('../controllers/growthController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);
router.get('/trends', controller.getGrowthTrends);
router.get('/', controller.listGrowthRecords);
router.post('/', controller.createGrowthRecord);
router.patch('/:id', controller.updateGrowthRecord);
router.delete('/:id', controller.deleteGrowthRecord);

module.exports = router;
