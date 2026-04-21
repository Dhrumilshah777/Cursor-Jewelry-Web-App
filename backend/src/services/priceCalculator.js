const Product = require('../models/Product');
const GoldRate = require('../models/GoldRate');

const DEFAULT_GST_PERCENT = 3;

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
  const fixedPricePaise = Number.isFinite(p.fixedPricePaise) ? Math.round(p.fixedPricePaise) : 0;
  const legacyFixed = parseFloat(p.price);
  const legacyFixedPaise = Number.isFinite(legacyFixed) && legacyFixed > 0 ? toPaiseFromInrNumber(legacyFixed) : 0;
  const hasFixed = fixedPricePaise > 0 || legacyFixedPaise > 0;
  if (hasFixed) {
    const unitPaise = fixedPricePaise > 0 ? fixedPricePaise : legacyFixedPaise;
    return {
      pricePaise: unitPaise,
      price: toInrFromPaise(unitPaise),
      breakup: { fixedPricePaise: unitPaise, subtotalPaise: unitPaise, totalPricePaise: unitPaise, gstPercent: 0, gstPaise: 0 },
    };
  }
  const purity = (p.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const netWeight = parseFloat(p.netWeight);
  const hasGold = purity && (purity === '14K' || purity === '18K' || purity === '22K' || purity === '24K') && Number.isFinite(netWeight) && netWeight > 0;

  if (!hasGold) {
    return { price: 0, pricePaise: 0, breakup: null };
  }

  let rates = goldRatesMap;
  if (!rates || typeof rates.get !== 'function') {
    const docs = await GoldRate.find().lean();
    rates = new Map(docs.map((r) => [String(r.purity).toUpperCase().replace(/\s/g, ''), r.pricePerGramPaise || toPaiseFromInrNumber(r.pricePerGram)]));
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

module.exports = { getProductPrice, getProductPriceById, getPriceStringForProduct, DEFAULT_GST_PERCENT, toPaiseFromInrNumber, toInrFromPaise };
