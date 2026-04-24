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
const { ensureOneRupeeProduct } = require('./seeds/ensureOneRupeeProduct');
const { ensureProductSlugs } = require('./seeds/ensureProductSlugs');

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// Render (and similar) terminate TLS and set X-Forwarded-For. Required for express-rate-limit and accurate req.ip.
if (process.env.RENDER || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Middleware: CORS with credentials so frontend can send httpOnly cookies
const CORS_ORIGINS = (process.env.CORS_ORIGINS || FRONTEND_URL)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow non-browser clients (no Origin) and same-origin server-to-server calls.
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
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

// Shiprocket webhook (JSON)
const shiprocketWebhook = require('./controllers/shiprocketWebhookController').handleShiprocketWebhook;
app.post('/api/webhooks/shiprocket', shiprocketWebhook);
// Alias route: Shiprocket UI blocks URLs containing "shiprocket"
app.post('/api/webhooks/shipment', shiprocketWebhook);
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

// Auth
// Note: Do not apply a global limiter to all /api/auth routes, because the frontend
// calls /api/auth/me to verify sessions and can hit 429s (especially on iOS/Safari).
// Rate limiting is applied per-route inside the auth router for sensitive endpoints.
app.use('/api/auth', require('./routes/auth'));

// Public API (no auth)
app.use('/api/products', require('./routes/products'));
app.use('/api/site', require('./routes/site'));
app.use('/api/gold-rate', require('./routes/goldRate'));
const deliveryCheckController = require('./controllers/deliveryCheckController');
app.get('/api/delivery-check', deliveryCheckController.check);
const pincodeLookupController = require('./controllers/pincodeLookupController');
app.get('/api/pincode-lookup', pincodeLookupController.pincodeLimiter, pincodeLookupController.lookup);

// User API (requires user auth)
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/returns', require('./routes/returns'));

// Admin API (cookie admin_token or x-admin-key header)
const adminAuth = require('./middleware/adminAuth');
app.get('/api/admin/me', adminAuth, (req, res) => res.json({ ok: true }));
app.use('/api/admin/products', require('./routes/admin/products'));
app.use('/api/admin/orders', require('./routes/admin/orders'));
app.use('/api/admin/returns', require('./routes/admin/returns'));
app.use('/api/admin/hero', require('./routes/admin/hero'));
app.use('/api/admin/category-cards', require('./routes/admin/categoryCards'));
app.use('/api/admin/video', require('./routes/admin/video'));
app.use('/api/admin/beauty-in-motion', require('./routes/admin/beautyInMotion'));
app.use('/api/admin/view-by-categories', require('./routes/admin/viewByCategories'));
app.use('/api/admin/best-selling', require('./routes/admin/bestSelling'));
app.use('/api/admin/shop-by-style', require('./routes/admin/shopByStyle'));
app.use('/api/admin/everyday-gifts', require('./routes/admin/everydayGifts'));
app.use('/api/admin/home-page-image', require('./routes/admin/homePageImage'));
app.use('/api/admin/promo-cards', require('./routes/admin/promoCards'));
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
  try {
    const Product = require('./models/Product');
    await Product.syncIndexes();
  } catch (err) {
    console.warn('[db] Product.syncIndexes:', err?.message || err);
    console.warn('[db] If slug index conflicts, drop legacy index in MongoDB: db.products.dropIndex("slug_1")');
  }
  try {
    await ensureProductSlugs();
  } catch (err) {
    console.error('Failed to ensure product slugs:', err?.message || err);
  }
  try {
    await ensureOneRupeeProduct();
  } catch (err) {
    console.error('Failed to ensure ₹1 product:', err?.message || err);
  }

  const { expireStalePendingPayments } = require('./controllers/orderController');
  const paymentExpireIntervalMs = 5 * 60 * 1000;
  const runExpireStalePayments = () => {
    expireStalePendingPayments().catch((e) => console.error('expireStalePendingPayments:', e?.message || e));
  };
  runExpireStalePayments();
  setInterval(runExpireStalePayments, paymentExpireIntervalMs);

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
