/**
 * MongoDB collation for case-insensitive slug matching and unique index.
 * Must match the index on `Product.slug` (see `models/Product.js`).
 */
module.exports = {
  SLUG_COLLATION: { locale: 'en', strength: 2 },
};
