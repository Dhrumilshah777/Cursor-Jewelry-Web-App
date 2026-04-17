const twilio = require('twilio');
const { normalizeIndianE164, normalizeWhatsAppFrom } = require('./twilioSms');

function maskPhone(val) {
  const digits = String(val || '').replace(/\D/g, '');
  if (!digits) return '';
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

/**
 * Send a WhatsApp message via Twilio.
 * Non-throwing by design (callers should not fail their APIs on messaging issues).
 */
async function sendWhatsAppMessage({ phone, body }) {
  try {
    if (!phone) {
      console.warn('[whatsapp] skipped: no phone number');
      return { ok: false, skipped: true, reason: 'missing_phone' };
    }
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = normalizeWhatsAppFrom(process.env.TWILIO_WHATSAPP_FROM);
    if (!accountSid || !authToken || !from) {
      console.warn('[whatsapp] Twilio env missing; skipping');
      return { ok: false, skipped: true, reason: 'missing_env' };
    }

    const e164 = normalizeIndianE164(phone);
    if (!e164 || e164.length !== 13) {
      console.warn('[whatsapp] invalid phone; skipping', { phone: maskPhone(phone) });
      return { ok: false, skipped: true, reason: 'invalid_phone' };
    }
    const to = `whatsapp:${e164}`;
    const safeBody = String(body || '').trim();
    if (!safeBody) return { ok: false, skipped: true, reason: 'empty_body' };

    const client = twilio(accountSid, authToken);
    const result = await client.messages.create({ body: safeBody, from, to });
    return { ok: true, sid: result?.sid || '' };
  } catch (err) {
    console.error('[whatsapp] send failed:', err?.message || err);
    return { ok: false, error: err?.message || String(err) };
  }
}

module.exports = { sendWhatsAppMessage };

