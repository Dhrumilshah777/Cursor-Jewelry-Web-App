const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

exports.get = async (req, res) => {
  try {
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      cart = await Cart.create({ user: req.userId, items: [] });
    }
    res.json(cart.items || []);
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
        name: product.name,
        price: String(price),
        image: product.image || '',
        quantity: qty,
      });
      subtotal += price * qty;
    }
    cart.items = validated;
    await cart.save();
    res.json({ items: validated, subtotal: Math.round(subtotal * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.set = async (req, res) => {
  try {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const cart = await Cart.findOneAndUpdate(
      { user: req.userId },
      { $set: { items } },
      { new: true, upsert: true }
    );
    res.json(cart.items || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Add one item (or increase quantity). Body: { productId, name?, price?, image?, quantity? }. Validates product exists, active, stock; uses DB price. */
exports.addItem = async (req, res) => {
  try {
    const { productId, name, price, image, quantity } = req.body;
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
    const { price: productPrice } = await getProductPrice(product);
    const priceStr = String(productPrice);
    if (existing) {
      const newQty = existing.quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ error: `Only ${product.stock} in stock` });
      }
      existing.quantity = newQty;
      existing.price = priceStr;
      existing.name = product.name;
      if (product.image) existing.image = product.image;
    } else {
      cart.items.push({
        productId: String(product._id),
        name: product.name,
        price: priceStr,
        image: product.image || '',
        quantity: qty,
      });
    }
    await cart.save();
    res.json(cart.items);
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
    const map = new Map(existing.map((i) => [String(i.productId), { ...(i.toObject ? i.toObject() : i) }]));
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
      const { price } = await getProductPrice(product);
      map.set(key, {
        productId: key,
        name: product.name,
        price: String(price),
        image: product.image || '',
        quantity: newQty,
      });
    }
    cart.items = Array.from(map.values());
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
