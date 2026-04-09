const Product = require('../models/Product');

const ONE_RUPEE_SKU = 'ONE_RUPEE';

async function ensureOneRupeeProduct() {
  const doc = {
    name: '₹1 Product',
    category: 'Accessories',
    price: '1',
    image: 'https://via.placeholder.com/256?text=%E2%82%B91',
    active: true,
    stock: 999999,
    sku: ONE_RUPEE_SKU,
    description: 'Special fixed-price product (₹1).',
    homeSections: [],
    goldType: '',
    goldPurity: '',
    netWeight: null,
    makingChargeType: 'percentage',
    makingChargeValue: 0,
  };

  await Product.findOneAndUpdate(
    { sku: ONE_RUPEE_SKU },
    { $set: doc, $setOnInsert: { order: 0 } },
    { upsert: true, new: true }
  );
}

module.exports = { ensureOneRupeeProduct, ONE_RUPEE_SKU };

