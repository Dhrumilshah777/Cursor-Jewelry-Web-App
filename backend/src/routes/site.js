const express = require('express');
const router = express.Router();
const siteConfigController = require('../controllers/siteConfigController');

router.get('/hero', siteConfigController.getHero);
router.get('/video', siteConfigController.getVideo);
router.get('/beauty-in-motion', siteConfigController.getBeautyInMotionVideos);
router.get('/view-by-categories', siteConfigController.getViewByCategories);
router.get('/category-cards', siteConfigController.getCategoryCards);
router.get('/instagram', siteConfigController.getInstagram);
router.get('/best-selling', siteConfigController.getBestSelling);
router.get('/shop-by-style', siteConfigController.getShopByStyle);
router.get('/home-page-image', siteConfigController.getHomePageImage);
router.get('/promo-cards', siteConfigController.getPromoCards);

module.exports = router;
