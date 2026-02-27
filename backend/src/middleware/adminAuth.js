const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'change-me-in-production';

function getAllowedEmails() {
  const list = process.env.ALLOWED_ADMIN_EMAILS;
  if (!list || !list.trim()) return [];
  return list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

const adminAuth = (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.adminKey;
  if (!key) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1) Static admin secret (backward compatible)
  if (process.env.ADMIN_SECRET && key === process.env.ADMIN_SECRET) {
    return next();
  }

  // 2) JWT from Google OAuth (admin flow only; reject customer user JWT)
  try {
    const decoded = jwt.verify(key, JWT_SECRET);
    if (decoded.role === 'user' || !decoded.email) {
      return res.status(403).json({ error: 'Not an admin session' });
    }
    const allowed = getAllowedEmails();
    const email = (decoded.email || '').toLowerCase();
    if (allowed.length > 0 && !allowed.includes(email)) {
      return res.status(403).json({ error: 'Not an allowed admin' });
    }
    return next();
  } catch {
    // not a valid JWT
  }

  return res.status(401).json({ error: 'Unauthorized' });
};

module.exports = adminAuth;
