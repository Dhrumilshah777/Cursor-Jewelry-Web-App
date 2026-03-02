const Order = require('../models/Order');

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

exports.updateStatus = async (req, res) => {
  try {
    const { status, tracking } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (status && ['pending_payment', 'paid', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(status)) {
      order.status = status;
    }
    if (tracking !== undefined) order.tracking = String(tracking);
    await order.save();
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
