const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const siteConfigController = require('../../controllers/siteConfigController');

router.use(adminAuth);

router.get('/', siteConfigController.getViewByCategories);
router.put('/', siteConfigController.updateViewByCategories);

module.exports = router;
