const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const returnController = require('../../controllers/returnController');

router.use(adminAuth);

router.get('/', returnController.adminList);
router.post('/:id/retry-shipment', returnController.retryShipment);
router.get('/:id', returnController.adminGetOne);
router.patch('/:id', returnController.adminUpdateStatus);

module.exports = router;

