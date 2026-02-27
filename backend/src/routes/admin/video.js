const express = require('express');
const router = express.Router();
const siteConfigController = require('../../controllers/siteConfigController');
const adminAuth = require('../../middleware/adminAuth');

router.use(adminAuth);

router.get('/', siteConfigController.getVideo);
router.put('/', siteConfigController.updateVideo);

module.exports = router;
