const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const multerConfig = require('../../config/multer');
const uploadController = require('../../controllers/uploadController');

router.use(adminAuth);

router.post('/single', multerConfig.uploadSingle, uploadController.uploadSingle);
router.post('/multiple', multerConfig.uploadMultiple, uploadController.uploadMultiple);

module.exports = router;
