const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'Accessories' },
    price: { type: String, required: true },
    image: { type: String, required: true },
    subImages: [{ type: String }],
    weight: { type: String, default: '' },
    carat: { type: String, default: '' },
    colors: [{ type: String }],
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
