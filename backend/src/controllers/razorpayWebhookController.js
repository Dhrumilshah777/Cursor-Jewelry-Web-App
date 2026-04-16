const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { razorpayInstance } = require('../services/razorpay');
const { sendOrderSMS, sendOrderWhatsApp } = require('../services/twilioSms');

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

function maskPhone(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return '';
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

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
        let refundId = '';
        let refundStatus = '';
        if (razorpayInstance && razorpayPaymentId) {
          try {
            const refund = await razorpayInstance.payments.refund(razorpayPaymentId);
            refundId = String(refund?.id || '');
            refundStatus = 'requested';
            console.log(`Refund requested for stock_failed payment ${razorpayPaymentId} (refund ${refundId}) for order ${orderId}`);
          } catch (refundErr) {
            refundStatus = 'failed';
            console.error(`Failed to automatically refund payment ${razorpayPaymentId}:`, refundErr?.message || refundErr);
          }
        }

        await Order.findByIdAndUpdate(orderId, {
          status: 'stock_failed',
          razorpayPaymentId,
          razorpayRefundId: refundId,
          refundStatus,
        });

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
  console.log('[rz.webhook] received', { hasSignature: Boolean(signature) });
  if (!signature) {
    res.status(400).send('Missing signature');
    return;
  }
  const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody));
  if (!verifyWebhookSignature(bodyStr, signature)) {
    console.warn('[rz.webhook] invalid signature');
    res.status(400).send('Invalid signature');
    return;
  }
  let payload;
  try {
    payload = JSON.parse(bodyStr);
  } catch {
    console.warn('[rz.webhook] invalid json body');
    res.status(400).send('Invalid JSON');
    return;
  }
  console.log('[rz.webhook] event', { event: payload?.event || '' });
  if (payload.event !== 'payment.captured') {
    res.status(200).send('OK');
    return;
  }
  const payment = payload.payload?.payment?.entity;
  if (!payment?.id || !payment.order_id) {
    console.warn('[rz.webhook] missing payment entity ids');
    res.status(200).send('OK');
    return;
  }
  const razorpayOrderId = payment.order_id;
  const razorpayPaymentId = payment.id;
  console.log('[rz.webhook] payment.captured', { razorpayOrderId, razorpayPaymentId });

  const order = await Order.findOne({ razorpayOrderId });
  if (!order) {
    console.warn('[rz.webhook] order not found for razorpayOrderId', { razorpayOrderId });
    res.status(200).send('OK');
    return;
  }
  console.log('[rz.webhook] matched order', { orderId: String(order._id), currentStatus: order.status });

  try {
    const result = await completePaidOrder(order._id.toString(), razorpayPaymentId);
    console.log('[rz.webhook] completePaidOrder result', result);
    if (!result.ok && result.reason === 'insufficient_stock') {
      console.error('Razorpay webhook: order', order._id, 'payment captured but stock update failed');
    }
    // Send SMS only on first-time payment completion (avoid duplicates on webhook retries).
    if (result.ok && !result.alreadyPaid) {
      try {
        const fresh = await Order.findById(order._id).populate('user', 'name');
        const phone = fresh?.shippingAddress?.phone || order.shippingAddress?.phone || '';
        const name = fresh?.user?.name || fresh?.shippingAddress?.name || 'Customer';
        const amount = typeof fresh?.subtotal === 'number' ? fresh.subtotal : order.subtotal;
        console.log('[rz.webhook] sms attempt', {
          orderId: fresh?._id?.toString?.() || order._id.toString(),
          to: maskPhone(phone),
          name: String(name || '').trim() || 'Customer',
          amount,
        });
        const orderIdStr = fresh?._id?.toString?.() || order._id.toString();
        await sendOrderSMS({
          phone,
          name,
          orderId: orderIdStr,
          amount,
        });
        console.log('[rz.webhook] sms attempt done');
        await sendOrderWhatsApp({
          phone,
          name,
          orderId: orderIdStr,
          amount,
        });
        console.log('[rz.webhook] whatsapp attempt done');
      } catch (smsErr) {
        console.error('[sms] Non-blocking send failed:', smsErr?.message || smsErr);
      }
    } else if (result.ok && result.alreadyPaid) {
      console.log('[rz.webhook] sms skipped: already paid');
    }
  } catch (err) {
    console.error('Razorpay webhook error:', err);
    res.status(500).send('Error');
    return;
  }
  res.status(200).send('OK');
}

module.exports = { handleRazorpayWebhook, completePaidOrder, verifyWebhookSignature };
