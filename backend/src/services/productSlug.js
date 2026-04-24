const Product = require('../models/Product');
const { SLUG_COLLATION } = require('../config/slugCollation');

function slugify(name) {
  const s = String(name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || 'product';
}

function isMongoObjectIdString(s) {
  return typeof s === 'string' && /^[a-fA-F0-9]{24}$/.test(s.trim());
}

/** True if slug is taken as current slug or reserved in oldSlugs (SEO redirects). */
async function isSlugTaken(slug, excludeId) {
  const q = {
    $or: [{ slug }, { oldSlugs: slug }],
  };
  const filter = excludeId ? { ...q, _id: { $ne: excludeId } } : q;
  return Boolean(await Product.findOne(filter).collation(SLUG_COLLATION).select('_id').lean());
}

/**
 * @param {string} base - already slugified base
 * @param {import('mongoose').Types.ObjectId|string|null} [excludeId]
 */
async function ensureUniqueSlug(base, excludeId = null) {
  let slug = base || 'product';
  let count = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await isSlugTaken(slug, excludeId)) {
    slug = `${base}-${count++}`;
  }
  return slug;
}

module.exports = { slugify, ensureUniqueSlug, isSlugTaken, isMongoObjectIdString };
