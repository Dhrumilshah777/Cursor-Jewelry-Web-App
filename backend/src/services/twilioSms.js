const twilio = require('twilio');

function normalizeIndianE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  // Keep last 10 digits as the subscriber number, then prefix +91
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits.padStart(10, '0');
  return `+91${last10}`;
}

function formatInrAmount(amount) {
  const n = typeof amount === 'number' ? amount : parseFloat(String(amount ?? ''));
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 100) / 100);
}

/**
 * Send order confirmation SMS via Twilio.
 * Does NOT throw (callers can still wrap, but this is safe).
 * @param {{ phone: string, name: string, orderId: string, amount: number }} params
 */
async function sendOrderSMS({ phone, name, orderId, amount }) {
  try {
    if (!phone) {
      console.warn('SMS skipped: no phone number');
      return { ok: false, skipped: true, reason: 'missing_phone' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!accountSid || !authToken || !from) {
      console.warn('[sms] Twilio env missing; skipping SMS');
      return { ok: false, skipped: true, reason: 'missing_env' };
    }

    const to = normalizeIndianE164(phone);
    if (!to || to.length !== 13) {
      console.warn('[sms] Invalid phone; skipping SMS', { phone });
      return { ok: false, skipped: true, reason: 'invalid_phone' };
    }

    const safeName = String(name || '').trim() || 'Customer';
    const safeOrderId = String(orderId || '').trim();
    const safeAmount = formatInrAmount(amount);
    const message = `Hi ${safeName}, your order #${safeOrderId} is confirmed. Amount: ₹${safeAmount}. We’ll notify you when shipped.`;

    console.log('Sending SMS to:', phone);
    console.log('Message:', message);

    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body: message,
      from,
      to,
    });

    return { ok: true, sid: result?.sid || '' };
  } catch (err) {
    console.error('[sms] Failed to send Twilio SMS:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { sendOrderSMS, normalizeIndianE164 };

