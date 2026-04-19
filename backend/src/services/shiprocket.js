/**
 * Shiprocket API v2 – login and create adhoc order (shipment).
 * Env: SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_PICKUP_LOCATION (optional, default: Home)
 */

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

const SHIPROCKET_DEBUG =
  String(process.env.SHIPROCKET_DEBUG || '').toLowerCase() === 'true' ||
  String(process.env.SHIPROCKET_DEBUG || '') === '1';

// NOTE: This logs the raw Shiprocket serviceability JSON (may include operational metadata).
// Keep it opt-in and use only for debugging.
const SHIPROCKET_LOG_SERVICEABILITY_RAW =
  String(process.env.SHIPROCKET_LOG_SERVICEABILITY_RAW || '').toLowerCase() === 'true' ||
  String(process.env.SHIPROCKET_LOG_SERVICEABILITY_RAW || '') === '1';

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

/** Shiprocket returns 200 with awb_assign_error like "AWB is already assigned with awb - SF123... and status - ..." */
function extractAwbFromAlreadyAssignedMessage(text) {
  if (!text || typeof text !== 'string') return '';
  const m = text.match(/awb\s*-\s*([A-Za-z0-9]+)/i);
  return m ? String(m[1]).trim() : '';
}

function extractAwbFromAssignResponsePayload(data) {
  if (!data || typeof data !== 'object') return '';
  const nested =
    data.response?.data?.awb_assign_error ||
    data.data?.awb_assign_error ||
    data.awb_assign_error ||
    data.message ||
    data.error ||
    '';
  return extractAwbFromAlreadyAssignedMessage(String(nested));
}

/** Courier name sometimes nested under response.data on assign (incl. already-assigned errors). */
function extractCourierFromAssignResponsePayload(data) {
  if (!data || typeof data !== 'object') return '';
  const d = data.response?.data ?? data.data ?? data;
  const name =
    d?.courier_name ??
    d?.courier_company_name ??
    data.courier_name ??
    data.courier ??
    '';
  return String(name || '').trim();
}

/**
 * Call Shiprocket assign AWB for an existing shipment_id (retries).
 * @param {number} validSid - Parsed positive shipment_id
 * @param {string} shipmentIdStr - Same id as string (logging)
 * @param {number | null} orderIdForLog - Optional Shiprocket order id for logs
 * @returns {Promise<{ awb_code: string, courier_name: string }>}
 */
async function assignAwbWithRetries(validSid, shipmentIdStr, orderIdForLog = null) {
  const token = await getToken();
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
        order_id: orderIdForLog ?? null,
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
        order_id: orderIdForLog ?? null,
        response_status_code: lastAssignData?.status_code ?? lastAssignData?.status ?? undefined,
        message: lastAssignData?.message || lastAssignData?.error || undefined,
      });
    }

    const recovered = extractAwbFromAssignResponsePayload(lastAssignData);
    if (recovered) {
      const recoveredCourier =
        String(courier || '').trim() || extractCourierFromAssignResponsePayload(lastAssignData);
      srLog('awb.assign.recovered_already_assigned', {
        attempt,
        shipment_id: shipmentIdStr,
        awb_code: recovered,
        courier_name: recoveredCourier || undefined,
      });
      return {
        awb_code: recovered,
        courier_name: recoveredCourier,
      };
    }
  }

  const fallback = extractAwbFromAssignResponsePayload(lastAssignData);
  if (fallback) {
    const recoveredCourier = extractCourierFromAssignResponsePayload(lastAssignData);
    srLog('awb.assign.recovered_already_assigned', {
      shipment_id: shipmentIdStr,
      awb_code: fallback,
      courier_name: recoveredCourier || undefined,
    });
    return { awb_code: fallback, courier_name: recoveredCourier };
  }

  return { awb_code: '', courier_name: '' };
}

