const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Return = require('../models/Return');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { razorpayInstance } = require('../services/razorpay');
const { sendOrderSMS, sendSms, sendOrderWhatsApp } = require('../services/twilioSms');
const { sendWhatsAppMessage } = require('../services/whatsappService');
const { audit } = require('../services/auditLog');

const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

async function notifyAdminPaidOrderOnce(orderId) {
  const adminPhone = String(process.env.ADMIN_WHATSAPP_NUMBER || '').trim();
  if (!adminPhone) return { ok: false, skipped: true, reason: 'missing_env' };

  const order = await Order.findById(orderId).lean();
  if (!order) return { ok: false, skipped: true, reason: 'order_not_found' };
  if (order.status !== 'paid') return { ok: false, skipped: true, reason: 'not_paid' };
  if (order.adminPaidWhatsAppSentAt) return { ok: true, skipped: true, reason: 'already_sent' };

  const shortId = String(order._id).slice(-8).toUpperCase();
  const amount = typeof order.totalAmount === 'number' && order.totalAmount > 0 ? order.totalAmount : order.subtotal;
  const itemSummary = Array.isArray(order.items) && order.items.length
    ? order.items.map((it) => `${it.name} × ${it.quantity}`).slice(0, 6).join(', ')
    : '—';

  const body =
    `New paid order received ✅\n` +
    `Order #${shortId}\n` +
    `Amount: ₹${Number(amount || 0).toFixed(2)}\n` +
    `Items: ${itemSummary}`;

  const sendResult = await sendWhatsAppMessage({ phone: adminPhone, body });
  if (sendResult.ok) {
    await Order.updateOne(
      { _id: order._id, adminPaidWhatsAppSentAt: null },
      { $set: { adminPaidWhatsAppSentAt: new Date() } }
    );
  }
  return sendResult;
}

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

    if (order.status !== 'pending_payment') {
      await session.abortTransaction();
      // Late capture safety:
      // - Never move non-pending orders to 'paid'
      // - Auto-refund ONLY for expired checkouts (payment_cancelled)
      // - Ensure refund is idempotent for duplicate webhook deliveries
      const incomingPaymentId = String(razorpayPaymentId || '').trim();
      const alreadyRecordedPaymentId = String(order.razorpayPaymentId || '').trim();
      const refundAlreadyRequested =
        (String(order.refundStatus || '') === 'requested' || String(order.refundStatus || '') === 'processed') &&
        Boolean(String(order.razorpayRefundId || '').trim());

      if (order.status !== 'payment_cancelled') {
        return { ok: false, reason: 'invalid_status' };
      }

      // If we already attempted/refunded this exact payment, don't do it again.
      if (incomingPaymentId && alreadyRecordedPaymentId === incomingPaymentId && refundAlreadyRequested) {
        return { ok: false, reason: 'invalid_status' };
      }

      // If a different payment id is already recorded, avoid refunding twice for different payments.
      if (incomingPaymentId && alreadyRecordedPaymentId && alreadyRecordedPaymentId !== incomingPaymentId) {
        console.error('[rz] late capture has different paymentId than recorded — skipping auto-refund', {
          orderId: String(orderId),
          status: String(order.status),
          recorded: alreadyRecordedPaymentId,
          incoming: incomingPaymentId,
        });
        return { ok: false, reason: 'invalid_status' };
      }

      let refundId = '';
      let refundStatus = '';
      if (razorpayInstance && incomingPaymentId) {
        try {
          const refund = await razorpayInstance.payments.refund(incomingPaymentId);
          refundId = String(refund?.id || '');
          refundStatus = 'requested';
          console.log(`Refund for late capture ${incomingPaymentId} (order ${orderId} status=${order.status}) refund ${refundId}`);
          void audit('refund.requested', {
            entityType: 'order',
            entityId: String(orderId),
            correlationId: String(orderId),
            dedupeKey: `refund.requested:order:${String(orderId)}:${refundId || incomingPaymentId}`,
            actor: { type: 'system', id: '' },
            meta: { extra: { refundId, reason: 'late_capture_after_expiry' } },
          });
        } catch (refundErr) {
          refundStatus = 'failed';
          console.error(`Refund failed for late capture ${incomingPaymentId}:`, refundErr?.message || refundErr);
          void audit('refund.failed', {
            entityType: 'order',
            entityId: String(orderId),
            actor: { type: 'system', id: '' },
            meta: { extra: { reason: 'late_capture_after_expiry', message: String(refundErr?.message || '').slice(0, 200) } },
          });
        }
      }

      await Order.findByIdAndUpdate(orderId, {
        $set: {
          latePaymentCapturedAt: new Date(),
          failureReason: 'payment_expired',
          razorpayPaymentId: incomingPaymentId || order.razorpayPaymentId,
          razorpayRefundId: refundId || order.razorpayRefundId,
          refundStatus: refundStatus || order.refundStatus,
        },
      }).catch(() => {});
      return { ok: false, reason: 'invalid_status' };
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
            void audit('refund.requested', {
              entityType: 'order',
              entityId: String(orderId),
              correlationId: String(orderId),
              dedupeKey: `refund.requested:order:${String(orderId)}:${refundId || razorpayPaymentId}`,
              actor: { type: 'system', id: '' },
              meta: { extra: { refundId, reason: 'stock_failed' } },
            });
          } catch (refundErr) {
            refundStatus = 'failed';
            console.error(`Failed to automatically refund payment ${razorpayPaymentId}:`, refundErr?.message || refundErr);
            void audit('refund.failed', {
              entityType: 'order',
              entityId: String(orderId),
              actor: { type: 'system', id: '' },
              meta: { extra: { reason: 'stock_failed', message: String(refundErr?.message || '').slice(0, 200) } },
            });
          }
        }

        await Order.findByIdAndUpdate(orderId, {
          status: 'stock_failed',
          failureReason: 'stock_unavailable',
          razorpayPaymentId,
          razorpayRefundId: refundId,
          refundStatus,
        });

        // Notify customer immediately when refund is initiated due to stock failure (idempotent).
        // We only mark sentAt after Twilio confirms send.
        try {
          const fresh = await Order.findById(orderId).populate('user', 'name');
          const alreadySent = Boolean(fresh?.refundInitiatedSmsSentAt);
          const shouldSend = fresh && !alreadySent && String(fresh.refundStatus || '') === 'requested';
          if (shouldSend) {
            const phone = fresh.shippingAddress?.phone || '';
            const body = 'Your refund has been initiated and will reflect in your account within 2–5 business days.';
            const r = await sendSms({ phone, body });
            if (r.ok) {
              await Order.updateOne({ _id: fresh._id, refundInitiatedSmsSentAt: null }, { $set: { refundInitiatedSmsSentAt: new Date() } });
            }
          }
        } catch (msgErr) {
          console.warn('[sms] refund initiated message failed (non-blocking):', msgErr?.message || msgErr);
        }

        // WhatsApp: refund initiated (idempotent).
        try {
          const fresh = await Order.findById(orderId).populate('user', 'name');
          const alreadySent = Boolean(fresh?.refundInitiatedWhatsAppSentAt);
          const shouldSend = fresh && !alreadySent && String(fresh.refundStatus || '') === 'requested';
          if (shouldSend) {
            const phone = fresh.shippingAddress?.phone || '';
            const body = 'Your refund has been initiated and will reflect in your account within 2–5 business days.';
            const sendResult = await sendWhatsAppMessage({ phone, body });
            if (sendResult.ok) {
              await Order.updateOne(
                { _id: fresh._id, refundInitiatedWhatsAppSentAt: null },
                { $set: { refundInitiatedWhatsAppSentAt: new Date() } }
              );
            }
          }
        } catch (msgErr) {
          console.warn('[whatsapp] refund initiated message failed (non-blocking):', msgErr?.message || msgErr);
        }

        return { ok: false, reason: 'insufficient_stock', productId: it.productId };
      }
    }

    order.status = 'paid';
    order.razorpayPaymentId = razorpayPaymentId;
    await order.save({ session });
    void audit('payment.success', {
      entityType: 'payment',
      entityId: String(razorpayPaymentId),
      actor: { type: 'system', id: '' },
      correlationId: String(order._id),
      meta: { extra: { orderId: String(order._id), razorpayOrderId: String(order.razorpayOrderId || '') } },
    });

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
 * Razorpay `refund.processed` — refund reached customer's bank/card per Razorpay.
 * Sends WhatsApp once per order (idempotent on webhook retries).
 */
