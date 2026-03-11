const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const siteConfigController = require('../../controllers/siteConfigController');

router.use(adminAuth);

router.get('/', siteConfigController.getBestSellingIds);
router.put('/', siteConfigController.updateBestSelling);

module.exports = router;
