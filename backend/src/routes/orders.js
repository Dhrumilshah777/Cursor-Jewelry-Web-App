const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const orderController = require('../controllers/orderController');

router.use(userAuth);

router.post('/', orderController.create);
router.post('/verify-payment', orderController.verifyPayment);
router.get('/', orderController.myOrders);
router.get('/:id', orderController.getOne);

module.exports = router;
