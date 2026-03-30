const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const orderController = require('../controllers/orderController');

const orderCreateLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many orders, try again in a minute' } });

router.use(userAuth);

router.post('/', orderCreateLimiter, orderController.create);
router.post('/verify-payment', orderController.verifyPayment);
router.post('/:id/cancel-payment', orderController.cancelPayment);
router.get('/', orderController.myOrders);
router.get('/:id', orderController.getOne);

module.exports = router;
