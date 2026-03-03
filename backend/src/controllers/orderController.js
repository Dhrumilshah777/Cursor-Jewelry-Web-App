const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Razorpay = require('razorpay');

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
let razorpayInstance = null;
if (razorpayKeyId && razorpayKeySecret) {
  razorpayInstance = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
}

/** Create order (pending_payment). Requires idempotencyKey + shippingAddress. Items and total come from DB cart; duplicate key returns existing order. */
exports.create = async (req, res) => {
  try {
    const { shippingAddress, idempotencyKey } = req.body;
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return res.status(400).json({ error: 'idempotencyKey required' });
    }
    const key = idempotencyKey.trim();
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      return res.status(400).json({ error: 'Valid shipping address required' });
    }

    const existing = await Order.findOne({ user: req.userId, idempotencyKey: key });
    if (existing) {
      return res.status(200).json({
        order: existing.toObject ? existing.toObject() : existing,
        razorpayOrderId: existing.razorpayOrderId || null,
        razorpayKeyId: razorpayKeyId || null,
      });
    }

    let cart = await Cart.findOne({ user: req.userId });
    if (!cart) cart = { items: [] };
    const raw = cart.items || [];
    const validated = [];
    let subtotal = 0;
    for (const it of raw) {
      const product = await Product.findById(it.productId);
      if (!product || product.active !== true) continue;
      const qty = Math.min(it.quantity, product.stock);
      if (qty < 1) continue;
      const price = parseFloat(product.price) || 0;
      validated.push({
        productId: String(product._id),
        name: product.name,
        price: String(product.price),
        image: product.image || '',
        quantity: qty,
      });
      subtotal += price * qty;
    }
    const total = Math.round(subtotal * 100) / 100;
    if (validated.length === 0 || total <= 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid' });
    }

    const order = await Order.create({
      user: req.userId,
      idempotencyKey: key,
      items: validated,
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        line1: shippingAddress.line1,
        line2: shippingAddress.line2 || '',
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
      },
      subtotal: total,
      status: 'pending_payment',
    });

    let razorpayOrderId = null;
    if (razorpayInstance) {
      try {
        const amountPaise = Math.round(total * 100);
        const rzOrder = await razorpayInstance.orders.create({
          amount: amountPaise,
          currency: 'INR',
          receipt: order._id.toString(),
        });
        razorpayOrderId = rzOrder.id;
        order.razorpayOrderId = razorpayOrderId;
        await order.save();
      } catch (rzErr) {
        console.error('Razorpay order create error:', rzErr.message);
      }
    }

    res.status(201).json({
      order: order.toObject ? order.toObject() : order,
      razorpayOrderId,
      razorpayKeyId: razorpayKeyId || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/** Verify Razorpay payment and mark order paid. */
exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!orderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }
    const order = await Order.findOne({ _id: orderId, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') {
      return res.json({ order: order.toObject ? order.toObject() : order, verified: true });
    }

    const crypto = require('crypto');
    const body = order.razorpayOrderId + '|' + razorpayPaymentId;
    const expected = crypto.createHmac('sha256', razorpayKeySecret || '').update(body).digest('hex');
    if (expected !== razorpaySignature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    order.status = 'paid';
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save();

    for (const it of order.items || []) {
      const product = await Product.findById(it.productId);
      if (product && product.stock >= (it.quantity || 0)) {
        product.stock -= it.quantity || 0;
        await product.save();
      }
    }

    await Cart.findOneAndUpdate({ user: req.userId }, { $set: { items: [] } });

    res.json({ order: order.toObject ? order.toObject() : order, verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user.toString() !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(order);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: err.message });
  }
};
