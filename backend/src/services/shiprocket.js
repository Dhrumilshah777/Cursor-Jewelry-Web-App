/**
 * Shiprocket API v2 – login and create adhoc order (shipment).
 * Env: SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_PICKUP_LOCATION (optional, default: Home)
 */

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

const SHIPROCKET_DEBUG =
  String(process.env.SHIPROCKET_DEBUG || '').toLowerCase() === 'true' ||
  String(process.env.SHIPROCKET_DEBUG || '') === '1';

function srLog(event, meta = {}) {
  if (!SHIPROCKET_DEBUG) return;
  // Avoid logging PII (full address/phone/email). Keep only operational debug fields.
  console.log(`[shiprocket] ${event}`, meta);
}

/** Always-on operational log (no PII). Use for AWB issues that are otherwise silent in production. */
function srWarn(event, meta = {}) {
  console.warn(`[shiprocket] ${event}`, meta);
}

let cachedToken = null;
let tokenExpiry = 0;
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - TOKEN_BUFFER_MS) {
    return cachedToken;
  }
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new Error('SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD are required');
  }
  const res = await fetch(`${SHIPROCKET_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.token) {
    throw new Error(data.message || data.error || 'Shiprocket login failed');
  }
  cachedToken = data.token;
  tokenExpiry = Date.now() + (data.expiry || 10 * 24 * 60 * 60) * 1000;
  return cachedToken;
}

/**
 * Create adhoc order (shipment) in Shiprocket.
 * @param {object} order - Mongoose order doc with items, shippingAddress, _id, createdAt
 * @returns {Promise<{ shipment_id: number, awb_code: string, courier_name: string }>}
 */
function toTenDigitPhone(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits.padStart(10, '0').slice(0, 10) || '0000000000';
}

function toPincodeInt(val) {
  const n = parseInt(String(val || '0').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 395009;
}

function truncate(str, max) {
  const s = String(str || '').trim();
  return s.length > max ? s.slice(0, max) : s;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Shiprocket assign/AWB must use shipment_id from create response — never substitute order_id. */
function extractShipmentIdFromCreateResponse(data) {
  const raw = data?.data || data?.order || data;
  const candidates = [
    raw?.shipment_id,
    data?.shipment_id,
    data?.order?.shipment_id,
    data?.data?.shipment_id,
    data?.data?.order?.shipment_id,
    raw?.shipments?.[0]?.shipment_id,
    raw?.shipments?.[0]?.id,
    data?.shipments?.[0]?.shipment_id,
    data?.shipments?.[0]?.id,
  ];
  for (const c of candidates) {
    if (c != null && c !== '' && (typeof c === 'number' || (typeof c === 'string' && String(c).trim() !== ''))) {
      return c;
    }
  }
  return null;
}

const PRE_ASSIGN_AW_DELAY_MS = 2000;
const ASSIGN_AW_RETRY_DELAY_MS = 2000;
const ASSIGN_AW_MAX_ATTEMPTS = 3;

async function createShipment(order) {
  const token = await getToken();
  const addr = order.shippingAddress || {};
  const orderId = order._id.toString();
  const orderDate = new Date(order.createdAt || Date.now()).toISOString().split('T')[0];

  const billingAddress1 = truncate(addr.line1 || 'Address', 95);
  const billingAddress2 = truncate(addr.line2 || '', 95);
  const billingPincode = toPincodeInt(addr.pincode);
  const billingPhone = toTenDigitPhone(addr.phone);

  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION || 'Home';
  // Shiprocket expects order_id as numeric string (avoid hex/letters) for compatibility with assign AWB etc.
  const numericOrderId = String(
    (Date.parse(order.createdAt || Date.now()) || Date.now()) + parseInt(orderId.slice(-6), 16)
  ).slice(0, 50);
  const payload = {
    order_id: numericOrderId,
    order_date: orderDate,
    pickup_location: pickupLocation,
    billing_customer_name: truncate(addr.name || 'Customer', 50),
    billing_last_name: '',
    billing_address: billingAddress1,
    billing_address_2: billingAddress2,
    billing_city: truncate(addr.city || 'City', 50),
    billing_pincode: billingPincode,
    billing_state: truncate(addr.state || 'State', 50),
    billing_country: 'India',
    billing_email: (order.user?.email || 'customer@example.com').slice(0, 100),
    billing_phone: billingPhone,
    shipping_is_billing: 1,
    shipping_customer_name: truncate(addr.name || 'Customer', 50),
    shipping_last_name: '',
    shipping_address: billingAddress1,
    shipping_address_2: billingAddress2,
    shipping_city: truncate(addr.city || 'City', 50),
    shipping_pincode: billingPincode,
    shipping_state: truncate(addr.state || 'State', 50),
    shipping_country: 'India',
    shipping_phone: billingPhone,
    order_items: (order.items || []).map((item, i) => ({
      name: truncate(item.name || 'Product', 100),
      sku: String(item.productId || `item-${i + 1}`).slice(0, 50),
      units: Math.max(1, parseInt(item.quantity, 10) || 1),
      selling_price: Math.max(0.01, parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0),
    })),
    sub_total: Number(order.subtotal) || 0,
    payment_method: 'Prepaid',
    weight: 0.5,
    length: 15,
    breadth: 15,
    height: 5,
  };

  const res = await fetch(`${SHIPROCKET_BASE}/orders/create/adhoc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const parts = ['Create order failed: ' + (data.message || data.error || 'Shiprocket order create failed')];
    if (Array.isArray(data.errors)) parts.push(data.errors.join('; '));
    else if (data.errors && typeof data.errors === 'object') parts.push(JSON.stringify(data.errors));
    const bodyStr = JSON.stringify(data);
    if (bodyStr.length > 0 && bodyStr.length < 400) parts.push('Response: ' + bodyStr);
    throw new Error(parts.join(' — '));
  }

  // Shiprocket success: status_code 1; ids at top level or in data/order
  const raw = data.data || data.order || data;
  const srOrderId =
    raw.order_id ?? raw.id ?? data.order_id ?? data.order?.id ?? data.id;

  const shipmentIdRaw = extractShipmentIdFromCreateResponse(data);
  if (shipmentIdRaw == null) {
    const hint = JSON.stringify(data).slice(0, 400);
    throw new Error(`Shipment ID missing from Shiprocket create response. Response (truncated): ${hint}`);
  }

  const shipmentIdStr = String(shipmentIdRaw);

  const awbFromCreate = data.order?.awb_code ?? data.awb_code ?? data.courier_awb ?? '';
  const courierFromCreate = data.order?.courier_name ?? data.courier_name ?? data.courier ?? '';
  if (awbFromCreate) {
    return {
      shipment_id: shipmentIdStr,
      awb_code: String(awbFromCreate),
      courier_name: String(courierFromCreate),
    };
  }

  const sid = parseInt(String(shipmentIdRaw), 10);
  const oid = srOrderId != null ? parseInt(String(srOrderId), 10) : NaN;
  const validSid = !Number.isNaN(sid) && sid > 0 ? sid : null;
  const validOid = !Number.isNaN(oid) && oid > 0 ? oid : null;

  if (!validSid) {
    throw new Error(`Invalid shipment_id from Shiprocket: ${shipmentIdStr}`);
  }

  await delay(PRE_ASSIGN_AW_DELAY_MS);

  // Let Shiprocket choose the courier. Passing courier_id from serviceability often 400s
  // (courier not allowed for this shipment at assign time vs generic "possible" list).
  const assignBody = { shipment_id: validSid };

  let lastAssignData = null;

  for (let attempt = 1; attempt <= ASSIGN_AW_MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await delay(ASSIGN_AW_RETRY_DELAY_MS);

    srLog('awb.assign.request', {
      attempt,
      max: ASSIGN_AW_MAX_ATTEMPTS,
      shipment_id: validSid,
      body: assignBody,
    });

    const assignRes = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(assignBody),
    });
    lastAssignData = await assignRes.json().catch(() => ({}));

    const awb =
      lastAssignData.awb_code ?? lastAssignData.data?.awb_code ?? lastAssignData.courier_awb ?? '';
    const courier =
      lastAssignData.courier_name ?? lastAssignData.data?.courier_name ?? lastAssignData.courier ?? '';

    if (assignRes.ok && String(awb || '').trim()) {
      srLog('awb.assign.success', {
        attempt,
        shipment_id: shipmentIdStr,
        awb_code: String(awb),
        courier_name: courier ? String(courier) : '',
      });
      return {
        shipment_id: shipmentIdStr,
        awb_code: String(awb),
        courier_name: String(courier),
      };
    }

    const errMsg = lastAssignData?.message || lastAssignData?.error || 'awb assign failed';
    const errExtra =
      Array.isArray(lastAssignData?.errors)
        ? lastAssignData.errors.join('; ')
        : lastAssignData?.errors && typeof lastAssignData.errors === 'object'
          ? JSON.stringify(lastAssignData.errors).slice(0, 300)
          : '';
    const responseBodyTruncated = JSON.stringify(lastAssignData).slice(0, 1500);
    srLog('awb.assign.error', {
      attempt,
      status: assignRes.status,
      message: errMsg,
      shipment_id: shipmentIdStr,
      response_body: responseBodyTruncated,
    });
    if (!assignRes.ok) {
      srWarn('awb.assign.error_full', {
        attempt,
        http_status: assignRes.status,
        shipment_id: shipmentIdStr,
        response_body: responseBodyTruncated,
      });
    }
    if (attempt === ASSIGN_AW_MAX_ATTEMPTS) {
      srWarn('awb.assign.failed', {
        attempts: ASSIGN_AW_MAX_ATTEMPTS,
        http_status: assignRes.status,
        message: errMsg,
        detail: errExtra || undefined,
        shipment_id: shipmentIdStr,
        order_id: validOid ?? null,
        response_body: responseBodyTruncated,
      });
    } else {
      srWarn('awb.assign.retry', {
        attempt,
        next_in_ms: ASSIGN_AW_RETRY_DELAY_MS,
        http_status: assignRes.status,
        message: errMsg,
      });
    }

    if (assignRes.ok && !String(awb || '').trim()) {
      srWarn('awb.assign.ok_but_no_awb_in_body', {
        attempt,
        shipment_id: shipmentIdStr,
        order_id: validOid ?? null,
        response_status_code: lastAssignData?.status_code ?? lastAssignData?.status ?? undefined,
        message: lastAssignData?.message || lastAssignData?.error || undefined,
      });
    }
  }

  // Order exists in Shiprocket; AWB not assigned after retries — admin can finish in dashboard.
  return {
    shipment_id: shipmentIdStr,
    awb_code: '',
    courier_name: '',
  };
}

