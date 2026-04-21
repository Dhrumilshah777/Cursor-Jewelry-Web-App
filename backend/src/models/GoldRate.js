const mongoose = require('mongoose');

const goldRateSchema = new mongoose.Schema(
  {
    purity: { type: String, required: true, unique: true }, // '14K', '18K', '22K', '24K'
    pricePerGram: { type: Number, required: true },
    /** Price per gram in paise (rounded). Prefer this for calculations. */
    pricePerGramPaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.GoldRate || mongoose.model('GoldRate', goldRateSchema);
