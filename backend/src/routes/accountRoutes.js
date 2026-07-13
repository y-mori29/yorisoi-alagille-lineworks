const express = require('express');
const controller = require('../controllers/accountController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();

router.post('/session', controller.createSession);
router.delete('/session', controller.deleteSession);
router.get('/me', verifyAccountSession, controller.getMe);
router.post('/bootstrap', verifyAccountSession, controller.bootstrapAccount);

module.exports = router;
