const Order = require('../models/Order');
const Return = require('../models/Return');
const { createShipment, retryAssignAwb } = require('../services/shiprocket');
const { razorpayInstance } = require('../services/razorpay');
const { sendWhatsAppMessage } = require('../services/whatsappService');

exports.list = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .populate('user', 'name email');
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name email');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    res.status(500).json({ error: err.message });
  }
};

const ALLOWED_STATUSES = ['pending_payment', 'payment_cancelled', 'paid', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

exports.updateStatus = async (req, res) => {
  try {
    const { status, tracking, courier } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (status && ALLOWED_STATUSES.includes(status)) {
      if (status === 'shipped') {
        const hasTracking = Boolean(order.tracking && String(order.tracking).trim());
        const hasShipmentId = Boolean(order.shiprocketShipmentId && String(order.shiprocketShipmentId).trim());
        const bodyTrackingTrim =
          tracking !== undefined && String(tracking).trim() ? String(tracking).trim() : '';

        if (!hasShipmentId && !hasTracking) {
          const orderWithUser = await Order.findById(req.params.id).populate('user', 'email');
          if (!orderWithUser) return res.status(404).json({ error: 'Order not found' });
          try {
            const shipment = await createShipment(orderWithUser);
            order.shiprocketShipmentId = String(shipment.shipment_id);
            order.tracking = shipment.awb_code || order.tracking;
            order.courier = shipment.courier_name || order.courier;
            order.status = 'shipped';
            if (!String(order.tracking || '').trim()) {
              console.warn(
                '[order] Marked shipped but no AWB yet. Check server logs for [shiprocket] awb.assign.failed. ' +
                  `orderId=${order._id} shiprocketShipmentId=${order.shiprocketShipmentId}`
              );
            }
          } catch (shipErr) {
            const msg = (shipErr && shipErr.message) ? String(shipErr.message) : 'Shiprocket shipment failed';
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ error: msg });
          }
        } else if (hasShipmentId && !hasTracking && !bodyTrackingTrim) {
          try {
            const assigned = await retryAssignAwb(order.shiprocketShipmentId);
            order.tracking = assigned.awb_code || order.tracking;
            order.courier = assigned.courier_name || order.courier;
            order.status = 'shipped';
            if (!String(order.tracking || '').trim()) {
              console.warn(
                '[order] Retry AWB still empty after assign. Check [shiprocket] logs. ' +
                  `orderId=${order._id} shiprocketShipmentId=${order.shiprocketShipmentId}`
              );
            }
          } catch (shipErr) {
            const msg = (shipErr && shipErr.message) ? String(shipErr.message) : 'Shiprocket AWB retry failed';
            res.setHeader('Content-Type', 'application/json');
            return res.status(400).json({ error: msg });
          }
        } else {
          order.status = 'shipped';
        }
      } else {
        order.status = status;
        if (status === 'delivered' && !order.deliveredAt) {
          order.deliveredAt = new Date();
        }
      }
    }
    // Non-empty tracking/courier from the request always apply (after Shiprocket paths) so pasted AWB is never dropped.
    if (tracking !== undefined) {
      const t = String(tracking).trim();
      if (t) order.tracking = t;
    }
    if (courier !== undefined) {
      order.courier = String(courier).trim();
    }
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/orders/:id/deliver (manual testing flow)
exports.markDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'delivered') {
      return res.json({ ok: true, alreadyDelivered: true, order });
    }

    order.status = 'delivered';
    order.deliveredAt = new Date();
    await order.save();

    console.log('[order] delivered (manual)', { orderId: String(order._id) });

    // Non-blocking WhatsApp
    try {
      const phone = order?.shippingAddress?.phone || '';
      const name = order?.user?.name || order?.shippingAddress?.name || 'Customer';
      const body = `Hi ${name}, your order #${order._id} has been delivered 🎉\nYou can request a return within 7 days.`;
      await sendWhatsAppMessage({ phone, body });
    } catch (msgErr) {
      console.error('[whatsapp] deliver message failed (non-blocking):', msgErr?.message || msgErr);
    }

    return res.json({ ok: true, order });
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/admin/orders/:id/refund (manual testing flow)
exports.refundOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('user', 'name');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.isRefunded === true || order.status === 'refunded' || String(order.razorpayRefundId || '').trim()) {
      return res.status(409).json({ error: 'Order already refunded' });
    }
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Order not delivered' });
    }
    if (!razorpayInstance) {
      return res.status(500).json({ error: 'Payment service unavailable. Configure Razorpay keys.' });
    }
    const paymentId = String(order.razorpayPaymentId || '').trim();
    if (!paymentId) {
      return res.status(400).json({ error: 'Missing razorpayPaymentId on order' });
    }

    const paidInr = typeof order.totalAmount === 'number' && order.totalAmount > 0 ? order.totalAmount : order.subtotal;
    const amountPaise = Math.round((paidInr || 0) * 100);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'Invalid refund amount' });
    }

    console.log('[refund] requested', { orderId: String(order._id), paymentId, amountPaise });

    let refund;
    try {
      refund = await razorpayInstance.payments.refund(paymentId, { amount: amountPaise });
    } catch (refundErr) {
      console.error('[refund] failed', {
        orderId: String(order._id),
        paymentId,
        message: refundErr?.message || String(refundErr),
      });
      const desc = refundErr?.error?.description ? String(refundErr.error.description) : '';
      return res.status(502).json({ error: desc || 'Refund failed' });
    }
    const refundId = String(refund?.id || '');

    order.isRefunded = true;
    order.refundedAt = new Date();
    order.status = 'refunded';
    order.razorpayRefundId = refundId;
    order.refundStatus = 'requested';
    await order.save();

    const ret = await Return.findOne({ order: order._id });
    if (ret) {
      ret.status = 'refunded';
      await ret.save();
    }

    // WhatsApp when money reaches the customer is sent from Razorpay `refund.processed` webhook
    // (see razorpayWebhookController). Configure that event on the same webhook URL in Razorpay Dashboard.

    console.log('[refund] saved', { orderId: String(order._id), paymentId, refundId });
    return res.json({ ok: true, refundId, order });
  } catch (err) {
    if (err?.error?.description) {
      return res.status(502).json({ error: String(err.error.description) });
    }
    return res.status(500).json({ error: err.message });
  }
};
