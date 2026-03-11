const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const siteConfigController = require('../../controllers/siteConfigController');

router.use(adminAuth);

router.get('/', siteConfigController.getShopByStyle);
router.put('/', siteConfigController.updateShopByStyle);

module.exports = router;
