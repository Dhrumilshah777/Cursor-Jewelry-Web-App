const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: String, required: true },
    image: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [cartItemSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.models.Cart || mongoose.model('Cart', cartSchema);
