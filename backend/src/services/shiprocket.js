/**
 * Shiprocket API v2 – login and create adhoc order (shipment).
 * Env: SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD
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
async function createShipment(order) {
  const token = await getToken();
  const addr = order.shippingAddress || {};
  const orderId = order._id.toString();
  const orderDate = new Date(order.createdAt || Date.now()).toISOString().split('T')[0];

  const payload = {
    order_id: orderId,
    order_date: orderDate,
    channel_id: '',
    pickup_location: 'Primary',
    billing_customer_name: addr.name || 'Customer',
    billing_last_name: '',
    billing_address: addr.line1 || '',
    billing_address_2: addr.line2 || '',
    billing_city: addr.city || '',
    billing_pincode: String(addr.pincode || ''),
    billing_state: addr.state || '',
    billing_country: 'India',
    billing_email: order.user?.email || 'customer@example.com',
    billing_phone: String(addr.phone || ''),
    shipping_is_billing: 1,
    shipping_customer_name: addr.name || 'Customer',
    shipping_last_name: '',
    shipping_address: addr.line1 || '',
    shipping_address_2: addr.line2 || '',
    shipping_city: addr.city || '',
    shipping_pincode: String(addr.pincode || ''),
    shipping_state: addr.state || '',
    shipping_country: 'India',
    shipping_phone: String(addr.phone || ''),
    order_items: (order.items || []).map((item, i) => ({
      name: item.name || 'Product',
      sku: item.productId || `item-${i + 1}`,
      units: item.quantity || 1,
      selling_price: parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0,
    })),
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
    throw new Error(data.message || data.errors?.join?.(' ') || data.error || 'Shiprocket order create failed');
  }

  const srOrderId = data.order?.id ?? data.id ?? data.order_id;
  const shipmentId = data.order?.shipment_id ?? data.shipment_id ?? srOrderId;
  if (!srOrderId && !shipmentId) {
    throw new Error('Shiprocket did not return order or shipment id');
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
