require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const passport = require('passport');
const connectDB = require('./config/db');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Middleware: CORS with credentials so frontend can send httpOnly cookies
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
}));
app.use(cookieParser());

// Webhook must receive raw body for signature verification (mount before express.json)
const razorpayWebhook = require('./controllers/razorpayWebhookController').handleRazorpayWebhook;
app.post('/api/webhooks/razorpay', express.raw({ type: 'application/json' }), (req, res) => {
  razorpayWebhook(req, res).catch((err) => {
    console.error('Webhook handler error:', err);
    res.status(500).send('Error');
  });
});

app.use(express.json({ strict: true }));
app.use((err, req, res, next) => {
  if (err && err.status === 400 && err.type === 'entity.parse.failed') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(400).json({ error: 'Invalid request body' });
  }
  next(err);
});
app.use(passport.initialize());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Root (so visiting the backend URL shows something friendly)
app.get('/', (req, res) => {
  res.json({ message: 'Jewelry API', health: '/api/health' });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Jewelry API is running' });
});

// Rate limits
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50, message: { error: 'Too many requests' } });

// Auth (Google OAuth can be added later)
app.use('/api/auth', authLimiter, require('./routes/auth'));

// Public API (no auth)
app.use('/api/products', require('./routes/products'));
app.use('/api/site', require('./routes/site'));

// User API (requires user auth)
app.use('/api/cart', require('./routes/cart'));
app.use('/api/orders', require('./routes/orders'));

// Admin API (cookie admin_token or x-admin-key header)
const adminAuth = require('./middleware/adminAuth');
app.get('/api/admin/me', adminAuth, (req, res) => res.json({ ok: true }));
app.use('/api/admin/products', require('./routes/admin/products'));
app.use('/api/admin/orders', require('./routes/admin/orders'));
app.use('/api/admin/hero', require('./routes/admin/hero'));
app.use('/api/admin/video', require('./routes/admin/video'));
app.use('/api/admin/beauty-in-motion', require('./routes/admin/beautyInMotion'));
app.use('/api/admin/view-by-categories', require('./routes/admin/viewByCategories'));
app.use('/api/admin/instagram', require('./routes/admin/instagram'));
app.use('/api/admin/gold-rates', require('./routes/admin/goldRates'));
app.use('/api/admin/upload', require('./routes/admin/upload'));

// Connect to MongoDB, then start server
async function start() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing MONGODB_URI in .env. Add it to connect to MongoDB.');
    process.exit(1);
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
