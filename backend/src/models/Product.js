const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'Accessories' },
    price: { type: String, default: '' }, // fixed price; empty when using gold pricing
    image: { type: String, required: true },
    subImages: [{ type: String }],
    weight: { type: String, default: '' },
    carat: { type: String, default: '' },
    colors: [{ type: String }],
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: 1 },
    // Gold-based pricing (when set, final price is calculated from GoldRate)
    goldPurity: { type: String, default: '' }, // '18K', '22K', '24K'
    netWeight: { type: Number, default: null }, // grams
    makingChargeType: { type: String, default: 'percentage' }, // 'percentage' | 'fixed'
    makingChargeValue: { type: Number, default: 0 },
    wastagePercent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
