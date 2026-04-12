const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    // Either Google OAuth or phone-based login can create a user.
    // Do not use unique:true on optional fields: MongoDB still indexes explicit null and only one null is allowed.
    // Partial unique indexes below apply only when the value is a string.
    googleId: { type: String },
    email: { type: String },
    phoneE164: { type: String },
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

userSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);
userSchema.index(
  { phoneE164: 1 },
  { unique: true, partialFilterExpression: { phoneE164: { $type: 'string' } } }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
