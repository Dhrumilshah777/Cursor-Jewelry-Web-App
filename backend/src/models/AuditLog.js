const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    entityType: {
      type: String,
      enum: ['order', 'return', 'payment', 'shipment', 'user', 'admin', 'system', 'other'],
      default: 'other',
      index: true,
    },
    entityId: { type: String, default: '', index: true },
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

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

