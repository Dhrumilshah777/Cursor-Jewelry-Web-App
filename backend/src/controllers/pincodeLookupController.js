const rateLimit = require('express-rate-limit');

const PIN_RE = /^[1-9][0-9]{5}$/;

// Simple in-memory cache (good enough for a small store).
// key: pincode, value: { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getCached(pincode) {
  const hit = cache.get(pincode);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(pincode);
    return null;
  }
  return hit.data;
}

function setCached(pincode, data) {
  cache.set(pincode, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function normalizeSpaces(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

async function fetchFromIndiaPost(pincode) {
  // Public API used by many apps. Returns: [{ Status, PostOffice: [...] }]
  const url = `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`;
  const res = await fetch(url, { method: 'GET' });
  const json = await res.json().catch(() => null);
  const entry = Array.isArray(json) ? json[0] : null;
  if (!entry || entry.Status !== 'Success' || !Array.isArray(entry.PostOffice) || entry.PostOffice.length === 0) {
    return null;
  }

  const po = entry.PostOffice[0] || {};
  const state = normalizeSpaces(po.State);
  const district = normalizeSpaces(po.District);
  const block = normalizeSpaces(po.Block);
  const postOffice = normalizeSpaces(po.Name);

  // For checkout "City", district is usually the safest auto-fill.
  // Some pincodes map to a specific town/block, so we also return block/postOffice.
  return {
    source: 'indiapost',
    pincode,
    state: state || null,
    city: district || block || null,
    district: district || null,
    block: block || null,
    postOffice: postOffice || null,
  };
}

exports.pincodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
});

/**
 * GET /api/pincode-lookup?pincode=560001
 * Public endpoint, cached.
 */
exports.lookup = async (req, res) => {
  try {
    const raw = String(req.query.pincode || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (!PIN_RE.test(digits)) {
      return res.status(400).json({ error: 'Enter a valid 6-digit pincode' });
    }

    const cached = getCached(digits);
    if (cached) return res.json({ ok: true, ...cached, cached: true });

    const data = await fetchFromIndiaPost(digits);
    if (!data || !data.state || !data.city) {
      return res.status(404).json({ error: 'Pincode not found' });
    }
    setCached(digits, data);
    return res.json({ ok: true, ...data, cached: false });
  } catch (e) {
    return res.status(502).json({ error: 'Pincode lookup failed' });
  }
};

