const twilio = require('twilio');

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function getVerifyServiceSid() {
  return process.env.TWILIO_VERIFY_SERVICE_SID || '';
}

function normalizeIndianPhoneToE164(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');

  // Accept:
  // - 10 digits: 9876543210
  // - 12 digits starting with 91: 919876543210
  // - 11 digits starting with 0: 09876543210
  let d = digits;
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);

  if (d.length !== 10) return null;
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return `+91${d}`;
}

async function sendSmsOtp({ toE164 }) {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();
  if (!client || !serviceSid) {
    const err = new Error('Twilio Verify is not configured');
    err.code = 'TWILIO_NOT_CONFIGURED';
    throw err;
  }
  return client.verify.v2.services(serviceSid).verifications.create({ to: toE164, channel: 'sms' });
}

async function verifySmsOtp({ toE164, code }) {
  const client = getTwilioClient();
  const serviceSid = getVerifyServiceSid();
  if (!client || !serviceSid) {
    const err = new Error('Twilio Verify is not configured');
    err.code = 'TWILIO_NOT_CONFIGURED';
    throw err;
  }
  return client.verify.v2.services(serviceSid).verificationChecks.create({ to: toE164, code: (code || '').toString() });
}

module.exports = {
  normalizeIndianPhoneToE164,
  sendSmsOtp,
  verifySmsOtp,
};

