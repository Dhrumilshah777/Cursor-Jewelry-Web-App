const Counter = require('../models/Counter');

const VALID_CATEGORY_CODES = ['RING', 'ERNG', 'CHN', 'BRCL', 'PEND'];
const VALID_PURITIES = ['14K', '18K', '22K', '24K'];

/** Map product category (display name) to SKU category code */
const CATEGORY_MAP = {
  rings: 'RING',
  ring: 'RING',
  earrings: 'ERNG',
  earring: 'ERNG',
  chain: 'CHN',
  chains: 'CHN',
  bracelet: 'BRCL',
  bracelets: 'BRCL',
  pendant: 'PEND',
  pendants: 'PEND',
};

/**
 * Get category code from product category string.
 * @param {string} category - Product category (e.g. "Rings", "Earrings")
 * @returns {string} - Short code (RING, ERNG, ...) or null if not mappable
 */
function getCategoryCode(category) {
  if (!category || typeof category !== 'string') return null;
  const normalized = category.trim().toLowerCase().replace(/\s+/g, ' ');
  const key = normalized.replace(/\s+/g, '');
  return CATEGORY_MAP[key] || CATEGORY_MAP[normalized] || null;
}

/**
 * Validate and normalize category code. Accepts short code or category name.
 * @param {string} category - "RING" or "Rings" etc.
 * @returns {{ valid: boolean, code: string|null, error?: string }}
 */
function validateCategory(category) {
  if (!category || typeof category !== 'string') {
    return { valid: false, code: null, error: 'Category is required' };
  }
  const trimmed = category.trim().toUpperCase();
  if (VALID_CATEGORY_CODES.includes(trimmed)) {
    return { valid: true, code: trimmed };
  }
  const fromMap = getCategoryCode(category);
  if (fromMap) {
    return { valid: true, code: fromMap };
  }
  return {
    valid: false,
    code: null,
    error: `Invalid category. Use one of: ${VALID_CATEGORY_CODES.join(', ')}`,
  };
}

/**
 * Validate and normalize purity.
 * @param {string} purity - "18K", "18k", etc.
 * @returns {{ valid: boolean, value: string|null, error?: string }}
 */
function validatePurity(purity) {
  if (!purity || typeof purity !== 'string') {
    return { valid: false, value: null, error: 'Purity is required' };
  }
  const normalized = purity.trim().toUpperCase().replace(/\s/g, '');
  if (VALID_PURITIES.includes(normalized)) {
    return { valid: true, value: normalized };
  }
  return {
    valid: false,
    value: null,
    error: `Invalid purity. Use one of: ${VALID_PURITIES.join(', ')}`,
  };
}

/**
 * Generate a unique SKU: CATEGORY-PURITY-XXX (e.g. RING-18K-001).
 * Uses atomic findOneAndUpdate on Counter collection.
 * @param {string} category - Category code (RING, ERNG, CHN, BRCL, PEND)
 * @param {string} purity - Purity (14K, 18K, 22K, 24K)
 * @returns {Promise<string>} - Generated SKU
 * @throws {Error} - If category or purity invalid
 */
async function generateSKU(category, purity) {
  const cat = validateCategory(category);
  if (!cat.valid) {
    throw new Error(cat.error);
  }
  const pur = validatePurity(purity);
  if (!pur.valid) {
    throw new Error(pur.error);
  }

  const key = `${cat.code}-${pur.value}`;
  const doc = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { new: true, upsert: true }
  );
  const num = doc.value;
  const suffix = String(num).padStart(3, '0');
  return `${cat.code}-${pur.value}-${suffix}`;
}

module.exports = {
  generateSKU,
  validateCategory,
  validatePurity,
  getCategoryCode,
  VALID_CATEGORY_CODES,
  VALID_PURITIES,
};