/** Re-run AWB assign for an existing Shiprocket shipment (e.g. first assign returned empty). */
async function retryAssignAwb(shipmentIdRaw) {
  const shipmentIdStr = String(shipmentIdRaw ?? '').trim();
  const sid = parseInt(shipmentIdStr, 10);
  if (!shipmentIdStr || Number.isNaN(sid) || sid <= 0) {
    throw new Error('Invalid Shiprocket shipment id');
  }
  await delay(PRE_ASSIGN_AW_DELAY_MS);
  return assignAwbWithRetries(sid, shipmentIdStr, null);
}

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
  const assigned = await assignAwbWithRetries(validSid, shipmentIdStr, validOid);
  return {
    shipment_id: shipmentIdStr,
    awb_code: assigned.awb_code,
    courier_name: assigned.courier_name,
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

  if (SHIPROCKET_LOG_SERVICEABILITY_RAW) {
    // Log raw JSON (truncated) to Render logs for debugging.
    // Truncate to avoid oversized log lines.
    const rawStr = (() => {
      try {
        return JSON.stringify(data);
      } catch {
        return String(data);
      }
    })();
    console.log('[shiprocket] serviceability.raw_response', {
      pickup_postcode: String(validPickup),
      delivery_postcode: String(delivery),
      http_status: res.status,
      raw: rawStr.length > 12000 ? rawStr.slice(0, 12000) + '…(truncated)' : rawStr,
    });
  }
  // Response may be { data: { available_courier_companies: [...] } } or { available_courier_companies: [...] } or nested under data.data
  const companies =
    data.data?.available_courier_companies ??
    data.data?.data?.available_courier_companies ??
    data.available_courier_companies ??
    [];

  const root =
    data.data?.data && typeof data.data.data === 'object'
      ? data.data.data
      : data.data && typeof data.data === 'object'
        ? data.data
        : data;

  const recommendedIdRaw =
    root?.recommended_courier_company_id ??
    root?.recommended_courier_id ??
    data?.recommended_courier_company_id ??
    data?.recommended_courier_id ??
    null;
  const recommendedId =
    recommendedIdRaw != null && String(recommendedIdRaw).trim() !== '' ? String(recommendedIdRaw) : null;

  function toNumber(val) {
    const n = typeof val === 'number' ? val : parseFloat(String(val ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }

  function toInt(val) {
    const n = parseInt(String(val ?? '').replace(/\D/g, ''), 10);
    return Number.isFinite(n) ? n : null;
  }

  const normalized = Array.isArray(companies)
    ? companies.map((c) => {
        const id = c?.courier_company_id ?? c?.id ?? c?.courier_id ?? null;
        const idStr = id != null && String(id).trim() !== '' ? String(id) : null;
        const name = c?.name || c?.courier_name || 'Courier';
        const days =
          toInt(c?.estimated_delivery_days) ??
          toInt(c?.estimated_delivery_days_min) ??
          toInt(c?.estimated_delivery_days_max) ??
          toInt(c?.etd);
        const rating = toNumber(c?.rating);
        const deliveryDelay =
          c?.delivery_delay === true ||
          String(c?.delivery_delay || '').toLowerCase() === 'true' ||
          String(c?.delivery_delay || '') === '1';
        const deliveryPerformance = toNumber(c?.delivery_performance ?? c?.performance ?? c?.delivery_performance_score);
        const zone = String(c?.zone ?? c?.zone_code ?? '').trim().toLowerCase();
        const isRecommended =
          (recommendedId != null && idStr != null && idStr === recommendedId) ||
          c?.is_recommended === true ||
          c?.recommended === true ||
          String(c?.recommended || '').toLowerCase() === 'true';
        return {
          id: idStr,
          name: String(name),
          estimated_delivery_days: days,
          rating,
          delivery_delay: deliveryDelay,
          delivery_performance: deliveryPerformance,
          zone: zone || null,
          is_recommended: isRecommended,
          raw: c,
        };
      })
    : [];

  // 🧠 🎯 DELIVERY FILTER LOGIC (FINAL)
  // 1) If estimated_delivery_days > 7 -> block courier
  // 2) If rating < 4 -> block courier
  // 3) If delivery_delay = true -> block courier
  // 4) If delivery_performance < 4 -> block courier
  // 🟡 Remote Zone Rule: if zone = z_e -> block courier
  const filtered = normalized.filter((c) => {
    if (c.zone === 'z_e') return false;
    if (c.estimated_delivery_days != null && c.estimated_delivery_days > 7) return false;
    if (c.rating != null && c.rating < 4) return false;
    if (c.delivery_delay === true) return false;
    if (c.delivery_performance != null && c.delivery_performance < 4) return false;
    return true;
  });

  // 5) If no courier remains -> block delivery
  if (filtered.length === 0) {
    return { serviceable: false, estimatedDays: null, availableCouriers: [], selectedCourier: null };
  }

  // 6) Recommended courier preference (only if it passes all rules)
  let selected = filtered.find((c) => c.is_recommended);

  // 7) Fallback: highest rating AND lowest delivery_days
  if (!selected) {
    const byScore = [...filtered].sort((a, b) => {
      const ar = a.rating ?? -1;
      const br = b.rating ?? -1;
      if (br !== ar) return br - ar; // highest rating
      const ad = a.estimated_delivery_days ?? 9999;
      const bd = b.estimated_delivery_days ?? 9999;
      if (ad !== bd) return ad - bd; // lowest days
      return String(a.name).localeCompare(String(b.name));
    });
    selected = byScore[0];
  }

  const estimatedDays =
    selected?.estimated_delivery_days != null && selected.estimated_delivery_days > 0
      ? selected.estimated_delivery_days
      : null;

  const availableCouriers = filtered.map((c) => ({
    id: c.id,
    name: c.name,
    estimated_delivery_days: c.estimated_delivery_days,
    rating: c.rating,
    delivery_delay: c.delivery_delay,
    delivery_performance: c.delivery_performance,
    zone: c.zone,
    is_recommended: c.is_recommended,
  }));

  return {
    serviceable: true,
    estimatedDays,
    availableCouriers,
    selectedCourier: selected
      ? {
          id: selected.id,
          name: selected.name,
          estimated_delivery_days: selected.estimated_delivery_days,
          rating: selected.rating,
          delivery_delay: selected.delivery_delay,
          delivery_performance: selected.delivery_performance,
          zone: selected.zone,
          is_recommended: selected.is_recommended,
        }
      : null,
  };
}

function warehouseForReturns() {
  const name = (process.env.SHIPROCKET_RETURN_SHIPPING_NAME || '').trim();
  const address = (process.env.SHIPROCKET_RETURN_SHIPPING_ADDRESS || '').trim();
  const city = (process.env.SHIPROCKET_RETURN_SHIPPING_CITY || '').trim();
  const state = (process.env.SHIPROCKET_RETURN_SHIPPING_STATE || '').trim();
  const pinRaw = (process.env.SHIPROCKET_RETURN_SHIPPING_PINCODE || '').trim();
  const phone = (process.env.SHIPROCKET_RETURN_SHIPPING_PHONE || '').trim();
  if (!name || !address || !city || !state || !pinRaw || !phone) {
    throw new Error(
      'Set SHIPROCKET_RETURN_SHIPPING_NAME, SHIPROCKET_RETURN_SHIPPING_ADDRESS, SHIPROCKET_RETURN_SHIPPING_CITY, SHIPROCKET_RETURN_SHIPPING_STATE, SHIPROCKET_RETURN_SHIPPING_PINCODE, SHIPROCKET_RETURN_SHIPPING_PHONE for return pickup destination (warehouse).'
    );
  }
  const email = (
    process.env.SHIPROCKET_RETURN_SHIPPING_EMAIL ||
    process.env.SHIPROCKET_EMAIL ||
    'noreply@example.com'
  ).trim();
  return {
    name,
    address,
    city,
    state,
    country: 'India',
    pincode: toPincodeInt(pinRaw),
    phone: toTenDigitPhone(phone),
    email: email.slice(0, 100),
  };
}

/**
 * Reverse pickup: customer → warehouse. Warehouse env vars required.
 * If SHIPROCKET_CHANNEL_ID is set, it is sent; if omitted, the return API may still work (like adhoc) — if Shiprocket errors, add channel id from dashboard → Channels.
 * @returns {Promise<{ shipment_id: string, awb_code: string, courier_name: string, ship_order_id: string }>}
 */
async function createReturnShipment(order, returnDoc, pickupEmail) {
  const channelRaw = process.env.SHIPROCKET_CHANNEL_ID || '';
  const channelId = parseInt(String(channelRaw).replace(/\D/g, ''), 10);
  const channelIdValid = !Number.isNaN(channelId) && channelId > 0;

  const token = await getToken();
  const addr = order.shippingAddress || {};
  const wh = warehouseForReturns();
  const retId = returnDoc._id.toString();
  const orderDate = new Date(returnDoc.createdAt || Date.now()).toISOString().split('T')[0];
  const numericOrderId = String((Date.now() % 1e11) + (parseInt(retId.slice(-6), 16) % 1e6)).replace(/\D/g, '').slice(0, 50);

  const billingAddress1 = truncate(addr.line1 || 'Address', 95);
  const billingAddress2 = truncate(addr.line2 || '', 95);
  const billingPincode = toPincodeInt(addr.pincode);
  const billingPhone = toTenDigitPhone(addr.phone);
  const email = String(pickupEmail || order.user?.email || 'customer@example.com').slice(0, 100);

  const items = (order.items || []).map((item, i) => {
    const rupees = Math.max(
      1,
      Math.round(parseFloat(String(item.price || '0').replace(/[^0-9.]/g, '')) || 0)
    );
    return {
      name: truncate(item.name || 'Product', 100),
      sku: String(item.productId || `item-${i + 1}`).slice(0, 50),
      units: Math.max(1, parseInt(item.quantity, 10) || 1),
      selling_price: rupees,
    };
  });
  const subTotal = Math.max(
    1,
    Math.round(Number(order.subtotal) || items.reduce((s, it) => s + it.selling_price * it.units, 0))
  );

  const len = parseFloat(process.env.SHIPROCKET_RETURN_LENGTH || '15') || 15;
  const breadth = parseFloat(process.env.SHIPROCKET_RETURN_BREADTH || '15') || 15;
  const height = parseFloat(process.env.SHIPROCKET_RETURN_HEIGHT || '5') || 5;
  const weight = parseFloat(process.env.SHIPROCKET_RETURN_WEIGHT || '0.5') || 0.5;

  const payload = {
    order_id: numericOrderId,
    order_date: orderDate,
    pickup_customer_name: truncate(addr.name || 'Customer', 50),
    pickup_last_name: '',
    pickup_address: billingAddress1,
    pickup_address_2: billingAddress2,
    pickup_city: truncate(addr.city || 'City', 50),
    pickup_state: truncate(addr.state || 'State', 50),
    pickup_country: 'India',
    pickup_pincode: billingPincode,
    pickup_email: email,
    pickup_phone: billingPhone,
    shipping_customer_name: truncate(wh.name, 50),
    shipping_last_name: '',
    shipping_address: truncate(wh.address, 95),
    shipping_address_2: '',
    shipping_city: truncate(wh.city, 50),
    shipping_state: truncate(wh.state, 50),
    shipping_country: wh.country,
    shipping_pincode: wh.pincode,
    shipping_email: wh.email.slice(0, 100),
    shipping_phone: wh.phone,
    order_items: items,
    sub_total: subTotal,
    payment_method: 'Prepaid',
    length: len,
    breadth,
    height,
    weight,
  };
  if (channelIdValid) {
    payload.channel_id = channelId;
  }

  const res = await fetch(`${SHIPROCKET_BASE}/orders/create/return`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const parts = ['Create return order failed: ' + (data.message || data.error || 'Shiprocket')];
    if (Array.isArray(data.errors)) parts.push(data.errors.join('; '));
    throw new Error(parts.join(' — '));
  }

  const raw = data.data || data.order || data;
  const shipOrderId =
    raw.order_id ?? raw.id ?? data.order_id ?? data.order?.id ?? data.id ?? '';

  const shipmentIdRaw = extractShipmentIdFromCreateResponse(data);
  if (shipmentIdRaw == null) {
    const hint = JSON.stringify(data).slice(0, 400);
    throw new Error(`Shipment ID missing from Shiprocket return create response. Response (truncated): ${hint}`);
  }

  const shipmentIdStr = String(shipmentIdRaw);
  const awbFromCreate = data.order?.awb_code ?? data.awb_code ?? data.courier_awb ?? '';
  const courierFromCreate = data.order?.courier_name ?? data.courier_name ?? data.courier ?? '';
  if (awbFromCreate) {
    return {
      shipment_id: shipmentIdStr,
      awb_code: String(awbFromCreate),
      courier_name: String(courierFromCreate),
      ship_order_id: String(shipOrderId || ''),
    };
  }

  const sid = parseInt(String(shipmentIdRaw), 10);
  const validSid = !Number.isNaN(sid) && sid > 0 ? sid : null;
  if (!validSid) {
    throw new Error(`Invalid shipment_id from Shiprocket return: ${shipmentIdStr}`);
  }

  await delay(PRE_ASSIGN_AW_DELAY_MS);
  const oid = shipOrderId != null ? parseInt(String(shipOrderId), 10) : NaN;
  const validOid = !Number.isNaN(oid) && oid > 0 ? oid : null;
  const assigned = await assignAwbWithRetries(validSid, shipmentIdStr, validOid);
  return {
    shipment_id: shipmentIdStr,
    awb_code: assigned.awb_code,
    courier_name: assigned.courier_name,
    ship_order_id: String(shipOrderId || ''),
  };
}

module.exports = { getToken, createShipment, createReturnShipment, retryAssignAwb, checkServiceability };
