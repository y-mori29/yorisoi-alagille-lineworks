const express = require('express');
const router = express.Router();
const controller = require('../controllers/facilityController');

router.post('/', controller.createFacility);
router.get('/', controller.listFacilities);
router.get('/:id/debug', controller.getFacilityById); // Debug endpoint
router.post('/reorder', controller.reorderFacilities);
router.delete('/:facilityId', controller.deleteFacility);
router.post('/:facilityId/rooms:bulkUpsert', controller.bulkUpsertRooms);
router.get('/:facilityId/board', controller.getBoard);
router.post('/:facilityId/stays', controller.createStay);
router.post('/:facilityId/stays/:stayId:pause', controller.pauseStay);
router.post('/:facilityId/stays/:stayId:resume', controller.resumeStay);
router.post('/:facilityId/occupancies:move', controller.moveOccupancy);

module.exports = router;
