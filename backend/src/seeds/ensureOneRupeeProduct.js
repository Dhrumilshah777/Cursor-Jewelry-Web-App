const Product = require('../models/Product');

const ONE_RUPEE_SKU = 'ONE_RUPEE';

async function ensureOneRupeeProduct() {
  const doc = {
    name: '₹1 Product',
    category: 'Accessories',
    price: '1',
    image: 'https://i.pinimg.com/736x/63/c8/84/63c8843ca6bf89c0979967db22e2e3c7.jpg',
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

