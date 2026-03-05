const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

/**
 * Verify user JWT (role 'user' or 'admin'). Attach req.userId (user's _id from token).
 * Use for cart, orders, etc.
 */
function userAuth(req, res, next) {
  const fromCookie = req.cookies?.user_token;
  const authHeader = req.headers.authorization;
  const fromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const token = fromCookie || fromHeader;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Invalid session' });
    }
    req.userId = decoded.sub; // user _id
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

module.exports = userAuth;
