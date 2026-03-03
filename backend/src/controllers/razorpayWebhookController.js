const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

/**
 * Verify Razorpay webhook signature. Body must be the raw string/Buffer used to compute signature.
 */
function verifyWebhookSignature(body, signature) {
  if (!razorpayWebhookSecret) return false;
  const hmac = crypto.createHmac('sha256', razorpayWebhookSecret);
  const raw = typeof body === 'string' ? body : (Buffer.isBuffer(body) ? body.toString('utf8') : JSON.stringify(body));
  hmac.update(raw);
  const digest = hmac.digest('hex');
  return digest === signature;
}

/**
 * Mark order paid, decrement stock atomically, clear cart. Uses MongoDB transaction.
 * Idempotent: if order already paid, returns success without changing anything.
 * On stock failure: order is set to 'stock_failed', no cart clear.
 */
async function completePaidOrder(orderId, razorpayPaymentId) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findOne({ _id: orderId }).session(session);
    if (!order) {
      await session.abortTransaction();
      return { ok: false, reason: 'order_not_found' };
    }
    if (order.status === 'paid') {
      await session.commitTransaction();
      return { ok: true, alreadyPaid: true };
    }

    for (const it of order.items || []) {
      const qty = it.quantity || 0;
      if (qty < 1) continue;
      const result = await Product.findOneAndUpdate(
        { _id: it.productId, stock: { $gte: qty } },
        { $inc: { stock: -qty } },
        { new: true, session }
      );
      if (!result) {
        await session.abortTransaction();
        await Order.findByIdAndUpdate(orderId, { status: 'stock_failed', razorpayPaymentId });
        return { ok: false, reason: 'insufficient_stock', productId: it.productId };
      }
    }

    order.status = 'paid';
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save({ session });

    await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } }, { session });

    await session.commitTransaction();
    return { ok: true };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * POST /api/webhooks/razorpay — raw body required. Verify signature, handle payment.captured.
 */
async function handleRazorpayWebhook(req, res) {
  const rawBody = req.body;
  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    res.status(400).send('Missing signature');
    return;
  }
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
  if (!verifyWebhookSignature(bodyStr, signature)) {
    res.status(400).send('Invalid signature');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(bodyStr);
  } catch {
    res.status(400).send('Invalid JSON');
    return;
  }
  if (payload.event !== 'payment.captured') {
    res.status(200).send('OK');
    return;
  }
  const payment = payload.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) {
    res.status(200).send('OK');
    return;
  }
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;

  const order = await Order.findOne({ razorpayOrderId });
  if (!order) {
    res.status(200).send('OK');
    return;
  }

  try {
    const result = await completePaidOrder(order._id.toString(), razorpayPaymentId);
    if (!result.ok && result.reason === 'insufficient_stock') {
      console.error('Razorpay webhook: order', order._id, 'payment captured but stock update failed');
    }
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    res.status(500).send('Error');
    return;
  }
  res.status(200).send('OK');
}

module.exports = { handleRazorpayWebhook, completePaidOrder, verifyWebhookSignature };
