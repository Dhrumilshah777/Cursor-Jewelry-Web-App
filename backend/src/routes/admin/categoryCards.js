const express = require('express');
const router = express.Router();
const siteConfigController = require('../../controllers/siteConfigController');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

router.get('/', siteConfigController.getCategoryCards);
router.put('/', siteConfigController.updateCategoryCards);

module.exports = router;
