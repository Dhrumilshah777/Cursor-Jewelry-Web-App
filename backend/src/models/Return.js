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
  },
  { timestamps: true }
);

returnSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.models.Return || mongoose.model('Return', returnSchema);

