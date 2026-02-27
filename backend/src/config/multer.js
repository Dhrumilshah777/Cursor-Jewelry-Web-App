const path = require('path');
const multer = require('multer');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (file.originalname && path.extname(file.originalname)) || '.bin';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({ storage });
exports.uploadSingle = upload.single('file');
exports.uploadMultiple = upload.array('files', 20);
