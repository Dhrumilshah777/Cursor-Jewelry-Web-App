const express = require('express');
const router = express.Router();
const productController = require('../../controllers/productController');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

router.get('/', productController.list);
router.post('/', productController.create);
router.put('/:id', productController.update);
router.delete('/:id', productController.remove);

module.exports = router;
