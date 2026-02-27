const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');

const getPublicUrl = (filename) => `/uploads/${filename}`;

exports.uploadSingle = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ url: getPublicUrl(req.file.filename), filename: req.file.filename });
};

exports.uploadMultiple = (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const urls = req.files.map((f) => getPublicUrl(f.filename));
  res.json({ urls, filenames: req.files.map((f) => f.filename) });
};
