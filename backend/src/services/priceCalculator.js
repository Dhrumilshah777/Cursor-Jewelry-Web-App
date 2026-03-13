const Product = require('../models/Product');
const GoldRate = require('../models/GoldRate');

const GST_RATE = 0.03; // 3%

/**
 * Price formula: Gold Value + Making Charge (incl. CZ stones) = Subtotal; GST 3% on Subtotal; Final = Subtotal + GST.
 * No wastage. Making charge = % of gold value OR fixed amount.
 * @param {Object} product - Product doc (plain or mongoose)
 * @param {Map<string, number>} [goldRatesMap] - Optional map of purity -> pricePerGram
 * @returns {Promise<{ price: number, breakup: object | null }>}
 */
async function getProductPrice(product, goldRatesMap = null) {
  const p = product.toObject ? product.toObject() : product;
  const purity = (p.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const netWeight = parseFloat(p.netWeight);
  const hasGold = purity && (purity === '14K' || purity === '18K' || purity === '22K' || purity === '24K') && Number.isFinite(netWeight) && netWeight > 0;

  if (!hasGold) {
    return { price: 0, breakup: null };
  }

  let rates = goldRatesMap;
  if (!rates || typeof rates.get !== 'function') {
    const docs = await GoldRate.find().lean();
    rates = new Map(docs.map((r) => [String(r.purity).toUpperCase().replace(/\s/g, ''), r.pricePerGram]));
  }
  const pricePerGram = rates.get(purity);
  if (pricePerGram == null || !Number.isFinite(pricePerGram)) {
    return { price: 0, breakup: null };
  }

  const makingType = p.makingChargeType === 'fixed' ? 'fixed' : 'percentage';
  const makingValue = parseFloat(p.makingChargeValue) || 0;

  const goldValue = netWeight * pricePerGram;
  const makingCharge = makingType === 'percentage' ? goldValue * (makingValue / 100) : makingValue;
  const subtotal = goldValue + makingCharge;
  const gst = subtotal * GST_RATE;
  const totalPrice = subtotal + gst;

  return {
    price: Math.round(totalPrice * 100) / 100,
    breakup: {
      goldValue: Math.round(goldValue * 100) / 100,
      makingCharge: Math.round(makingCharge * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      totalPrice: Math.round(totalPrice * 100) / 100,
      goldPurity: purity,
      netWeight,
      pricePerGram,
    },
  };
}

/**
 * Get price for a product by id (loads product and gold rates).
 */
async function getProductPriceById(productId) {
  const product = await Product.findById(productId);
  if (!product) return null;
  return getProductPrice(product);
}

/**
 * Resolve price string for cart/order (backend only). Uses gold calculation when applicable.
 */
async function getPriceStringForProduct(product) {
  const { price } = await getProductPrice(product);
  return String(price);
}

module.exports = { getProductPrice, getProductPriceById, getPriceStringForProduct, GST_RATE };
