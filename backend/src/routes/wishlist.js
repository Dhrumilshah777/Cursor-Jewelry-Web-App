const express = require('express');
const router = express.Router();
const userAuth = require('../middleware/userAuth');
const wishlistController = require('../controllers/wishlistController');

router.use(userAuth);

router.get('/', wishlistController.get);
router.put('/', wishlistController.put);
router.post('/merge', wishlistController.merge);
router.post('/items', wishlistController.addItem);
router.delete('/items/:productId', wishlistController.removeItem);

module.exports = router;
