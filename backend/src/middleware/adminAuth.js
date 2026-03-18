const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const adminAuth = (req, res, next) => {
  const token = req.cookies?.admin_token || req.headers['x-admin-key'] || req.query.adminKey;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access only' });
    }
    req.admin = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

module.exports = adminAuth;
