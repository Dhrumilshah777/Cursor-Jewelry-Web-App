const Order = require('../models/Order');

function extractAwbFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const m = text.match(/awb\s*-\s*([A-Za-z0-9]+)/i);
  return m ? String(m[1]).trim() : '';
}

function extractAwb(payload) {
  const direct =
    payload?.awb ??
    payload?.awb_code ??
    payload?.tracking ??
    payload?.tracking_number ??
    payload?.tracking_no ??
    payload?.courier_awb ??
    payload?.data?.awb ??
    payload?.data?.awb_code ??
    payload?.data?.courier_awb;

  const awb = direct != null ? String(direct).trim() : '';
  if (awb) return awb;

  const msg =
    payload?.message ??
    payload?.error ??
    payload?.data?.message ??
    payload?.data?.error ??
    '';
  return extractAwbFromText(String(msg));
}

function extractCourierName(payload) {
  const direct =
    payload?.courier_name ??
    payload?.courier ??
    payload?.courier_company_name ??
    payload?.courier_company ??
    payload?.courierCompanyName ??
    payload?.data?.courier_name ??
    payload?.data?.courier_company_name ??
    payload?.data?.courier ??
    '';
  const name = direct != null ? String(direct).trim() : '';
  return name;
}

function extractShipmentStatus(payload) {
  return (
    payload?.shipment_status ??
    payload?.current_status ??
    payload?.status ??
    payload?.status_label ??
    payload?.data?.shipment_status ??
    payload?.data?.current_status ??
    ''
  );
}

function extractShipmentId(payload) {
  const raw =
    payload?.shipment_id ??
    payload?.shipmentId ??
    payload?.shipment?.shipment_id ??
    payload?.shipment?.id ??
    payload?.data?.shipment_id ??
    payload?.data?.shipmentId ??
    '';
  const sid = raw != null ? String(raw).trim() : '';
  return sid;
}

/**
 * Shiprocket webhook for AWB assignment / shipment updates.
 *
 * POST /api/webhooks/shiprocket
 *
 * Behavior:
 * - Extract AWB + shipment status from payload
 * - Find Order by shiprocketShipmentId OR by tracking(AWB)
 * - If order.tracking is empty, set it to AWB (never overwrite existing tracking)
 * - Idempotent: safe to call multiple times
 */
exports.handleShiprocketWebhook = async (req, res) => {
  try {
    const payload = req.body || {};

    const awb = extractAwb(payload);
    const courierName = extractCourierName(payload);
    const shipmentStatus = extractShipmentStatus(payload);
    const shipmentId = extractShipmentId(payload);

    if (awb) {
      console.log('Webhook AWB received:', awb);
    }

    // Must have at least one identifier to find the order
    if (!shipmentId && !awb) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    let order = null;
    if (shipmentId) order = await Order.findOne({ shiprocketShipmentId: shipmentId });
    if (!order && awb) order = await Order.findOne({ tracking: awb });

    if (!order) {
      // Ack so Shiprocket doesn't keep retrying
      return res.status(200).json({ ok: true, notFound: true });
    }

    let changed = false;
    if (awb && !String(order.tracking || '').trim()) {
      order.tracking = awb;
      changed = true;
    }
    if (courierName && !String(order.courier || '').trim()) {
      order.courier = courierName;
      changed = true;
    }
    if (changed) await order.save();

    return res.status(200).json({ ok: true, shipment_status: shipmentStatus || undefined });
  } catch (err) {
    console.error('Shiprocket webhook error:', err?.message || err);
    // Ack to prevent repeated retries; logs will show the error
    return res.status(200).json({ ok: false });
  }
};

