const express = require('express');
const router = express.Router();
const adminAuth = require('../../middleware/adminAuth');
const multerConfig = require('../../config/multer');
const uploadController = require('../../controllers/uploadController');

router.use(adminAuth);

router.post('/single', multerConfig.uploadSingle, uploadController.uploadSingle);

router.post('/multiple', multerConfig.uploadMultiple, uploadController.uploadMultiple);

// Multer and upload errors (e.g. no file, multer limit)
router.use((err, req, res, next) => {
  if (!err) return next();
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large' });
  }
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: err.message || 'Upload error' });
  }
  console.error('Upload error:', err);
  res.status(err.status || 500).json({ error: err.message || err.error || 'Upload failed' });
});

module.exports = router;
