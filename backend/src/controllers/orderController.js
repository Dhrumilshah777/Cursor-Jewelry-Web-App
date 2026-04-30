const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { getProductPrice, toInrFromPaise } = require('../services/priceCalculator');
const { razorpayInstance, razorpayKeyId, razorpayKeySecret } = require('../services/razorpay');

function isValidCustomerName(name) {
  if (typeof name !== 'string') return false;
  const n = name.trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) return false;
  return /^[A-Za-z\s]+$/.test(n);
}

function normalizeCustomerName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function normalizeAddressStr(v, maxLen) {
  if (v === undefined || v === null) return '';
  const s = String(v).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  return maxLen ? s.slice(0, maxLen) : s;
}

function getPendingPaymentTtlMs() {
  const m = parseInt(process.env.PAYMENT_PENDING_TIMEOUT_MINUTES, 10);
  const minutes = Number.isFinite(m) && m > 0 ? Math.min(m, 24 * 60) : 30;
  return minutes * 60 * 1000;
}

/** Marks stale pending_payment orders as payment_cancelled (indexed query). */
async function expireStalePendingPayments() {
  const ttl = getPendingPaymentTtlMs();
  const cutoff = new Date(Date.now() - ttl);
  await Order.updateMany(
    { status: 'pending_payment', createdAt: { $lt: cutoff } },
    { $set: { status: 'payment_cancelled', failureReason: 'payment_expired' } }
  );
}

async function evaluateStockForOrder(order) {
  const outOfStockItems = [];
  for (const it of order.items || []) {
    const qty = it.quantity || 0;
    if (qty < 1) continue;
    const product = await Product.findById(it.productId);
    const available = product && product.active === true ? product.stock ?? 0 : 0;
    if (!product || product.active !== true || available < qty) {
      outOfStockItems.push({
        productId: String(it.productId),
        name: it.name || 'Item',
        needed: qty,
        available,
      });
    }
  }
  return { stockOk: outOfStockItems.length === 0, outOfStockItems };
}

function enrichOrder(orderDoc) {
  const o = orderDoc.toObject ? orderDoc.toObject() : { ...orderDoc };
  if (o.status === 'pending_payment' && o.createdAt) {
    const created = new Date(o.createdAt);
    o.paymentExpiresAt = new Date(created.getTime() + getPendingPaymentTtlMs()).toISOString();
    o.canRetryPayment = true;
  } else {
    o.paymentExpiresAt = null;
    o.canRetryPayment = false;
  }
  return o;
}

