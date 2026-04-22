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

/** Twilio Messages API expects e.g. whatsapp:+14155238886 */
function normalizeWhatsAppFrom(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.toLowerCase().startsWith('whatsapp:')) return s;
  if (s.startsWith('+')) return `whatsapp:${s}`;
  return '';
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

/**
 * Send a custom SMS via Twilio.
 * Does NOT throw.
 * @param {{ phone: string, body: string }} params
 */
async function sendSms({ phone, body }) {
  try {
    if (!phone) {
      console.warn('[sms] skipped: no phone number');
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
    const safeBody = String(body || '').trim();
    if (!safeBody) {
      console.warn('[sms] skipped: empty body');
      return { ok: false, skipped: true, reason: 'empty_body' };
    }
    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({ body: safeBody, from, to });
    return { ok: true, sid: result?.sid || '' };
  } catch (err) {
    console.error('[sms] Failed to send Twilio SMS:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

/**
 * Send order confirmation on WhatsApp via Twilio (same Messages API as SMS).
 * Set TWILIO_WHATSAPP_FROM e.g. whatsapp:+14155238886 (sandbox) or your approved live sender.
 * Does NOT throw.
 * @param {{ phone: string, name: string, orderId: string, amount: number }} params
 */
async function sendOrderWhatsApp({ phone, name, orderId, amount }) {
  try {
    if (!phone) {
      console.warn('[whatsapp] skipped: no phone number');
      return { ok: false, skipped: true, reason: 'missing_phone' };
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = normalizeWhatsAppFrom(process.env.TWILIO_WHATSAPP_FROM);
    if (!accountSid || !authToken || !from) {
      console.warn('[whatsapp] Twilio env missing (need TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM); skipping');
      return { ok: false, skipped: true, reason: 'missing_env' };
    }

    const e164 = normalizeIndianE164(phone);
    if (!e164 || e164.length !== 13) {
      console.warn('[whatsapp] Invalid phone; skipping', { phone });
      return { ok: false, skipped: true, reason: 'invalid_phone' };
    }
    const to = `whatsapp:${e164}`;

    const safeName = String(name || '').trim() || 'Customer';
    const safeOrderId = String(orderId || '').trim();
    const safeAmount = formatInrAmount(amount);
    const body = `Hi ${safeName}, your order #${safeOrderId} is confirmed. Amount: ₹${safeAmount}. We’ll notify you when shipped.`;

    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({
      body,
      from,
      to,
    });

    return { ok: true, sid: result?.sid || '' };
  } catch (err) {
    console.error('[whatsapp] Failed to send Twilio WhatsApp:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { sendOrderSMS, sendSms, sendOrderWhatsApp, normalizeIndianE164, normalizeWhatsAppFrom };

