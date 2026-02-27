require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const connectDB = require('./config/db');
require('./config/passport');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
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

// Auth (Google OAuth can be added later)
app.use('/api/auth', require('./routes/auth'));

// Public API (no auth)
app.use('/api/products', require('./routes/products'));
app.use('/api/site', require('./routes/site'));

// Admin API (requires x-admin-key header)
app.use('/api/admin/products', require('./routes/admin/products'));
app.use('/api/admin/hero', require('./routes/admin/hero'));
app.use('/api/admin/video', require('./routes/admin/video'));
app.use('/api/admin/instagram', require('./routes/admin/instagram'));
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
