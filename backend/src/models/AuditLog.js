const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actor: { type: Object, default: null }, // decoded admin token payload (non-sensitive subset)
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

