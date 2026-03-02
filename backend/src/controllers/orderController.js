const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Razorpay = require('razorpay');

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
let razorpayInstance = null;
if (razorpayKeyId && razorpayKeySecret) {
  razorpayInstance = new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret });
}

/** Create order (pending_payment). Returns order + razorpayOrderId if Razorpay configured. */
exports.create = async (req, res) => {
  try {
    const { items, shippingAddress, subtotal } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items required' });
    }
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      return res.status(400).json({ error: 'Valid shipping address required' });
    }
    const total = typeof subtotal === 'number' ? subtotal : parseFloat(String(subtotal).replace(/[^0-9.]/g, '')) || 0;
    if (total <= 0) return res.status(400).json({ error: 'Invalid subtotal' });

    const order = await Order.create({
      user: req.userId,
      items: items.map((i) => ({
        productId: i.id || i.productId,
        name: i.name,
        price: i.price,
        image: i.image || '',
        quantity: Math.max(1, parseInt(i.quantity, 10) || 1),
      })),
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

    const Cart = require('../models/Cart');
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
