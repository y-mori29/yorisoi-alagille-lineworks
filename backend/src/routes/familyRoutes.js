const express = require('express');
const controller = require('../controllers/familyController');
const { verifyAccountSession } = require('../middleware/accountAuth');

const router = express.Router();
router.use(verifyAccountSession);

router.get('/current', controller.getCurrentFamily);
router.get('/members', controller.listFamilyMembers);
router.get('/patients', controller.listFamilyPatients);
router.post('/patients', controller.createFamilyPatient);
router.patch('/patients/:patientId', controller.updateFamilyPatient);
router.post('/invitations', controller.createFamilyInvitation);
router.get('/invitations', controller.listFamilyInvitations);
router.delete('/invitations/:token', controller.revokeFamilyInvitation);
router.post('/invitations/:token/accept', controller.acceptFamilyInvitation);

module.exports = router;
