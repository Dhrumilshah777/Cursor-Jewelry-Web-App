const Order = require('../models/Order');
const Return = require('../models/Return');
const { processRefundAfterReturnDelivered } = require('../services/returnRefund');

function extractAwbFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const m = text.match(/awb\s*-\s*([A-Za-z0-9]+)/i);
  return m ? String(m[1]).trim() : '';
}

function extractAwb(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const direct =
    p.awb ??
    p.awb_code ??
    p.tracking ??
    p.tracking_number ??
    p.tracking_no ??
    p.courier_awb ??
    p.data?.awb ??
    p.data?.awb_code ??
    p.data?.courier_awb ??
    p.Shipment?.awb ??
    p.shipment?.awb;

  const awb = direct != null ? String(direct).trim() : '';
  if (awb) return awb;

  const msg =
    p.message ??
    p.error ??
    p.data?.message ??
    p.data?.error ??
    '';
  return extractAwbFromText(String(msg));
}

function extractCourierName(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const direct =
    p.courier_name ??
    p.courier ??
    p.courier_company_name ??
    p.courier_company ??
    p.courierCompanyName ??
    p.data?.courier_name ??
    p.data?.courier_company_name ??
    p.data?.courier ??
    p.Shipment?.courier ??
    '';
  const name = direct != null ? String(direct).trim() : '';
  return name;
}

function extractShipmentStatus(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const raw =
    p.shipment_status ??
    p.current_status ??
    p.status ??
    p.status_label ??
    p.data?.shipment_status ??
    p.data?.current_status ??
    p.Shipment?.status ??
    p.shipment?.shipment_status ??
    p.shipment?.status ??
    '';
  return raw != null ? String(raw).trim() : '';
}

function extractShipmentId(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const raw =
    p.shipment_id ??
    p.shipmentId ??
    p.shipment?.shipment_id ??
    p.shipment?.id ??
    p.data?.shipment_id ??
    p.data?.shipmentId ??
    p.Shipment?.id ??
    p.Shipment?.shipment_id ??
    '';
  const sid = raw != null ? String(raw).trim() : '';
  return sid;
}

/** Shiprocket may resend the same event — treat "delivered" (to warehouse on reverse) as terminal for refund. */
function isReturnDeliveredToWarehouseStatus(statusRaw) {
  const s = String(statusRaw || '').trim().toLowerCase();
  if (!s) return false;
  if (s === 'delivered') return true;
  if (s === 'received' || s.includes('received at')) return true;
  if (s.includes('delivered') && !s.includes('undelivered')) return true;
  return false;
}

/**
 * Shiprocket webhook — forward orders + return reverse pickups.
 * Idempotent: duplicate AWB/status webhooks are safe; refund runs once (Return.returnRefundInitiatedAt + Order guards).
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

    if (!shipmentId && !awb) {
      return res.status(200).json({ ok: true, ignored: true });
    }

    let ret = null;
    if (shipmentId) ret = await Return.findOne({ shiprocketReturnShipmentId: shipmentId });
    if (!ret && awb) ret = await Return.findOne({ returnAwb: awb });

    if (ret) {
      const incoming = String(shipmentStatus || '').trim();
      const stored = String(ret.returnShipmentStatus || '').trim();
      const awbFillNeeded = Boolean(awb && !String(ret.returnAwb || '').trim());
      const courierFillNeeded = Boolean(courierName && !String(ret.returnCourier || '').trim());
      const statusDuplicate = Boolean(incoming && stored && incoming === stored);

      let retChanged = false;
      if (incoming && !statusDuplicate) {
        ret.returnShipmentStatus = incoming;
        retChanged = true;
      }
      if (awbFillNeeded) {
        ret.returnAwb = awb;
        retChanged = true;
      }
      if (courierFillNeeded) {
        ret.returnCourier = courierName;
        retChanged = true;
      }
      if (retChanged) await ret.save();

      if (isReturnDeliveredToWarehouseStatus(shipmentStatus)) {
        await Return.updateOne(
          { _id: ret._id, returnDeliveredAt: null },
          { $set: { returnDeliveredAt: new Date() } }
        );

        const claimed = await Return.findOneAndUpdate(
          {
            _id: ret._id,
            returnRefundInitiatedAt: null,
            status: { $nin: ['refunded', 'rejected'] },
          },
          { $set: { returnRefundInitiatedAt: new Date() } },
          { new: true }
        );

        if (claimed) {
          const result = await processRefundAfterReturnDelivered(ret.order, ret._id);

          if (!result.ok && !result.skipped) {
            await Return.updateOne({ _id: ret._id }, { $unset: { returnRefundInitiatedAt: 1 } });
          } else if (
            result.skipped &&
            (result.reason === 'already_refunded_or_pending' || result.reason === 'race_order_already_updated')
          ) {
            await Return.updateOne({ _id: ret._id }, { $unset: { returnRefundInitiatedAt: 1 } });
          }
        }
      }

      return res.status(200).json({ ok: true, returnShipment: true, shipment_status: shipmentStatus || undefined });
    }

    let order = null;
    if (shipmentId) order = await Order.findOne({ shiprocketShipmentId: shipmentId });
    if (!order && awb) order = await Order.findOne({ tracking: awb });

    if (!order) {
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
    return res.status(200).json({ ok: false });
  }
};