/** Create order (pending_payment). Requires idempotencyKey + shippingAddress. Items and total come from DB cart; duplicate key returns existing order. */
exports.create = async (req, res) => {
  try {
    await expireStalePendingPayments();
    const { shippingAddress, idempotencyKey } = req.body;
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
      return res.status(400).json({ error: 'idempotencyKey required' });
    }
    const key = idempotencyKey.trim();
    if (!shippingAddress || !shippingAddress.name || !shippingAddress.phone || !shippingAddress.line1 || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pincode) {
      return res.status(400).json({ error: 'Valid shipping address required' });
    }
    if (!isValidCustomerName(shippingAddress.name)) {
      return res.status(400).json({ error: 'Enter a valid name' });
    }

    const existing = await Order.findOne({ user: req.userId, idempotencyKey: key });
    if (existing) {
      const fresh = await Order.findById(existing._id);
      if (!fresh) {
        return res.status(500).json({ error: 'Order not found. Please try again.' });
      }
      if (fresh.status !== 'pending_payment') {
        return res.status(409).json({
          error: 'This checkout has expired or was cancelled. Please place the order again.',
          order: enrichOrder(fresh),
        });
      }
      if (!fresh.razorpayOrderId) {
        return res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
      }
      return res.status(200).json({
        order: enrichOrder(fresh),
        razorpayOrderId: fresh.razorpayOrderId || null,
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
      const pricingSource = (breakup?.pricePerGramPaise ?? 0) > 0 ? 'gold_dynamic' : 'unknown';
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
          fixedPricePaise: 0,
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
        name: normalizeCustomerName(shippingAddress.name),
        phone: normalizeAddressStr(shippingAddress.phone, 30),
        line1: normalizeAddressStr(shippingAddress.line1, 120),
        line2: normalizeAddressStr(shippingAddress.line2 || '', 120),
        city: normalizeAddressStr(shippingAddress.city, 60),
        state: normalizeAddressStr(shippingAddress.state, 60),
        pincode: normalizeAddressStr(shippingAddress.pincode, 12),
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

    // Progressive profiling: save details for faster future checkouts (best-effort).
    try {
      const addr = order.shippingAddress || {};
      const user = await User.findById(req.userId);
      if (user) {
        if ((!user.name || !user.name.trim()) && addr.name) {
          user.name = addr.name;
        }

        const addresses = Array.isArray(user.addresses) ? user.addresses : [];
        const isDup = (a) =>
          String(a?.line1 || '').trim().toLowerCase() === String(addr.line1 || '').trim().toLowerCase() &&
          String(a?.pincode || '').trim() === String(addr.pincode || '').trim() &&
          String(a?.phone || '').trim() === String(addr.phone || '').trim();
        const already = addresses.some(isDup);

        if (!already) {
          const hasDefault = addresses.some((a) => a && a.isDefault === true);
          addresses.push({
            label: '',
            name: addr.name || '',
            phone: addr.phone || '',
            line1: addr.line1 || '',
            line2: addr.line2 || '',
            landmark: '',
            city: addr.city || '',
            state: addr.state || '',
            pincode: addr.pincode || '',
            isDefault: !hasDefault,
          });
          user.addresses = addresses;
        }
        await user.save();
      }
    } catch (e) {
      console.warn('[orders] failed to persist user profile/address:', e?.message || e);
    }

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
      order: enrichOrder(order),
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
    await expireStalePendingPayments();
    const order = await Order.findOne({ _id: orderId, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') {
      return res.json({ order: enrichOrder(order), verified: true });
    }
    if (order.status !== 'pending_payment') {
      return res.status(409).json({ error: 'This checkout is no longer valid. Please start again from checkout.' });
    }

    const crypto = require('crypto');
    const body = order.razorpayOrderId + '|' + razorpayPaymentId;
    const expected = crypto.createHmac('sha256', razorpayKeySecret || '').update(body).digest('hex');
    if (expected !== razorpaySignature) {
      // Payment verification failed (frontend callback)
      await Order.updateOne(
        { _id: order._id, status: 'pending_payment' },
        { $set: { failureReason: 'signature_invalid' } }
      ).catch(() => {});
      const { auditFromReq } = require('../services/auditLog');
      void auditFromReq(req, 'payment.failed', {
        entityType: 'order',
        entityId: String(order._id),
        correlationId: String(order._id),
        dedupeKey: `payment.failed:order:${String(order._id)}:${String(razorpayPaymentId || '')}`,
        meta: { extra: { reason: 'signature_mismatch', razorpayPaymentId: String(razorpayPaymentId || '') } },
      });
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const result = await completePaidOrder(order._id.toString(), razorpayPaymentId);
    if (!result.ok) {
      if (result.reason === 'insufficient_stock') {
        return res.status(400).json({ error: 'Item out of stock during payment completion. A refund has been automatically issued to your original payment method.' });
      }
      if (result.reason === 'invalid_status') {
        return res.status(409).json({
          error: 'This checkout is no longer valid. If money was debited, a refund will be processed automatically.',
        });
      }
      return res.status(500).json({ error: 'Could not complete order' });
    }

    const updated = await Order.findById(order._id);
    res.json({ order: updated ? enrichOrder(updated) : null, verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.myOrders = async (req, res) => {
  try {
    await expireStalePendingPayments();
    // "Actual orders" for account UI: hide incomplete checkout attempts.
    const orders = await Order.find({
      user: req.userId,
      status: { $nin: ['pending_payment', 'payment_cancelled'] },
    }).sort({ createdAt: -1 });
    res.json(orders.map((o) => enrichOrder(o)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    await expireStalePendingPayments();
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.user.toString() !== req.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(enrichOrder(order));
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: err.message });
  }
};

/** GET /api/orders/payment-stock?orderId= — pre-check before opening Razorpay on retry. */
exports.checkPaymentStock = async (req, res) => {
  try {
    const orderId = req.query.orderId;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId query parameter required' });
    }
    await expireStalePendingPayments();
    const order = await Order.findOne({ _id: orderId.trim(), user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'pending_payment') {
      const reason =
        order.status === 'payment_cancelled' ? 'payment_expired' : 'not_pending';
      return res.json({
        ok: true,
        stockOk: false,
        canRetry: false,
        status: order.status,
        reason,
      });
    }

    const { stockOk, outOfStockItems } = await evaluateStockForOrder(order);
    return res.json({
      ok: true,
      stockOk,
      outOfStockItems: stockOk ? [] : outOfStockItems,
      canRetry: true,
      status: order.status,
      paymentExpiresAt: new Date(order.createdAt.getTime() + getPendingPaymentTtlMs()).toISOString(),
    });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: err.message });
  }
};

/** POST /api/orders/:id/retry-payment — same DB order, new Razorpay order id. */
exports.retryPayment = async (req, res) => {
  try {
    await expireStalePendingPayments();
    const order = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'pending_payment') {
      if (order.status === 'payment_cancelled') {
        return res.status(410).json({
          error: 'Payment window expired. Please place a new order.',
          code: 'payment_expired',
        });
      }
      return res.status(409).json({ error: 'This order cannot be paid.' });
    }

    const { stockOk, outOfStockItems } = await evaluateStockForOrder(order);
    if (!stockOk) {
      return res.status(400).json({
        error: 'One or more items are now out of stock.',
        code: 'out_of_stock',
        outOfStockItems,
      });
    }

    if (!razorpayInstance) {
      return res.status(500).json({ error: 'Payment service unavailable. Please try again.' });
    }

    const amountPaise = Math.round(order.finalAmountPaise || 0);
    if (!Number.isFinite(amountPaise) || amountPaise < 1) {
      return res.status(400).json({ error: 'Invalid order amount' });
    }

    const rzOrder = await razorpayInstance.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: order._id.toString(),
    });
    order.razorpayOrderId = rzOrder.id;
    await order.save();

    res.json({
      order: enrichOrder(order),
      razorpayOrderId: rzOrder.id,
      razorpayKeyId: razorpayKeyId || null,
    });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    console.error('retryPayment:', err?.message || err);
    res.status(502).json({ error: 'Payment gateway error. Please try again.' });
  }
};

exports.expireStalePendingPayments = expireStalePendingPayments;

/** Mark a pending_payment order as payment_cancelled (user exited Razorpay). */
exports.cancelPayment = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') return res.status(409).json({ error: 'Order is already paid' });
    if (order.status === 'pending_payment') {
      order.status = 'payment_cancelled';
      order.failureReason = 'payment_expired';
      await order.save();
      const { auditFromReq } = require('../services/auditLog');
      void auditFromReq(req, 'payment.failed', {
        entityType: 'order',
        entityId: String(order._id),
        correlationId: String(order._id),
        dedupeKey: `payment.failed:order:${String(order._id)}:cancelled`,
        meta: { extra: { reason: 'user_cancelled' } },
      });
    }
    return res.json({ ok: true, status: order.status });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    return res.status(500).json({ error: err.message });
  }
};
