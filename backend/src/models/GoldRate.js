const mongoose = require('mongoose');

const goldRateSchema = new mongoose.Schema(
  {
    purity: { type: String, required: true, unique: true }, // '18K', '22K', '24K'
    pricePerGram: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.GoldRate || mongoose.model('GoldRate', goldRateSchema);
