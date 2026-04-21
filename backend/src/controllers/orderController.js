const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { getProductPrice, toInrFromPaise } = require('../services/priceCalculator');
const { razorpayInstance, razorpayKeyId, razorpayKeySecret } = require('../services/razorpay');

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
      if (!existing.razorpayOrderId) {
        return res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
      }
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
    let subtotalPaise = 0;
    let gstAmountPaise = 0;
    let itemsTotalPaise = 0;
    for (const it of raw) {
      const product = await Product.findById(it.productId);
      if (!product || product.active !== true) continue;
      const qty = Math.min(it.quantity, product.stock);
      if (qty < 1) continue;
      const { price, pricePaise, breakup } = await getProductPrice(product);
      const unitSubtotalPaise = breakup?.subtotalPaise ?? pricePaise;
      const unitGstPaise = breakup?.gstPaise ?? 0;
      const unitTotalPaise = breakup?.totalPricePaise ?? pricePaise;
      const pricingSource =
        (breakup?.fixedPricePaise ?? 0) > 0 ? 'fixed'
          : (breakup?.pricePerGramPaise ?? 0) > 0 ? 'gold_dynamic'
            : 'unknown';
      validated.push({
        productId: String(product._id),
        name: product.name,
        price: String(price),
        unitPricePaise: pricePaise,
        image: product.image || '',
        quantity: qty,
        pricing: {
          pricingSource,
          pricingVersion: 1,
          fixedPricePaise: breakup?.fixedPricePaise ?? 0,
          goldRatePerGramPaise: breakup?.pricePerGramPaise ?? 0,
          netWeightGrams: breakup?.netWeight ?? 0,
          goldValuePaise: breakup?.goldValuePaise ?? 0,
          makingChargeType: breakup?.makingChargeType ?? '',
          makingChargeValue: breakup?.makingChargeValue ?? 0,
          makingChargePaise: breakup?.makingChargePaise ?? 0,
          subtotalPaise: unitSubtotalPaise,
          gstPercent: breakup?.gstPercent ?? 0,
          gstPaise: unitGstPaise,
          totalPaise: unitTotalPaise,
          goldPurity: breakup?.goldPurity ?? '',
        },
      });
      subtotalPaise += unitSubtotalPaise * qty;
      gstAmountPaise += unitGstPaise * qty;
      itemsTotalPaise += unitTotalPaise * qty;
    }
    const totalAmountPaise = subtotalPaise + gstAmountPaise;
    const discountPaise = 0;
    const shippingPaise = 0;
    const finalAmountPaise = totalAmountPaise + shippingPaise - discountPaise;
    const total = toInrFromPaise(totalAmountPaise);
    const subtotalInr = toInrFromPaise(subtotalPaise);
    if (validated.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or invalid' });
    }
    if (!Number.isFinite(finalAmountPaise) || finalAmountPaise < 0) {
      return res.status(400).json({ error: 'Invalid final amount' });
    }
    // Ensure totals match line items snapshot.
    if (itemsTotalPaise !== totalAmountPaise) {
      return res.status(400).json({ error: 'Price mismatch. Please refresh cart and try again.' });
    }

    const order = await Order.create({
      user: req.userId,
      currency: 'INR',
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
      subtotalPaise,
      gstAmountPaise,
      discountPaise,
      shippingPaise,
      totalAmountPaise,
      finalAmountPaise,
      subtotal: subtotalInr,
      totalAmount: total,
      status: 'pending_payment',
    });

    let razorpayOrderId = null;
    if (!razorpayInstance) {
      await Order.findByIdAndDelete(order._id);
      return res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
    }
    if (razorpayInstance) {
      try {
        const amountPaise = Math.round(finalAmountPaise);
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
        // Clean up the ghost order since it cannot be paid
        await Order.findByIdAndDelete(order._id);
        return res.status(502).json({ error: 'Payment gateway initialization failed. Please try again.' });
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

const { completePaidOrder } = require('./razorpayWebhookController');

/** Verify Razorpay payment (frontend callback). Uses same transactional stock decrement as webhook. */
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

    const result = await completePaidOrder(order._id.toString(), razorpayPaymentId);
    if (!result.ok) {
      if (result.reason === 'insufficient_stock') {
        return res.status(400).json({ error: 'Item out of stock during payment completion. A refund has been automatically issued to your original payment method.' });
      }
      return res.status(500).json({ error: 'Could not complete order' });
    }

    const updated = await Order.findById(order._id);
    res.json({ order: updated?.toObject ? updated.toObject() : updated, verified: true });
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

/** Mark a pending_payment order as payment_cancelled (user exited Razorpay). */
exports.cancelPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') return res.status(409).json({ error: 'Order is already paid' });
    if (order.status === 'pending_payment') {
      order.status = 'payment_cancelled';
      await order.save();
    }
    return res.json({ ok: true, status: order.status });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    return res.status(500).json({ error: err.message });
  }
};
