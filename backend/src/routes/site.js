const express = require('express');
const router = express.Router();
const siteConfigController = require('../controllers/siteConfigController');

router.get('/hero', siteConfigController.getHero);
router.get('/video', siteConfigController.getVideo);
router.get('/beauty-in-motion', siteConfigController.getBeautyInMotionVideos);
router.get('/instagram', siteConfigController.getInstagram);

module.exports = router;
