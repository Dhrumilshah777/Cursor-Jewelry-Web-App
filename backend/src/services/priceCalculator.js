const Product = require('../models/Product');
const GoldRate = require('../models/GoldRate');

const DEFAULT_GST_PERCENT = 3;

const GOLD_RATE_CACHE_TTL_MS = (() => {
  const v = parseInt(process.env.GOLD_RATE_CACHE_TTL_MS, 10);
  return Number.isFinite(v) && v > 0 ? v : 2 * 60 * 1000; // default 2 minutes
})();

let goldRatesCache = {
  /** @type {Map<string, number> | null} */
  map: null,
  expiresAt: 0,
};

function toPaiseFromInrNumber(valueInr) {
  const n = typeof valueInr === 'number' ? valueInr : parseFloat(valueInr);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function toInrFromPaise(paise) {
  const n = typeof paise === 'number' ? paise : parseInt(paise, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / 100) * 100) / 100;
}

/**
 * Price formula: Gold Value + Making Charge (incl. CZ stones) = Subtotal; GST 3% on Subtotal; Final = Subtotal + GST.
 * No wastage. Making charge = % of gold value OR fixed amount.
 * @param {Object} product - Product doc (plain or mongoose)
 * @param {Map<string, number>} [goldRatesMap] - Optional map of purity -> pricePerGram
 * @returns {Promise<{ price: number, pricePaise: number, breakup: object | null }>}
 */
async function getProductPrice(product, goldRatesMap = null) {
  const p = product.toObject ? product.toObject() : product;
  const purity = (p.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const netWeight = parseFloat(p.netWeight);
  const hasGold = purity && (purity === '14K' || purity === '18K' || purity === '22K' || purity === '24K') && Number.isFinite(netWeight) && netWeight > 0;

  if (!hasGold) {
    return { price: 0, pricePaise: 0, breakup: null };
  }

  let rates = goldRatesMap;
  if (!rates || typeof rates.get !== 'function') {
    rates = await getGoldRatesMapCached();
  }
  const pricePerGramPaise = rates.get(purity);
  if (pricePerGramPaise == null || !Number.isFinite(pricePerGramPaise)) {
    return { price: 0, pricePaise: 0, breakup: null };
  }

  const makingType = p.makingChargeType === 'fixed' ? 'fixed' : 'percentage';
  const makingValueRaw = parseFloat(p.makingChargeValue) || 0;
  const gstPercent = Number.isFinite(p.gstPercent) && p.gstPercent >= 0 ? p.gstPercent : DEFAULT_GST_PERCENT;

  const goldValuePaise = Math.round(netWeight * pricePerGramPaise);
  const makingChargePaise =
    makingType === 'percentage'
      ? Math.round(goldValuePaise * (makingValueRaw / 100))
      : Math.round(toPaiseFromInrNumber(makingValueRaw));
  const subtotalPaise = goldValuePaise + makingChargePaise;
  const gstPaise = Math.round(subtotalPaise * (gstPercent / 100));
  const totalPricePaise = subtotalPaise + gstPaise;

  return {
    pricePaise: totalPricePaise,
    price: toInrFromPaise(totalPricePaise),
    breakup: {
      goldValuePaise,
      makingChargePaise,
      gstPaise,
      subtotalPaise,
      totalPricePaise,
      goldPurity: purity,
      netWeight,
      pricePerGramPaise,
      gstPercent,
      makingChargeType: makingType,
      makingChargeValue: makingValueRaw,
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
  return String(price || 0);
}

async function getGoldRatesMapCached() {
  if (goldRatesCache.map && Date.now() < goldRatesCache.expiresAt) {
    return goldRatesCache.map;
  }
  const docs = await GoldRate.find().lean();
  const map = new Map(
    docs.map((r) => [
      String(r.purity).toUpperCase().replace(/\s/g, ''),
      r.pricePerGramPaise || toPaiseFromInrNumber(r.pricePerGram),
    ])
  );
  goldRatesCache = { map, expiresAt: Date.now() + GOLD_RATE_CACHE_TTL_MS };
  return map;
}

function invalidateGoldRatesCache() {
  goldRatesCache = { map: null, expiresAt: 0 };
}

module.exports = {
  getProductPrice,
  getProductPriceById,
  getPriceStringForProduct,
  getGoldRatesMapCached,
  invalidateGoldRatesCache,
  DEFAULT_GST_PERCENT,
  toPaiseFromInrNumber,
  toInrFromPaise,
};