async function handleRefundProcessedPayload(payload) {
  const refund = payload.payload?.refund?.entity;
  const status = String(refund?.status || '').toLowerCase();
  if (!refund || status !== 'processed') {
    console.log('[rz.webhook] refund.processed skipped', { hasRefund: Boolean(refund), status: refund?.status });
    return;
  }
  const paymentId = String(refund.payment_id || '').trim();
  if (!paymentId) {
    console.warn('[rz.webhook] refund.processed missing payment_id');
    return;
  }

  const order = await Order.findOne({ razorpayPaymentId: paymentId }).populate('user', 'name');
  if (!order) {
    console.warn('[rz.webhook] refund.processed no order for payment_id', { paymentId: `${paymentId.slice(0, 8)}…` });
    return;
  }

  await Order.updateOne(
    { _id: order._id },
    { $set: { refundStatus: 'processed' } }
  );
  void audit('refund.processed', {
    entityType: 'order',
    entityId: String(order._id),
    actor: { type: 'system', id: '' },
    correlationId: String(order._id),
    meta: { extra: { paymentId: paymentId.slice(0, 10) + '…' } },
  });
  void audit('return.refund_completed', {
    entityType: 'return',
    entityId: String(order._id),
    actor: { type: 'system', id: '' },
    correlationId: String(order._id),
    dedupeKey: `return.refund_completed:order:${String(order._id)}:${paymentId}`,
    meta: { extra: { paymentId: paymentId.slice(0, 10) + '…' } },
  });

  await Return.updateMany(
    {
      order: order._id,
      returnRefundStatus: 'initiated',
    },
    { $set: { returnRefundStatus: 'processed' } }
  );

  // Twilio SMS: refund processed confirmation (idempotent on webhook retries).
  try {
    const alreadySent = Boolean(order.refundProcessedSmsSentAt);
    if (!alreadySent) {
      const phone = order.shippingAddress?.phone || '';
      const name = order.user?.name || order.shippingAddress?.name || 'Customer';
      const orderIdStr = String(order._id);
      const body =
        `Hi ${name}, your refund for order #${orderIdStr} has been successfully processed by our payment partner. ` +
        'It may take a short time to reflect in your bank account depending on your payment method.';
      const r = await sendSms({ phone, body });
      if (r.ok) {
        await Order.updateOne({ _id: order._id, refundProcessedSmsSentAt: null }, { $set: { refundProcessedSmsSentAt: new Date() } });
      }
    }
  } catch (msgErr) {
    console.warn('[sms] refund processed message failed (non-blocking):', msgErr?.message || msgErr);
  }

  if (order.refundSettlementWhatsAppSentAt) {
    console.log('[rz.webhook] refund.processed whatsapp already sent', { orderId: String(order._id) });
    return;
  }

  const phone = order.shippingAddress?.phone || '';
  const name = order.user?.name || order.shippingAddress?.name || 'Customer';
  const body =
    `Hi ${name}, your refund for order #${order._id} has been successfully processed by our payment partner. ` +
    'It may take a short time to reflect in your bank account depending on your payment method.';

  const sendResult = await sendWhatsAppMessage({ phone, body });
  if (sendResult.ok) {
    await Order.updateOne(
      { _id: order._id, refundSettlementWhatsAppSentAt: null },
      { $set: { refundSettlementWhatsAppSentAt: new Date() } }
    );
    console.log('[rz.webhook] refund.processed whatsapp sent', { orderId: String(order._id) });
  } else {
    console.warn('[rz.webhook] refund.processed whatsapp not sent (will retry on webhook redelivery)', {
      orderId: String(order._id),
      reason: sendResult.reason || sendResult.error || sendResult.skipped,
    });
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

  if (payload.event === 'refund.processed') {
    try {
      await handleRefundProcessedPayload(payload);
    } catch (err) {
      console.error('[rz.webhook] refund.processed handler error:', err);
      res.status(500).send('Error');
      return;
    }
    res.status(200).send('OK');
    return;
  }

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
    if (!result.ok && result.reason === 'invalid_status') {
      console.error(
        'Razorpay webhook: order',
        order._id,
        'payment captured but order was not pending_payment (auto-refund attempted)'
      );
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

      // Admin WhatsApp notification (ONLY for paid orders, idempotent).
      try {
        await notifyAdminPaidOrderOnce(order._id.toString());
      } catch (adminErr) {
        console.warn('[whatsapp] admin paid notification failed (non-blocking):', adminErr?.message || adminErr);
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
