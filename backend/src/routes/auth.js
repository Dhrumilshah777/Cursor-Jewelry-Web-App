const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const User = require('../models/User');
const { normalizeIndianPhoneToE164, sendSmsOtp, verifySmsOtp } = require('../services/twilioVerify');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const isProduction = process.env.NODE_ENV === 'production';

const oauthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

function isLikelyHttpsUrl(url) {
  return typeof url === 'string' && url.toLowerCase().startsWith('https://');
}

function isLocalhostUrl(url) {
  if (typeof url !== 'string') return false;
  const u = url.toLowerCase();
  return u.includes('localhost') || u.includes('127.0.0.1');
}

function cookieOptions(token, name) {
  const maxAge = 7 * 24 * 60 * 60; // 7 days in seconds
  // iOS/Safari is strict about cross-site cookies. If frontend is on HTTPS and not localhost,
  // we must use SameSite=None; Secure or the auth cookie can be dropped.
  const crossSite = isProduction || (isLikelyHttpsUrl(FRONTEND_URL) && !isLocalhostUrl(FRONTEND_URL));
  const opts = {
    httpOnly: true,
    maxAge: maxAge * 1000,
    path: '/',
    sameSite: crossSite ? 'none' : 'lax',
  };
  if (crossSite) opts.secure = true;
  return opts;
}

function getAllowedEmails() {
  const list = process.env.ALLOWED_ADMIN_EMAILS;
  if (!list || !list.trim()) return [];
  return list.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function issueUserJwtCookie(res, user) {
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role || 'user' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
  res.cookie('user_token', token, cookieOptions(token, 'user_token'));
  return token;
}

/** Google profile from passport-google-oauth20 verify: { id, email, name } */
async function finalizeGoogleOAuth(res, profile) {
  try {
    const { id, email, name } = profile || {};
    if (!id || !email) {
      console.warn('[auth] finalizeGoogleOAuth: missing id or email on profile');
      return res.redirect(`${FRONTEND_URL}/login?error=no_email`);
    }
    const emailLower = email.toLowerCase();
    const allowed = getAllowedEmails();
    const isAdminEmail = allowed.length > 0 && allowed.includes(emailLower);

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

    if (user.role === 'admin') {
      const token = jwt.sign(
        { sub: user._id.toString(), role: 'admin', email: emailLower },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
      );
      res.cookie('admin_token', token, cookieOptions(token, 'admin_token'));
      const enc = encodeURIComponent(token);
      return res.redirect(`${FRONTEND_URL}/admin/auth/callback?token=${enc}#token=${enc}`);
    }

    const token = issueUserJwtCookie(res, user);
    const enc = encodeURIComponent(token);
    return res.redirect(`${FRONTEND_URL}/login/callback?token=${enc}#token=${enc}`);
  } catch (err) {
    console.error('Google auth callback error:', err);
    if (!res.headersSent) {
      return res.redirect(`${FRONTEND_URL}/login?error=server_error`);
    }
  }
}

// ----- Single Google OAuth: /login and /admin/login both use this -----
router.get('/google', oauthLimiter, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('[auth] GET /google: GOOGLE_CLIENT_ID/SECRET not set; redirecting to login');
    return res.redirect(`${FRONTEND_URL}/login?error=google_not_configured`);
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
    // Always show Google’s account chooser (otherwise a single signed-in session is used silently).
    prompt: 'select_account',
  })(req, res, next);
});

router.get('/google/callback', oauthLimiter, (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, profile /* , info */) => {
    if (err) {
      console.error('Google OAuth error:', err?.message || err, err?.code || '');
      return res.redirect(`${FRONTEND_URL}/login?error=google_oauth_failed`);
    }
    if (!profile) {
      console.warn('[auth] GET /google/callback: no profile (user cancelled or Google returned no profile)');
      return res.redirect(`${FRONTEND_URL}/login?error=google_denied`);
    }
    finalizeGoogleOAuth(res, profile).catch((e) => {
      console.error('Google auth finalize error:', e);
      if (!res.headersSent) {
        res.redirect(`${FRONTEND_URL}/login?error=server_error`);
      }
    });
  })(req, res, next);
});

