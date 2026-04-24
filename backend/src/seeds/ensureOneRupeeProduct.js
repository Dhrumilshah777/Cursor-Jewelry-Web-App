const Product = require('../models/Product');
const { slugify, ensureUniqueSlug } = require('../services/productSlug');

const ONE_RUPEE_SKU = 'ONE_RUPEE';

async function ensureOneRupeeProduct() {
  const existing = await Product.findOne({ sku: ONE_RUPEE_SKU }).select('_id slug').lean();
  const baseSlug = slugify('one-rupee-product');
  const slug = existing?.slug || (await ensureUniqueSlug(baseSlug, existing?._id || null));

  const doc = {
    name: '₹1 Product',
    slug,
    category: 'Accessories',
    price: '',
    image: 'https://i.pinimg.com/736x/63/c8/84/63c8843ca6bf89c0979967db22e2e3c7.jpg',
    active: true,
    stock: 999999,
    sku: ONE_RUPEE_SKU,
    description: 'Special product for testing (gold-based pricing).',
    homeSections: [],
    goldType: '',
    goldPurity: '24K',
    netWeight: 0.0001,
    makingChargeType: 'percentage',
    makingChargeValue: 0,
    fixedPricePaise: 0,
    gstPercent: 3,
  };

  await Product.findOneAndUpdate(
    { sku: ONE_RUPEE_SKU },
    { $set: doc, $setOnInsert: { order: 0 } },
    { upsert: true, new: true }
  );
}

module.exports = { ensureOneRupeeProduct, ONE_RUPEE_SKU };

