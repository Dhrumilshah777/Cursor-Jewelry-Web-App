const Cart = require('../models/Cart');

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

/** Add one item (or increase quantity). Body: { productId, name, price, image?, quantity? } */
exports.addItem = async (req, res) => {
  try {
    const { productId, name, price, image, quantity } = req.body;
    if (!productId || !name || !price) {
      return res.status(400).json({ error: 'productId, name, price required' });
    }
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = await Cart.create({ user: req.userId, items: [] });
    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const existing = (cart.items || []).find((i) => i.productId === productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      cart.items.push({ productId, name, price: String(price), image: image || '', quantity: qty });
    }
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Merge guest cart items into user's cart. Same productId increases quantity. */
exports.merge = async (req, res) => {
  try {
    const guestItems = Array.isArray(req.body.items) ? req.body.items : [];
    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) {
      cart = await Cart.create({ user: req.userId, items: [] });
    }
    const existing = cart.items || [];
    const map = new Map(existing.map((i) => [i.productId, { ...i.toObject ? i.toObject() : i }]));
    for (const g of guestItems) {
      const id = g.id || g.productId;
      if (!id || !g.name || !g.price) continue;
      const qty = Math.max(1, parseInt(g.quantity, 10) || 1);
      if (map.has(id)) {
        map.get(id).quantity += qty;
      } else {
        map.set(id, {
          productId: id,
          name: g.name,
          price: g.price,
          image: g.image || '',
          quantity: qty,
        });
      }
    }
    cart.items = Array.from(map.values());
    await cart.save();
    res.json(cart.items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
