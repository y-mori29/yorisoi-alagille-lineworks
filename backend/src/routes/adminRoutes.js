const express = require('express');
const router = express.Router();
const controller = require('../controllers/adminController');
const { verifyToken } = require('../middleware/auth');

// Protect all admin routes with verifyToken
// In a real app, we would also check for 'admin' custom claim or specific email.
// For MVP, any authenticated user can access (or restricted by frontend mostly).
router.use(verifyToken);

router.get('/users', controller.listUsers);
router.post('/users', controller.createUser);
router.delete('/users/:uid', controller.deleteUser);

module.exports = router;
