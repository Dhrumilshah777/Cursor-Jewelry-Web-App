const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    /**
     * Optional dedupe key for "log once" events (e.g. refund.requested).
     * When set, it must be unique.
     */
    dedupeKey: { type: String, default: '' },
    entityType: {
      type: String,
      enum: ['order', 'return', 'payment', 'shipment', 'user', 'admin', 'system', 'other'],
      default: 'other',
      index: true,
    },
    entityId: { type: String, default: '', index: true },
    /** Correlate cross-entity events (e.g. payment/shipment/refund for the same order). */
    correlationId: { type: String, default: '', index: true },
    actor: {
      type: {
        type: String,
        enum: ['system', 'admin', 'user'],
        default: 'system',
      },
      id: { type: String, default: '' },
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    meta: {
      before: { type: Object, default: null },
      after: { type: Object, default: null },
      reason: { type: String, default: '' },
      extra: { type: Object, default: {} },
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ correlationId: 1, createdAt: -1 });
auditLogSchema.index(
  { dedupeKey: 1 },
  { unique: true, sparse: true, partialFilterExpression: { dedupeKey: { $type: 'string', $gt: '' } } }
);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

