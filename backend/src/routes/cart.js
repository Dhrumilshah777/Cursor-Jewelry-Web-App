const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const cartController = require('../controllers/cartController');

router.use(userAuth);

router.get('/', cartController.get);
router.get('/validated', cartController.getValidated);
router.put('/', cartController.set);
router.post('/merge', cartController.merge);
router.post('/items', cartController.addItem);

module.exports = router;
