const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

exports.get = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      cart = await Cart.create({ user: req.userId, items: [] });
    }
    // Keep API contract: return enriched items (name/price/image) for frontend.
    const raw = cart.items || [];
    const enriched = [];
    for (const it of raw) {
      const product = await Product.findById(it.productId);
      if (!product || product.active !== true) continue;
      const qty = Math.min(it.quantity, product.stock);
      if (qty < 1) continue;
      const { price } = await getProductPrice(product);
      enriched.push({
        productId: String(product._id),
        slug: product.slug || '',
        name: product.name,
        price: String(price || 0),
        image: product.image || '',
        quantity: qty,
      });
    }
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Validated cart: re-fetch products from DB, filter invalid/out-of-stock, recalc subtotal from DB prices. Returns { items, subtotal }. */
exports.getValidated = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      cart = await Cart.create({ user: req.userId, items: [] });
    }
    const raw = cart.items || [];
    const validated = [];
    let subtotal = 0;
    for (const it of raw) {
      const product = await Product.findById(it.productId);
      if (!product || product.active !== true) continue;
      const qty = Math.min(it.quantity, product.stock);
      if (qty < 1) continue;
      const { price } = await getProductPrice(product);
      validated.push({
        productId: String(product._id),
        slug: product.slug || '',
        name: product.name,
        price: String(price),
        image: product.image || '',
        quantity: qty,
      });
      subtotal += price * qty;
    }
    // Persist simplified cart (productId + quantity). Pricing is always recalculated.
    cart.items = validated.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    await cart.save();
    res.json({ items: validated, subtotal: Math.round(subtotal * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.set = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    // Accept both legacy full items and the new minimal format.
    const minimal = items
      .map((i) => ({
        productId: String(i.productId || i.id || ''),
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
      }))
      .filter((i) => i.productId);
    const cart = await Cart.findOneAndUpdate(
      { user: req.userId },
      { $set: { items: minimal } },
      { new: true, upsert: true }
    );
    // Return enriched items for frontend.
    const out = [];
    for (const it of cart.items || []) {
      const product = await Product.findById(it.productId);
      if (!product || product.active !== true) continue;
      const qty = Math.min(it.quantity, product.stock);
      if (qty < 1) continue;
      const { price } = await getProductPrice(product);
      out.push({
        productId: String(product._id),
        slug: product.slug || '',
        name: product.name,
        price: String(price || 0),
        image: product.image || '',
        quantity: qty,
      });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Add one item (or increase quantity). Body: { productId, name?, price?, image?, quantity? }. Validates product exists, active, stock; uses DB price. */
exports.addItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId required' });
    }
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    if (product.active !== true) {
      return res.status(400).json({ error: 'Product is not available' });
    }
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    if (product.stock < qty) {
      return res.status(400).json({ error: `Only ${product.stock} in stock` });
    }
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = await Cart.create({ user: req.userId, items: [] });
    const existing = (cart.items || []).find((i) => String(i.productId) === String(productId));
    if (existing) {
      const newQty = existing.quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ error: `Only ${product.stock} in stock` });
      }
      existing.quantity = newQty;
    } else {
      cart.items.push({
        productId: String(product._id),
        quantity: qty,
      });
    }
    await cart.save();
    // Return enriched items for frontend.
    const out = [];
    for (const it of cart.items || []) {
      const p = await Product.findById(it.productId);
      if (!p || p.active !== true) continue;
      const q = Math.min(it.quantity, p.stock);
      if (q < 1) continue;
      const { price } = await getProductPrice(p);
      out.push({
        productId: String(p._id),
        slug: p.slug || '',
        name: p.name,
        price: String(price || 0),
        image: p.image || '',
        quantity: q,
      });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Merge guest cart items into user's cart. Validates each product exists, active, stock; uses DB price. */
exports.merge = async (req, res) => {
  try {
    const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      cart = await Cart.create({ user: req.userId, items: [] });
    }
    const existing = cart.items || [];
    const map = new Map(existing.map((i) => [String(i.productId), { productId: String(i.productId), quantity: i.quantity }]));
    for (const g of guestItems) {
      const id = g.id || g.productId;
      if (!id) continue;
      const product = await Product.findById(id);
      if (!product || product.active !== true) continue;
      const qty = Math.max(1, parseInt(g.quantity, 10) || 1);
      const key = String(product._id);
      const current = map.get(key);
      const newQty = current ? current.quantity + qty : qty;
      if (product.stock < newQty) continue;
      map.set(key, {
        productId: key,
        quantity: newQty,
      });
    }
    cart.items = Array.from(map.values());
    await cart.save();
    // Return enriched items for frontend.
    const out = [];
    for (const it of cart.items || []) {
      const p = await Product.findById(it.productId);
      if (!p || p.active !== true) continue;
      const q = Math.min(it.quantity, p.stock);
      if (q < 1) continue;
      const { price } = await getProductPrice(p);
      out.push({
        productId: String(p._id),
        slug: p.slug || '',
        name: p.name,
        price: String(price || 0),
        image: p.image || '',
        quantity: q,
      });
    }
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
