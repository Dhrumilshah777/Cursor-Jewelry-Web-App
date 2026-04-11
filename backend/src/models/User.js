const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Either Google OAuth or phone-based login can create a user.
    // Use sparse unique indexes so multiple docs can have null for these fields.
    googleId: { type: String, unique: true, sparse: true },
    email: { type: String },
    phoneE164: { type: String, unique: true, sparse: true },
    name: { type: String, default: '' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    wishlist: [
      {
        productId: { type: String, required: true },
        name: { type: String, required: true },
        category: { type: String, default: '' },
        price: { type: String, required: true },
        image: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
