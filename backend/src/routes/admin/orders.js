const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const adminOrderController = require('../../controllers/adminOrderController');

router.use(adminAuth);

router.get('/', adminOrderController.list);
router.get('/:id', adminOrderController.getOne);
router.patch('/:id', adminOrderController.updateStatus);
router.patch('/:id/deliver', adminOrderController.markDelivered);
router.post('/:id/refund', adminOrderController.refundOrder);

module.exports = router;
