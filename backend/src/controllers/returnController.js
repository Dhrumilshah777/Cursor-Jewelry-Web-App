const Order = require('../models/Order');
const Return = require('../models/Return');
const { createReturnShipment, schedulePickupDetails } = require('../services/shiprocket');

function daysSince(date) {
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

// GET /api/returns (user)
exports.myReturns = async (req, res) => {
  try {
    const list = await Return.find({ user: req.userId }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/returns/order/:orderId (user)
exports.getForOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findOne({ _id: orderId, user: req.userId }).select('_id');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const ret = await Return.findOne({ order: order._id, user: req.userId }).sort({ createdAt: -1 });
    return res.json(ret || null);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/returns (user)
exports.create = async (req, res) => {
  try {
    const { orderId, reason } = req.body || {};
    if (!orderId) return res.status(400).json({ error: 'orderId required' });

    const order = await Order.findOne({ _id: orderId, user: req.userId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'delivered' || !order.deliveredAt) {
      return res.status(400).json({ error: 'Order must be delivered to request return' });
    }

    const days = daysSince(order.deliveredAt);
    if (days > 7) {
      return res.status(400).json({ error: 'Return window closed' });
    }

    // Allow retry only if a previous return was rejected.
    const existing = await Return.findOne({ order: order._id, status: { $ne: 'rejected' } });
    if (existing) {
      return res.status(409).json({ error: 'Return already requested for this order' });
    }

    console.log('[return] create', { orderId: String(order._id), userId: String(req.userId) });
    const created = await Return.create({
      order: order._id,
      user: req.userId,
      status: 'requested',
      reason: typeof reason === 'string' ? reason.trim() : '',
    });

    return res.status(201).json(created);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Order not found' });
    return res.status(500).json({ error: err.message });
  }
};

// PATCH /api/admin/returns/:id (admin)
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status (allowed: approved, rejected)' });
    }

    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });

    ret.status = status;

    if (status === 'approved' && !String(ret.shiprocketReturnShipmentId || '').trim()) {
      const order = await Order.findById(ret.order).populate('user', 'email name');
      if (!order) {
        return res.status(400).json({ error: 'Order missing for this return' });
      }
      ret.shiprocketReturnError = '';
      try {
        const pickupEmail = order.user?.email || '';
        const shipment = await createReturnShipment(order, ret, pickupEmail);
        ret.shiprocketReturnShipmentId = String(shipment.shipment_id);
        ret.shiprocketReturnOrderId = String(shipment.ship_order_id || '');
        ret.returnAwb = String(shipment.awb_code || '').trim();
        ret.returnCourier = String(shipment.courier_name || '').trim();
        ret.returnPickupScheduled = Boolean(shipment.returnPickupScheduled);
        ret.returnPickupScheduleError = String(shipment.returnPickupScheduleError || '').slice(0, 500);
        ret.returnPickupScheduledAt = ret.returnPickupScheduled ? new Date() : null;
      } catch (err) {
        const msg = err?.message || String(err);
        ret.shiprocketReturnError = msg.slice(0, 500);
        console.error('[return] shiprocket return shipment failed', { returnId: String(ret._id), message: msg });
        console.warn('[return.alert] shiprocket_return_error', {
          returnId: String(ret._id),
          orderId: String(ret.order),
          shiprocketReturnError: ret.shiprocketReturnError,
        });
      }
    }

    await ret.save();
    console.log('[return] admin.update', { returnId: String(ret._id), status: ret.status });

    return res.json(ret);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Return not found' });
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/returns (admin)
exports.adminList = async (req, res) => {
  try {
    const list = await Return.find()
      .sort({ createdAt: -1 })
      .populate('order', 'status subtotal totalAmount deliveredAt createdAt isRefunded razorpayRefundId refundedAt')
      .populate('user', 'name email');
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/admin/returns/:id/retry-shipment — rebuild Shiprocket return pickup after a failed approve (no need to toggle status). */
exports.retryShipment = async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    if (ret.status !== 'approved') {
      return res.status(400).json({ error: 'Return must be approved' });
    }

    const force = req.body?.force === true;
    if (String(ret.shiprocketReturnShipmentId || '').trim() && !force) {
      return res.status(409).json({
        error: 'Return shipment already exists. Send { "force": true } to clear and recreate (use with care).',
      });
    }

    if (force) {
      ret.shiprocketReturnShipmentId = '';
      ret.shiprocketReturnOrderId = '';
      ret.returnAwb = '';
      ret.returnCourier = '';
      ret.returnShipmentStatus = '';
      ret.returnPickupScheduled = false;
      ret.returnPickupScheduleError = '';
      ret.returnPickupScheduledAt = null;
    }

    const order = await Order.findById(ret.order).populate('user', 'email name');
    if (!order) return res.status(400).json({ error: 'Order missing for this return' });

    ret.shiprocketReturnError = '';
    try {
      const pickupEmail = order.user?.email || '';
      const shipment = await createReturnShipment(order, ret, pickupEmail);
      ret.shiprocketReturnShipmentId = String(shipment.shipment_id);
      ret.shiprocketReturnOrderId = String(shipment.ship_order_id || '');
      ret.returnAwb = String(shipment.awb_code || '').trim();
      ret.returnCourier = String(shipment.courier_name || '').trim();
      ret.returnPickupScheduled = Boolean(shipment.returnPickupScheduled);
      ret.returnPickupScheduleError = String(shipment.returnPickupScheduleError || '').slice(0, 500);
      ret.returnPickupScheduledAt = ret.returnPickupScheduled ? new Date() : null;
    } catch (err) {
      const msg = err?.message || String(err);
      ret.shiprocketReturnError = msg.slice(0, 500);
      console.error('[return] retry shipment failed', { returnId: String(ret._id), message: msg });
      console.warn('[return.alert] shiprocket_return_error', {
        returnId: String(ret._id),
        orderId: String(ret.order),
        shiprocketReturnError: ret.shiprocketReturnError,
      });
    }

    await ret.save();
    return res.json(ret);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Return not found' });
    return res.status(500).json({ error: err.message });
  }
};

/** POST /api/admin/returns/:id/retry-pickup — retry Shiprocket generate/pickup for reverse shipment. */
exports.retryReturnPickup = async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    if (ret.status !== 'approved') {
      return res.status(400).json({ error: 'Return must be approved' });
    }
    if (!String(ret.shiprocketReturnShipmentId || '').trim() || !String(ret.returnAwb || '').trim()) {
      return res.status(400).json({ error: 'Return shipment id and AWB required' });
    }
    const pickup = await schedulePickupDetails(ret.shiprocketReturnShipmentId);
    ret.returnPickupScheduled = pickup.pickupScheduled;
    ret.returnPickupScheduleError = String(pickup.pickupScheduleError || '').slice(0, 500);
    ret.returnPickupScheduledAt = ret.returnPickupScheduled ? new Date() : null;
    await ret.save();
    return res.json(ret);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Return not found' });
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/admin/returns/:id (admin)
exports.adminGetOne = async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id)
      .populate('order', 'status subtotal totalAmount deliveredAt createdAt isRefunded razorpayRefundId refundedAt')
      .populate('user', 'name email');
    if (!ret) return res.status(404).json({ error: 'Return not found' });
    return res.json(ret);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Return not found' });
    return res.status(500).json({ error: err.message });
  }
};

