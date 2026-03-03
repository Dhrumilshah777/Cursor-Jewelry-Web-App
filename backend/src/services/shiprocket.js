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
  const payload = {
    order_id: orderId.slice(0, 50),
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
    const parts = [data.message || data.error || 'Shiprocket order create failed'];
    if (Array.isArray(data.errors)) parts.push(data.errors.join('; '));
    else if (data.errors && typeof data.errors === 'object') parts.push(JSON.stringify(data.errors));
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

  const assignRes = await fetch(`${SHIPROCKET_BASE}/courier/assign/awb`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      shipment_id: Number(shipmentId) || shipmentId,
      order_id: Number(srOrderId) || srOrderId,
    }),
  });
  const assignData = await assignRes.json().catch(() => ({}));
  if (!assignRes.ok) {
    throw new Error(assignData.message || assignData.errors?.join?.(' ') || assignData.error || 'Shiprocket AWB assign failed');
  }
  const awb = assignData.awb_code ?? assignData.data?.awb_code ?? assignData.courier_awb ?? '';
  const courier = assignData.courier_name ?? assignData.data?.courier_name ?? assignData.courier ?? '';

  return {
    shipment_id: String(shipmentId || srOrderId),
    awb_code: String(awb),
    courier_name: String(courier),
  };
}

module.exports = { getToken, createShipment };
