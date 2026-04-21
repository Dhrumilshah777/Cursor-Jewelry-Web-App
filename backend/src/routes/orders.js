const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const orderController = require('../controllers/orderController');

const orderCreateLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: 'Too many orders, try again in a minute' } });
const retryPaymentLimiter = rateLimit({ windowMs: 60 * 1000, max: 15, message: { error: 'Too many payment retries, try again shortly' } });

router.use(userAuth);

router.post('/', orderCreateLimiter, orderController.create);
router.post('/verify-payment', orderController.verifyPayment);
router.get('/payment-stock', orderController.checkPaymentStock);
router.post('/:id/retry-payment', retryPaymentLimiter, orderController.retryPayment);
router.post('/:id/cancel-payment', orderController.cancelPayment);
router.get('/', orderController.myOrders);
router.get('/:id', orderController.getOne);

module.exports = router;
