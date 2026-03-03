const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'change-me-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const isProduction = process.env.NODE_ENV === 'production';

function cookieOptions(token, name) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  const opts = {
    httpOnly: true,
    maxAge: maxAge * 1000,
    path: '/',
    sameSite: isProduction ? 'none' : 'lax',
  };
  if (isProduction) opts.secure = true;
  return opts;
}

function getAllowedEmails() {
  const list = process.env.ALLOWED_ADMIN_EMAILS;
  if (!list || !list.trim()) return [];
  return list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

// ----- Single Google OAuth: /login and /admin/login both use this -----
router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_denied` }),
  async (req, res) => {
    try {
      const { id, email, name } = req.user || {};
      if (!id || !email) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
      }
      const emailLower = email.toLowerCase();
      const allowed = getAllowedEmails();
      const isAdminEmail = allowed.length > 0 && allowed.includes(emailLower);

      // Find or create user and set/update role from ALLOWED_ADMIN_EMAILS
      let user = await User.findOne({ googleId: id });
      if (!user) {
        user = await User.create({
          googleId: id,
          email: emailLower,
          name: name || '',
          role: isAdminEmail ? 'admin' : 'user',
        });
      } else {
        user.role = isAdminEmail ? 'admin' : 'user';
        if (name && user.name !== name) user.name = name;
        await user.save();
      }

      // Admin: issue JWT, set httpOnly cookie, redirect to admin callback (no token in URL)
      if (user.role === 'admin') {
        const token = jwt.sign(
          { sub: user._id.toString(), role: 'admin', email: emailLower },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        res.cookie('admin_token', token, cookieOptions(token, 'admin_token'));
        return res.redirect(`${FRONTEND_URL}/admin/auth/callback`);
      }

      // User: issue JWT, set httpOnly cookie, redirect to login callback (no token in URL)
      const token = jwt.sign(
        { sub: user._id.toString(), role: 'user' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      res.cookie('user_token', token, cookieOptions(token, 'user_token'));
      res.redirect(`${FRONTEND_URL}/login/callback`);
    } catch (err) {
      console.error('Google auth callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

// Cookie-based auth: /me and /logout
router.get('/me', async (req, res) => {
  const token = req.cookies?.user_token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user' && decoded.role !== 'admin') return res.status(403).json({ error: 'Invalid session' });
    const user = await User.findById(decoded.sub).select('name email').lean();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    return res.json({ user: { _id: user._id, name: user.name, email: user.email } });
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
});

router.get('/logout', (req, res) => {
  res.cookie('user_token', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: isProduction ? 'none' : 'lax', secure: isProduction });
  res.json({ ok: true });
});

router.get('/admin-logout', (req, res) => {
  res.cookie('admin_token', '', { httpOnly: true, path: '/', maxAge: 0, sameSite: isProduction ? 'none' : 'lax', secure: isProduction });
  res.json({ ok: true });
});

module.exports = router;
