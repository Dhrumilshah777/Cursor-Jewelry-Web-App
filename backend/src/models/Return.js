const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema(
  {
    // Not unique: allow re-request if a previous return was rejected.
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['requested', 'approved', 'rejected', 'refunded'],
      default: 'requested',
    },
    reason: { type: String, default: '' },
    /** Shiprocket reverse pickup (created when admin approves). */
    shiprocketReturnShipmentId: { type: String, default: '' },
    shiprocketReturnOrderId: { type: String, default: '' },
    returnAwb: { type: String, default: '' },
    returnCourier: { type: String, default: '' },
    /** Last shipment_status from Shiprocket webhook (return leg). */
    returnShipmentStatus: { type: String, default: '' },
    shiprocketReturnError: { type: String, default: '' },
    /** First time Shiprocket reports return delivered to warehouse (idempotent). */
    returnDeliveredAt: { type: Date, default: null },
    /**
     * Set when we start Razorpay refund after deliver webhook — stops duplicate refunds
     * if Shiprocket retries the same event.
     */
    returnRefundInitiatedAt: { type: Date, default: null },
    /**
     * Razorpay lifecycle for this return refund (distinct from Order.refundStatus wording).
     * initiated = API refund created; processed = settlement (refund.processed webhook);
     * failed = Razorpay refund API error.
     */
    returnRefundStatus: {
      type: String,
      enum: ['', 'initiated', 'processed', 'failed'],
      default: '',
    },
    /** True after Shiprocket pickup API succeeds for reverse return shipment. */
    returnPickupScheduled: { type: Boolean, default: false },
    returnPickupScheduleError: { type: String, default: '' },
    returnPickupScheduledAt: { type: Date, default: null },
    /** Refund amount in paise (snapshot). */
    refundAmountPaise: { type: Number, default: 0 },
  },
  { timestamps: true }
);

returnSchema.index({ order: 1, createdAt: -1 });
returnSchema.index({ createdAt: -1 });
returnSchema.index({ status: 1, createdAt: -1 });
returnSchema.index({ shiprocketReturnShipmentId: 1 }, { sparse: true });
returnSchema.index({ returnAwb: 1 }, { sparse: true });

module.exports = mongoose.models.Return || mongoose.model('Return', returnSchema);

