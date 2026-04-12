const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB connected: ${conn.connection.host}`);

    const User = require('../models/User');
    try {
      await User.syncIndexes();
      console.log('User indexes synced (partial unique on googleId / phoneE164)');
    } catch (syncErr) {
      console.error('User.syncIndexes failed (fix indexes in MongoDB if login still errors):', syncErr.message);
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
