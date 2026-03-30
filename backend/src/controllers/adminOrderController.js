const Order = require('../models/Order');
const { createShipment } = require('../services/shiprocket');

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
    const { status, tracking } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    let didShiprocket = false;
    if (status && ALLOWED_STATUSES.includes(status)) {
      if (status === 'shipped') {
        const hasTracking = Boolean(order.tracking && String(order.tracking).trim());
        if (!order.shiprocketShipmentId && !hasTracking) {
          const orderWithUser = await Order.findById(req.params.id).populate('user', 'email');
          if (!orderWithUser) return res.status(404).json({ error: 'Order not found' });
          try {
            const shipment = await createShipment(orderWithUser);
            order.shiprocketShipmentId = String(shipment.shipment_id);
            order.tracking = shipment.awb_code || order.tracking;
            order.courier = shipment.courier_name || order.courier;
            order.status = 'shipped';
            didShiprocket = true;
          } catch (shipErr) {
            const msg = (shipErr && shipErr.message) ? String(shipErr.message) : 'Shiprocket shipment failed';
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
    if (tracking !== undefined && !didShiprocket) order.tracking = String(tracking);
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
