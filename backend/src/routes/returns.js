const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const returnController = require('../controllers/returnController');

router.use(userAuth);

router.get('/', returnController.myReturns);
router.get('/order/:orderId', returnController.getForOrder);
router.post('/', returnController.create);

module.exports = router;

