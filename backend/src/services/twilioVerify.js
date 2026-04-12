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

/** Comma-separated 10-digit locals (or +91…) listed in Twilio as verified trial recipients, etc. */
let _extrasEnvKey = null;
let _extrasSet = null;
function getExtraAllowedLocal10Set() {
  const raw = process.env.TWILIO_OTP_EXTRA_LOCAL_NUMBERS || '';
  if (raw === _extrasEnvKey && _extrasSet) return _extrasSet;
  const set = new Set();
  for (const part of raw.split(',')) {
    let digits = part.replace(/\D/g, '');
    while (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 10) set.add(digits);
  }
  _extrasEnvKey = raw;
  _extrasSet = set;
  return set;
}

function normalizeIndianPhoneToE164(input) {
  const raw = (input || '').toString().trim();
  if (!raw) return null;
  let d = raw.replace(/\D/g, '');

  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  // e.g. +91919876543210 → strip repeated country code until 10-digit local
  while (d.length > 10 && d.startsWith('91')) d = d.slice(2);

  if (d.length !== 10) return null;

  const extras = getExtraAllowedLocal10Set();
  // Indian mobile MSISDNs use 5–9 as first digit (TRAI); extras allow Twilio-verified atypical locals.
  const standardMobile = /^[5-9]\d{9}$/.test(d);
  if (standardMobile || extras.has(d)) return `+91${d}`;
  return null;
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

