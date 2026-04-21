const Order = require('../models/Order');
const Return = require('../models/Return');
const Product = require('../models/Product');
const { razorpayInstance } = require('./razorpay');
const { audit } = require('./auditLog');

/** Full-order refund only; partial / per-line amounts can extend this later. */

function orderHasRefundTerminalState(order) {
  if (!order) return true;
  if (order.isRefunded === true) return true;
  if (order.status === 'refunded') return true;
  if (order.refundStatus === 'processed') return true;
  return Boolean(String(order.razorpayRefundId || '').trim());
}

/**
 * Razorpay refund + restock after Shiprocket confirms return delivered to warehouse.
 * Caller must enforce concurrency (e.g. atomic claim on Return); function also guards with order state.
 */
async function processRefundAfterReturnDelivered(orderId, returnMongoId) {
  if (!razorpayInstance) {
    console.error('[return.refund] Razorpay keys missing');
    return { ok: false, reason: 'razorpay_not_configured' };
  }

  const order = await Order.findById(orderId);
  if (!order) return { ok: false, reason: 'order_not_found' };

  if (orderHasRefundTerminalState(order)) {
    return { ok: true, skipped: true, reason: 'already_refunded_or_pending' };
  }

  const paymentId = String(order.razorpayPaymentId || '').trim();
  if (!paymentId) return { ok: false, reason: 'missing_razorpay_payment_id' };

  const amountPaise =
    typeof order.totalAmountPaise === 'number' && order.totalAmountPaise > 0
      ? Math.round(order.totalAmountPaise)
      : Math.round(((typeof order.totalAmount === 'number' && order.totalAmount > 0 ? order.totalAmount : order.subtotal) || 0) * 100);
  if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
    return { ok: false, reason: 'invalid_refund_amount' };
  }

  let refund;
  try {
    refund = await razorpayInstance.payments.refund(paymentId, { amount: amountPaise });
  } catch (refundErr) {
    console.error('[return.refund] Razorpay refund failed', {
      orderId: String(order._id),
      message: refundErr?.message || refundErr,
    });
    await Return.findOneAndUpdate(
      { _id: returnMongoId },
      { $set: { returnRefundStatus: 'failed' } }
    );
    void audit('refund.failed', {
      entityType: 'order',
      entityId: String(order._id),
      actor: { type: 'system', id: '' },
      meta: { extra: { amountPaise, message: String(refundErr?.message || '').slice(0, 200) } },
    });
    return { ok: false, reason: 'razorpay_refund_failed', error: refundErr?.message || String(refundErr) };
  }

  const refundId = String(refund?.id || '');

  for (const it of order.items || []) {
    const qty = it.quantity || 0;
    if (qty < 1) continue;
    await Product.findByIdAndUpdate(it.productId, { $inc: { stock: qty } });
  }

  const updatedOrder = await Order.findOneAndUpdate(
    {
      _id: order._id,
      isRefunded: { $ne: true },
      status: { $ne: 'refunded' },
      refundStatus: { $ne: 'processed' },
      $or: [{ razorpayRefundId: { $exists: false } }, { razorpayRefundId: null }, { razorpayRefundId: '' }],
    },
    {
      $set: {
        isRefunded: true,
        refundedAt: new Date(),
        status: 'refunded',
        razorpayRefundId: refundId,
        refundStatus: 'requested',
      },
    },
    { new: true }
  );

  if (!updatedOrder) {
    return { ok: true, skipped: true, reason: 'race_order_already_updated' };
  }

  await Return.findOneAndUpdate(
    { _id: returnMongoId },
    { $set: { status: 'refunded', returnRefundStatus: 'initiated', refundAmountPaise: amountPaise } }
  );
  void audit('refund.requested', {
    entityType: 'order',
    entityId: String(order._id),
    actor: { type: 'system', id: '' },
    meta: { extra: { amountPaise, refundId } },
  });

  return { ok: true, refundId };
}

module.exports = { processRefundAfterReturnDelivered, orderHasRefundTerminalState };