// ----- SMS OTP (Twilio Verify) — routes kept as /whatsapp/ for compatibility -----
router.post('/whatsapp/request-otp', otpLimiter, async (req, res) => {
  try {
    const phone = req.body?.phone;
    const toE164 = normalizeIndianPhoneToE164(phone);
    if (!toE164) return res.status(400).json({ error: 'Enter a valid Indian phone number' });

    await sendSmsOtp({ toE164 });
    return res.json({ ok: true, to: toE164 });
  } catch (err) {
    const twilioDetail =
      err && typeof err === 'object'
        ? { message: err.message, code: err.code, status: err.status, moreInfo: err.moreInfo }
        : err;
    console.error('SMS OTP request error:', twilioDetail);
    if (err && err.code === 'TWILIO_NOT_CONFIGURED') return res.status(500).json({ error: 'SMS OTP is not configured' });
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

router.post('/whatsapp/verify-otp', otpLimiter, async (req, res) => {
  try {
    const phone = req.body?.phone;
    const codeRaw = req.body?.code;
    const toE164 = normalizeIndianPhoneToE164(phone);
    if (!toE164) return res.status(400).json({ error: 'Enter a valid Indian phone number' });
    if (codeRaw === undefined || codeRaw === null) return res.status(400).json({ error: 'Enter the OTP' });
    if (typeof codeRaw !== 'string' && typeof codeRaw !== 'number') {
      return res.status(400).json({ error: 'Enter the OTP' });
    }
    const codeStr = String(codeRaw).trim().replace(/\s+/g, '');
    if (!codeStr) return res.status(400).json({ error: 'Enter the OTP' });

    const check = await verifySmsOtp({ toE164, code: codeStr });
    if (!check || check.status !== 'approved') {
      const tail = toE164.length > 4 ? toE164.slice(-4) : '****';
      console.warn('[auth] POST /whatsapp/verify-otp: not approved', {
        phoneTail: tail,
        verifyStatus: check?.status || 'no_result',
      });
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Find or create a user for this phone number (handle race: two verifies → duplicate key)
    let user = await User.findOne({ phoneE164: toE164 });
    if (!user) {
      try {
        user = await User.create({ phoneE164: toE164, role: 'user', name: '' });
      } catch (createErr) {
        if (createErr && createErr.code === 11000) {
          user = await User.findOne({ phoneE164: toE164 });
        } else {
          throw createErr;
        }
      }
    }
    if (!user) return res.status(500).json({ error: 'Could not create account' });

    const token = issueUserJwtCookie(res, user);
    return res.json({ ok: true, token });
  } catch (err) {
    const detail =
      err && typeof err === 'object'
        ? { message: err.message, code: err.code, status: err.status, moreInfo: err.moreInfo }
        : err;
    console.error('SMS OTP verify error:', detail);
    if (err && err.code === 'TWILIO_NOT_CONFIGURED') return res.status(500).json({ error: 'SMS OTP is not configured' });
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// Fallback: set cookie from token (when redirect cookie is blocked cross-origin). Token in Authorization header.
router.post('/set-cookie', (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) {
    console.warn('[auth] POST /set-cookie: missing Authorization bearer', { ip: req.ip });
    return res.status(400).json({ error: 'Missing token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user' && decoded.role !== 'admin') {
      console.warn('[auth] POST /set-cookie: invalid role', { role: decoded.role, ip: req.ip });
      return res.status(403).json({ error: 'Invalid token' });
    }
    res.cookie('user_token', token, cookieOptions(token, 'user_token'));
    return res.json({ ok: true });
  } catch (err) {
    console.warn('[auth] POST /set-cookie: JWT verify failed', err?.message || err, { ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
});
router.post('/set-admin-cookie', (req, res) => {
  const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
  if (!token) {
    console.warn('[auth] POST /set-admin-cookie: missing Authorization bearer', { ip: req.ip });
    return res.status(400).json({ error: 'Missing token' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      console.warn('[auth] POST /set-admin-cookie: not admin role', { role: decoded.role, ip: req.ip });
      return res.status(403).json({ error: 'Admin only' });
    }
    res.cookie('admin_token', token, cookieOptions(token, 'admin_token'));
    return res.json({ ok: true });
  } catch (err) {
    console.warn('[auth] POST /set-admin-cookie: JWT verify failed', err?.message || err, { ip: req.ip });
    return res.status(401).json({ error: 'Invalid token' });
  }
});

// Cookie-based auth: /me and /logout
router.get('/me', async (req, res) => {
  const token = req.cookies?.user_token || (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'user' && decoded.role !== 'admin') {
      console.warn('[auth] GET /me: invalid role in token', { role: decoded.role, ip: req.ip });
      return res.status(403).json({ error: 'Invalid session' });
    }
    const user = await User.findById(decoded.sub).select('name email phoneE164').lean();
    if (!user) {
      console.warn('[auth] GET /me: no user for token sub', { sub: decoded.sub, ip: req.ip });
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({
      user: { _id: user._id, name: user.name, email: user.email, phoneE164: user.phoneE164 || null },
    });
  } catch (err) {
    console.warn('[auth] GET /me: JWT verify failed', err?.message || err, { ip: req.ip });
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
