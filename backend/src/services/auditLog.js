const AuditLog = require('../models/AuditLog');

function safeString(v) {
  if (v == null) return '';
  return String(v);
}

function actorFromReq(req) {
  // adminAuth sets req.admin; userAuth sets req.userId
  if (req?.admin) {
    const id = req.admin.id || req.admin.sub || req.admin.email || '';
    return { type: 'admin', id: safeString(id) };
  }
  if (req?.userId) {
    return { type: 'user', id: safeString(req.userId) };
  }
  return { type: 'system', id: '' };
}

/**
 * Non-blocking audit log. Never throws.
 * Keep meta lightweight (strings / small objects); do not include full payloads.
 */
async function audit(action, opts = {}) {
  try {
    const {
      entityType = 'other',
      entityId = '',
      correlationId = '',
      actor = { type: 'system', id: '' },
      dedupeKey = '',
      ip = '',
      userAgent = '',
      meta = {},
    } = opts;
    await AuditLog.create({
      action: safeString(action).slice(0, 120),
      dedupeKey: safeString(dedupeKey).slice(0, 160),
      entityType,
      entityId: safeString(entityId).slice(0, 80),
      correlationId: safeString(correlationId).slice(0, 80),
      actor: {
        type: actor?.type || 'system',
        id: safeString(actor?.id || '').slice(0, 80),
      },
      ip: safeString(ip).slice(0, 80),
      userAgent: safeString(userAgent).slice(0, 300),
      meta: {
        before: meta?.before ?? null,
        after: meta?.after ?? null,
        reason: safeString(meta?.reason || '').slice(0, 300),
        extra: meta?.extra && typeof meta.extra === 'object' ? meta.extra : {},
      },
    });
  } catch {
    // Never block main flow
  }
}

async function auditFromReq(req, action, opts = {}) {
  return audit(action, {
    ...opts,
    actor: opts.actor || actorFromReq(req),
    ip: opts.ip || req?.ip || '',
    userAgent: opts.userAgent || req?.headers?.['user-agent'] || '',
  });
}

module.exports = { audit, auditFromReq, actorFromReq };

