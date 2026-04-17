const Order = require('../models/Order');
const Return = require('../models/Return');

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
    await ret.save();
    console.log('[return] admin.update', { returnId: String(ret._id), status: ret.status });

    return res.json(ret);
  } catch (err) {
    if (err.name === 'CastError') return res.status(404).json({ error: 'Return not found' });
    return res.status(500).json({ error: err.message });
  }
};

