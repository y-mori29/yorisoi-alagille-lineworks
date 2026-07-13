const express = require('express');
const router = express.Router();
const controller = require('../controllers/knowledgeController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// ナレッジ一覧取得
router.get('/', controller.getKnowledgeList);

// ナレッジ登録 (Excel/Word等)
router.post('/upload', upload.single('file'), controller.uploadKnowledge);

// ナレッジ削除
router.delete('/:id', controller.deleteKnowledge);

module.exports = router;