/**
 * Check courier serviceability for a delivery pincode.
 * Uses Shiprocket GET /courier/serviceability with JSON body (pickup_postcode, delivery_postcode, weight, cod, mode).
 * @param {string|number} deliveryPincode - Customer delivery pincode
 * @param {string|number} [pickupPincode] - Origin pincode (default from env SHIPROCKET_PICKUP_PINCODE or 395003 Surat)
 * @returns {Promise<{ serviceable: boolean, estimatedDays: number | null, availableCouriers: Array<{ name: string, etd: string }> }>}
 */
async function checkServiceability(deliveryPincode, pickupPincode = null) {
  const delivery = parseInt(String(deliveryPincode || '').replace(/\D/g, ''), 10);
  // Warehouse pickup pincode: Surat 395003 (env SHIPROCKET_PICKUP_PINCODE overrides)
  const pickup =
    pickupPincode != null
      ? parseInt(String(pickupPincode).replace(/\D/g, ''), 10)
      : parseInt(String(process.env.SHIPROCKET_PICKUP_PINCODE || '395003').replace(/\D/g, ''), 10);
  if (!Number.isFinite(delivery) || delivery <= 0) {
    return { serviceable: false, estimatedDays: null, availableCouriers: [] };
  }
  const validPickup = Number.isFinite(pickup) && pickup > 0 ? pickup : 395003;
  // Same pincode (e.g. warehouse) often returns no couriers; treat as local delivery 1–2 days
  if (delivery === validPickup) {
    return { serviceable: true, estimatedDays: 2, availableCouriers: [{ name: 'Local', etd: '1-2 days' }] };
  }
  const token = await getToken();
  // Shiprocket domestic serviceability: GET with query params (no body - GET with body is rejected by many runtimes)
  const params = new URLSearchParams({
    pickup_postcode: String(validPickup),
    delivery_postcode: String(delivery),
    weight: '0.5',
    cod: '0',
    mode: 'Surface',
  });
  const res = await fetch(`${SHIPROCKET_BASE}/courier/serviceability/?${params.toString()}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  // Response may be { data: { available_courier_companies: [...] } } or { available_courier_companies: [...] } or nested under data.data
  const companies =
    data.data?.available_courier_companies ??
    data.data?.data?.available_courier_companies ??
    data.available_courier_companies ??
    [];
  const availableCouriers = Array.isArray(companies)
    ? companies.map((c) => ({ name: c.name || c.courier_name || 'Courier', etd: c.etd || c.etd_min_max || c.estimated_delivery_days || '' }))
    : [];
  const MAX_DAYS = 30; // cap to avoid wrong ETD (e.g. year codes) showing year 2250
  let estimatedDays = null;
  for (const c of availableCouriers) {
    const etdStr = String(c.etd || '').trim();
    const match = etdStr.match(/(\d+)\s*-\s*(\d+)/);
    let days = match ? Math.max(parseInt(match[1], 10), parseInt(match[2], 10)) : parseInt(etdStr.replace(/\D/g, ''), 10);
    if (Number.isFinite(days) && days > 0) {
      if (days > MAX_DAYS) days = MAX_DAYS; // e.g. "2250" or "81816" from API → cap to 30
      estimatedDays = estimatedDays == null ? days : Math.min(estimatedDays, days);
    }
  }
  if (estimatedDays != null && estimatedDays > MAX_DAYS) estimatedDays = MAX_DAYS;
  return {
    serviceable: availableCouriers.length > 0,
    estimatedDays: estimatedDays ?? (availableCouriers.length > 0 ? 5 : null),
    availableCouriers,
  };
}

module.exports = { getToken, createShipment, checkServiceability };
