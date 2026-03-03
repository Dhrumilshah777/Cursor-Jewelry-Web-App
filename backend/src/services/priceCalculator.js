const Product = require('../models/Product');
const GoldRate = require('../models/GoldRate');

const GST_RATE = 0.03; // 3%

/**
 * Get effective price for a product (calculated from gold or fixed).
 * @param {Object} product - Product doc (plain or mongoose)
 * @param {Map<string, number>} [goldRatesMap] - Optional map of purity -> pricePerGram (e.g. { '22K': 6100 })
 * @returns {Promise<{ price: number, breakup: object | null }>}
 */
async function getProductPrice(product, goldRatesMap = null) {
  const p = product.toObject ? product.toObject() : product;
  const purity = (p.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const netWeight = parseFloat(p.netWeight);
  const hasGold = purity && (purity === '18K' || purity === '22K' || purity === '24K') && Number.isFinite(netWeight) && netWeight > 0;

  if (!hasGold) {
    const fixed = parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0;
    return { price: fixed, breakup: null };
  }

  let rates = goldRatesMap;
  if (!rates || typeof rates.get !== 'function') {
    const docs = await GoldRate.find().lean();
    rates = new Map(docs.map((r) => [String(r.purity).toUpperCase().replace(/\s/g, ''), r.pricePerGram]));
  }
  const pricePerGram = rates.get(purity);
  if (pricePerGram == null || !Number.isFinite(pricePerGram)) {
    const fixed = parseFloat(String(p.price).replace(/[^0-9.]/g, '')) || 0;
    return { price: fixed, breakup: null };
  }

  const makingType = p.makingChargeType === 'fixed' ? 'fixed' : 'percentage';
  const makingValue = parseFloat(p.makingChargeValue) || 0;
  const wastagePercent = parseFloat(p.wastagePercent) || 0;

  const baseGold = netWeight * pricePerGram;
  const wastage = baseGold * (wastagePercent / 100);
  const makingCharges = makingType === 'percentage' ? baseGold * (makingValue / 100) : makingValue;
  const subtotal = baseGold + wastage + makingCharges;
  const gst = subtotal * GST_RATE;
  const total = subtotal + gst;

  return {
    price: Math.round(total * 100) / 100,
    breakup: {
      baseGold: Math.round(baseGold * 100) / 100,
      wastage: Math.round(wastage * 100) / 100,
      makingCharges: Math.round(makingCharges * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: Math.round(total * 100) / 100,
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
