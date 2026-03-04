const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

function categoryToSlug(cat) {
  return String(cat || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
}

exports.list = async (req, res) => {
  try {
    const products = await Product.find({ active: { $ne: false } }).sort({ order: 1, createdAt: -1 });
    const withPrices = [];
    for (const p of products) {
      const { price } = await getProductPrice(p);
      const po = p.toObject ? p.toObject() : p;
      const numPrice = parseFloat(po.price || price || '0') || 0;
      withPrices.push({
        ...po,
        price: String(po.price || price || '0'),
        calculatedPrice: price,
        _numPrice: numPrice,
      });
    }

    const categorySlug = (req.query.category || '').toString().trim().toLowerCase();
    const minPrice = parseFloat(req.query.minPrice);
    const maxPrice = parseFloat(req.query.maxPrice);
    const colorParam = (req.query.color || '').toString().trim();
    const colorsFilter = colorParam ? colorParam.split(',').map((c) => c.trim()).filter(Boolean) : [];

    let filtered = withPrices;
    if (categorySlug) {
      filtered = filtered.filter((p) => categoryToSlug(p.category) === categorySlug);
    }
    if (Number.isFinite(minPrice) && minPrice > 0) {
      filtered = filtered.filter((p) => p._numPrice >= minPrice);
    }
    if (Number.isFinite(maxPrice) && maxPrice > 0) {
      filtered = filtered.filter((p) => p._numPrice <= maxPrice);
    }
    if (colorsFilter.length > 0) {
      filtered = filtered.filter((p) => {
        const productColors = (p.colors || []).map((c) => String(c).trim().toLowerCase());
        return colorsFilter.some((c) => productColors.includes(c.toLowerCase()));
      });
    }

    const out = filtered.map(({ _numPrice, ...rest }) => rest);

    const prices = withPrices.map((p) => p._numPrice).filter((n) => n > 0);
    const categoryCounts = {};
    withPrices.forEach((p) => {
      const slug = categoryToSlug(p.category);
      const name = (p.category || 'Uncategorized').trim();
      if (!slug) return;
      if (!categoryCounts[slug]) categoryCounts[slug] = { slug, name, count: 0 };
      categoryCounts[slug].count += 1;
    });
    const colorCounts = {};
    withPrices.forEach((p) => {
      (p.colors || []).forEach((c) => {
        const key = String(c).trim();
        if (!key) return;
        if (!colorCounts[key]) colorCounts[key] = { name: key, count: 0 };
        colorCounts[key].count += 1;
      });
    });

    const facets = {
      totalProducts: withPrices.length,
      categories: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
      priceRange: {
        min: prices.length ? Math.min(...prices) : 0,
        max: prices.length ? Math.max(...prices) : 0,
      },
      colors: Object.entries(colorCounts).map(([name, o]) => ({ name, count: o.count })).sort((a, b) => b.count - a.count),
    };

    res.json({ products: out, facets });
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
