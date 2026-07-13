const express = require('express');
const controller = require('../controllers/questionController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);
router.get('/', controller.listQuestions);
router.post('/', controller.createQuestion);
router.patch('/:id', controller.updateQuestion);
router.delete('/:id', controller.deleteQuestion);

module.exports = router;
