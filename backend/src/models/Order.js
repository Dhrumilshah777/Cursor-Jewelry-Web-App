const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: String, required: true },
    image: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    line2: { type: String, default: '' },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [orderItemSchema],
    shippingAddress: { type: addressSchema, required: true },
    subtotal: { type: Number, required: true },
    // Amount actually paid by customer (INR). Currently equals subtotal; kept for future discounts/shipping.
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending_payment', 'payment_cancelled', 'paid', 'stock_failed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'refunded', 'cancelled'],
      default: 'pending_payment',
    },
    deliveredAt: { type: Date, default: null },
    idempotencyKey: { type: String, default: '' },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpayRefundId: { type: String, default: '' },
    refundStatus: {
      type: String,
      enum: ['', 'requested', 'failed', 'processed'],
      default: '',
    },
    isRefunded: { type: Boolean, default: false },
    refundedAt: { type: Date, default: null },
    /** Set when Twilio WhatsApp succeeds after Razorpay `refund.processed` (idempotent for webhook retries). */
    refundSettlementWhatsAppSentAt: { type: Date, default: null },
    tracking: { type: String, default: '' },
    courier: { type: String, default: '' },
    shiprocketShipmentId: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
