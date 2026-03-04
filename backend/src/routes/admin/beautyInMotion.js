const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const siteConfigController = require('../../controllers/siteConfigController');

router.use(adminAuth);

router.get('/', siteConfigController.getBeautyInMotionVideos);
router.put('/', siteConfigController.updateBeautyInMotionVideos);

module.exports = router;
