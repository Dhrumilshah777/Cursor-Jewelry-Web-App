const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    /** Legacy unit price in INR string (kept for UI/backward compatibility). */
    price: { type: String, required: true },
    /** Unit price in paise (source of truth for money math). */
    unitPricePaise: { type: Number, default: 0 },
    /** Pricing snapshot captured at order creation time (per unit, unless noted). */
    pricing: {
      pricingSource: { type: String, enum: ['fixed', 'gold_dynamic', 'unknown'], default: 'unknown' },
      pricingVersion: { type: Number, default: 1 },
      fixedPricePaise: { type: Number, default: 0 },
      goldRatePerGramPaise: { type: Number, default: 0 },
      netWeightGrams: { type: Number, default: 0 },
      goldValuePaise: { type: Number, default: 0 },
      makingChargeType: { type: String, default: '' }, // 'percentage' | 'fixed'
      makingChargeValue: { type: Number, default: 0 }, // percent OR fixed paise (depending on type)
      makingChargePaise: { type: Number, default: 0 },
      subtotalPaise: { type: Number, default: 0 },
      gstPercent: { type: Number, default: 3 },
      gstPaise: { type: Number, default: 0 },
      totalPaise: { type: Number, default: 0 },
      goldPurity: { type: String, default: '' },
    },
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
    currency: { type: String, default: 'INR' },
    items: [orderItemSchema],
    shippingAddress: { type: addressSchema, required: true },
    /** Subtotal (excluding GST) in paise. */
    subtotalPaise: { type: Number, default: 0 },
    /** GST percent for the order (snapshot). */
    gstPercent: { type: Number, default: 3 },
    /** GST amount in paise. */
    gstAmountPaise: { type: Number, default: 0 },
    /** Optional promotions / shipping (future-proofing). */
    discountPaise: { type: Number, default: 0 },
    shippingPaise: { type: Number, default: 0 },
    /** Total paid in paise (includes GST). */
    totalAmountPaise: { type: Number, default: 0 },
    /** Final payable in paise (total + shipping - discount). */
    finalAmountPaise: { type: Number, default: 0 },
    subtotal: { type: Number, required: true },
    // Amount actually paid by customer (INR). Currently equals subtotal; kept for future discounts/shipping.
    totalAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending_payment', 'payment_cancelled', 'paid', 'stock_failed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'refunded', 'cancelled'],
      default: 'pending_payment',
    },
    /** Why payment failed / order could not be completed (debug + UI). */
    failureReason: {
      type: String,
      enum: ['', 'stock_unavailable', 'payment_expired', 'signature_invalid'],
      default: '',
    },
    /**
     * Set when a Razorpay payment capture arrives AFTER the order left pending_payment
     * (typically due to auto-expiry). Helps explain why an auto-refund happened.
     */
    latePaymentCapturedAt: { type: Date, default: null },
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
    /** True after Shiprocket `courier/generate/pickup` succeeds for forward shipment (avoids duplicate calls). */
    pickupScheduled: { type: Boolean, default: false },
    pickupScheduleError: { type: String, default: '' },
    pickupScheduledAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Indexes for common queries and scale.
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ shiprocketShipmentId: 1 }, { sparse: true });
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.models.Order || mongoose.model('Order', orderSchema);
