const User = require('../models/User');
const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

const MAX_WISHLIST = 100;

function toClientItem(w) {
  return {
    id: String(w.productId),
    name: w.name,
    category: w.category || '',
    price: w.price,
    image: w.image || '',
  };
}

function normalizeIncoming(items) {
  const raw = Array.isArray(items) ? items : [];
  const out = [];
  const seen = new Set();
  for (const it of raw.slice(0, MAX_WISHLIST)) {
    const id = String(it.id || it.productId || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      productId: id,
      name: String(it.name || 'Product').slice(0, 200),
      category: String(it.category || '').slice(0, 100),
      price: String(it.price != null ? it.price : '0'),
      image: String(it.image || '').slice(0, 500),
    });
  }
  return out;
}

exports.get = async (req, res) => {
  try {
    const user = await User.findById(req.userId).lean();
    const list = user?.wishlist || [];
    res.json(list.map(toClientItem));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.put = async (req, res) => {
  try {
    const normalized = normalizeIncoming(req.body.items);
    await User.findByIdAndUpdate(req.userId, { $set: { wishlist: normalized } });
    res.json(normalized.map(toClientItem));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const body = req.body || {};
    const productId = String(body.id || body.productId || '').trim();
    if (!productId) {
      return res.status(400).json({ error: 'productId required' });
    }
    const product = await Product.findById(productId);
    if (!product || product.active !== true) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const list = user.wishlist || [];
    if (list.some((w) => String(w.productId) === productId)) {
      return res.json(list.map(toClientItem));
    }
    if (list.length >= MAX_WISHLIST) {
      return res.status(400).json({ error: 'Wishlist limit reached' });
    }
    const { price } = await getProductPrice(product);
    list.push({
      productId,
      name: product.name,
      category: product.category || '',
      price: String(price),
      image: product.image || '',
    });
    user.wishlist = list;
    await user.save();
    res.json(list.map(toClientItem));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const productId = String(req.params.productId || '').trim();
    if (!productId) {
      return res.status(400).json({ error: 'productId required' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.wishlist = (user.wishlist || []).filter((w) => String(w.productId) !== productId);
    await user.save();
    res.json((user.wishlist || []).map(toClientItem));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.merge = async (req, res) => {
  try {
    const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const byId = new Map();
    for (const w of user.wishlist || []) {
      const id = String(w.productId);
      byId.set(id, {
        productId: id,
        name: w.name,
        category: w.category || '',
        price: w.price,
        image: w.image || '',
      });
    }

    for (const g of guestItems) {
      const id = String(g.id || g.productId || '').trim();
      if (!id || byId.has(id)) continue;
      if (byId.size >= MAX_WISHLIST) break;
      const product = await Product.findById(id);
      if (!product || product.active !== true) continue;
      const { price } = await getProductPrice(product);
      byId.set(id, {
        productId: id,
        name: product.name,
        category: product.category || '',
        price: String(price),
        image: product.image || '',
      });
    }

    user.wishlist = Array.from(byId.values());
    await user.save();
    res.json(user.wishlist.map(toClientItem));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
