const express = require('express');
const controller = require('../controllers/appointmentController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);
router.get('/', controller.listAppointments);
router.post('/', controller.createAppointment);
router.patch('/:id', controller.updateAppointment);
router.delete('/:id', controller.deleteAppointment);

module.exports = router;
