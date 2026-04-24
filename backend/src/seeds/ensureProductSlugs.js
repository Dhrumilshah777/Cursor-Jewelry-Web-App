const Product = require('../models/Product');
const { slugify, ensureUniqueSlug } = require('../services/productSlug');

/** Backfill missing slugs for legacy documents (runs once per deploy / startup). */
async function ensureProductSlugs() {
  const missing = await Product.find({
    $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }],
  }).select('_id name');

  for (const p of missing) {
    const base = slugify(p.name);
    // eslint-disable-next-line no-await-in-loop
    const slug = await ensureUniqueSlug(base, p._id);
    // eslint-disable-next-line no-await-in-loop
    await Product.updateOne({ _id: p._id }, { $set: { slug } });
  }
}

module.exports = { ensureProductSlugs };
