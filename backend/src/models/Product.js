const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, default: 'Accessories' },
    /** Yellow Gold / Rose Gold / White Gold (admin “gold type” select) */
    goldType: { type: String, default: '' },
    /**
     * Legacy fixed price in INR as string (kept for backward compatibility with older data / UI).
     * Prefer using fixedPricePaise for all calculations.
     */
    price: { type: String, default: '' },
    /** Fixed price in paise (e.g. ₹138.45 => 13845). 0/undefined means "use gold-based pricing". */
    fixedPricePaise: { type: Number, default: 0 },
    image: { type: String, required: true },
    subImages: [{ type: String }],
    weight: { type: String, default: '' },
    carat: { type: String, default: '' },
    colors: [{ type: String }],
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    stock: { type: Number, default: 1 },
    /** Quantity to add per "Add to cart" (customer cannot change). */
    purchaseQuantity: { type: Number, default: 1 },
    // Gold-based pricing (when set, final price is calculated from GoldRate)
    goldPurity: { type: String, default: '' }, // '14K', '18K', '22K', '24K'
    netWeight: { type: Number, default: null }, // grams
    makingChargeType: { type: String, default: 'percentage' }, // 'percentage' | 'fixed' (incl. CZ/American diamond cost)
    makingChargeValue: { type: Number, default: 0 },
    /** GST percent (defaults to 3 for jewelry). Snapshot to Order at purchase time. */
    gstPercent: { type: Number, default: 3 },
    description: { type: String, default: '' },
    ringSize: { type: String, default: '' },
    sku: { type: String, required: true, unique: true },
    // Optional homepage placement tags (e.g. latestBeauty, bestSelling)
    homeSections: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
