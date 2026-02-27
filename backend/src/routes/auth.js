const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'change-me-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

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

      // Admin: email in ALLOWED_ADMIN_EMAILS → admin JWT, redirect to admin callback
      if (allowed.length > 0 && allowed.includes(emailLower)) {
        const token = jwt.sign(
          { email: emailLower, sub: id },
          JWT_SECRET,
          { expiresIn: JWT_EXPIRY }
        );
        return res.redirect(`${FRONTEND_URL}/admin/auth/callback?token=${encodeURIComponent(token)}`);
      }

      // User: create/find User, issue user JWT, redirect to login callback (no admin access)
      let user = await User.findOne({ googleId: id });
      if (!user) {
        user = await User.create({ googleId: id, email: emailLower, name: name || '' });
      } else if (name && user.name !== name) {
        user.name = name;
        await user.save();
      }
      const token = jwt.sign(
        { sub: user._id.toString(), role: 'user' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      res.redirect(`${FRONTEND_URL}/login/callback?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error('Google auth callback error:', err);
      res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
);

module.exports = router;
