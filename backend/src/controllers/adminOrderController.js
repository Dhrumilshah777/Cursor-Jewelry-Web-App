const Order = require('../models/Order');
const { createShipment, retryAssignAwb } = require('../services/shiprocket');

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
      }
    }
    // Non-empty tracking/courier from the request always apply (after Shiprocket paths) so pasted AWB is never dropped.
    if (tracking !== undefined) {
      const t = String(tracking).trim();
      if (t) order.tracking = t;
    }
    if (courier !== undefined) {
      const c = String(courier).trim();
      if (c) order.courier = c;
    }
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
