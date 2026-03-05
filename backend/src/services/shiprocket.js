/**
 * Shiprocket API v2 – login and create adhoc order (shipment).
 * Env: SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD, SHIPROCKET_PICKUP_LOCATION (optional, default: Home)
 */

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

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
  const shipmentId =
    raw.shipment_id ?? data.shipment_id ?? data.order?.shipment_id ?? srOrderId;

  if (!srOrderId && !shipmentId) {
    const hint = JSON.stringify(data).slice(0, 300);
    throw new Error(`Shiprocket did not return order or shipment id. Response: ${hint}`);
  }

  const awbFromCreate = data.order?.awb_code ?? data.awb_code ?? data.courier_awb ?? '';
  const courierFromCreate = data.order?.courier_name ?? data.courier_name ?? data.courier ?? '';
  if (awbFromCreate) {
    return {
      shipment_id: String(shipmentId || srOrderId),
      awb_code: String(awbFromCreate),
      courier_name: String(courierFromCreate),
    };
  }

  const sid = parseInt(String(shipmentId), 10);
  const oid = parseInt(String(srOrderId), 10);
  const validSid = !Number.isNaN(sid) && sid > 0 ? sid : null;
  const validOid = !Number.isNaN(oid) && oid > 0 ? oid : null;
  // Shiprocket assign AWB: some versions expect order_id, others shipment_id or both (integers)
  const assignBody = validOid && validSid
    ? { order_id: validOid, shipment_id: validSid }
    : validSid
      ? { shipment_id: validSid }
      : validOid
        ? { order_id: validOid }
        : { order_id: oid || sid, shipment_id: sid || oid };
  const assignRes = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(assignBody),
  });
  const assignData = await assignRes.json().catch(() => ({}));
  if (!assignRes.ok) {
    // Order was created in Shiprocket; assign AWB often fails (API quirk). Return partial success so admin can assign AWB from dashboard.
    return {
      shipment_id: String(shipmentId || srOrderId),
      awb_code: '',
      courier_name: '',
    };
  }
  const awb = assignData.awb_code ?? assignData.data?.awb_code ?? assignData.courier_awb ?? '';
  const courier = assignData.courier_name ?? assignData.data?.courier_name ?? assignData.courier ?? '';

  return {
    shipment_id: String(shipmentId || srOrderId),
    awb_code: String(awb),
    courier_name: String(courier),
  };
}

/**
 * Check courier serviceability for a delivery pincode.
 * Uses Shiprocket GET /courier/serviceability with pickup_postcode and delivery_postcode.
 * @param {string|number} deliveryPincode - Customer delivery pincode
 * @param {string|number} [pickupPincode] - Origin pincode (default from env SHIPROCKET_PICKUP_PINCODE or 395009)
 * @returns {Promise<{ serviceable: boolean, estimatedDays: number | null, availableCouriers: Array<{ name: string, etd: string }> }>}
 */
async function checkServiceability(deliveryPincode, pickupPincode = null) {
  const delivery = parseInt(String(deliveryPincode || '').replace(/\D/g, ''), 10);
  const pickup =
    pickupPincode != null
      ? parseInt(String(pickupPincode).replace(/\D/g, ''), 10)
      : parseInt(String(process.env.SHIPROCKET_PICKUP_PINCODE || '395009').replace(/\D/g, ''), 10);
  if (!Number.isFinite(delivery) || delivery <= 0) {
    return { serviceable: false, estimatedDays: null, availableCouriers: [] };
  }
  const validPickup = Number.isFinite(pickup) && pickup > 0 ? pickup : 395009;
  const token = await getToken();
  const url = `${SHIPROCKET_BASE}/courier/serviceability/?pickup_postcode=${validPickup}&delivery_postcode=${delivery}&weight=0.5`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  const companies = data.data?.available_courier_companies ?? data.available_courier_companies ?? [];
  const availableCouriers = Array.isArray(companies)
    ? companies.map((c) => ({ name: c.name || c.courier_name || 'Courier', etd: c.etd || c.etd_min_max || '' }))
    : [];
  let estimatedDays = null;
  for (const c of availableCouriers) {
    const etdStr = String(c.etd || '').trim();
    const match = etdStr.match(/(\d+)\s*-\s*(\d+)/);
    const days = match ? Math.max(parseInt(match[1], 10), parseInt(match[2], 10)) : parseInt(etdStr.replace(/\D/g, ''), 10);
    if (Number.isFinite(days) && days > 0) {
      estimatedDays = estimatedDays == null ? days : Math.min(estimatedDays, days);
    }
  }
  return {
    serviceable: availableCouriers.length > 0,
    estimatedDays: estimatedDays ?? (availableCouriers.length > 0 ? 5 : null),
    availableCouriers,
  };
}

module.exports = { getToken, createShipment, checkServiceability };
