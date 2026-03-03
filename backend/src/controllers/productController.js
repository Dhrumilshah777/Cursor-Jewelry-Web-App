const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

exports.list = async (req, res) => {
  try {
    const products = await Product.find().sort({ order: 1, createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    const po = product.toObject ? product.toObject() : product;
    const { price, breakup } = await getProductPrice(product);
    res.json({ ...po, price: String(po.price || price), calculatedPrice: price, priceBreakup: breakup });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Product not found' });
    res.status(500).json({ error: err.message });
  }
};

function hasValidGoldPricing(body) {
  const p = (body.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const w = parseFloat(body.netWeight);
  return ['18K', '22K', '24K'].includes(p) && Number.isFinite(w) && w > 0;
}

exports.create = async (req, res) => {
  try {
    const body = { ...req.body };
    const hasGold = hasValidGoldPricing(body);
    if (!hasGold && (!body.price || !String(body.price).trim())) {
      return res.status(400).json({ error: 'Either fixed price or gold pricing (goldPurity + netWeight) is required' });
    }
    const product = await Product.create(body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const body = { ...req.body };
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });
    const merged = { ...existing.toObject(), ...body };
    const hasGold = hasValidGoldPricing(merged);
    if (!hasGold && (!merged.price || !String(merged.price).trim())) {
      return res.status(400).json({ error: 'Either fixed price or gold pricing (goldPurity + netWeight) is required' });
    }
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
