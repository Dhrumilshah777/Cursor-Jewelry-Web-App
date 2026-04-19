const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const adminOrderController = require('../../controllers/adminOrderController');

router.use(adminAuth);

router.get('/', adminOrderController.list);
router.get('/:id', adminOrderController.getOne);
router.post('/:id/retry-pickup', adminOrderController.retryForwardPickup);
router.patch('/:id/deliver', adminOrderController.markDelivered);
router.patch('/:id', adminOrderController.updateStatus);
router.post('/:id/refund', adminOrderController.refundOrder);

module.exports = router;
