const GoldRate = require('../models/GoldRate');
const appCache = require('../cache/appCache');
const { invalidateGoldRatesCache } = require('../services/priceCalculator');
const { runOnce } = require('../cache/inFlight');
const { sendJsonWithEtag } = require('../utils/etag');

const PURITIES = ['14K', '18K', '22K', '24K'];
const toPaise = (n) => Math.round((parseFloat(n) || 0) * 100);

const GOLD_RATE_PUBLIC_CACHE_TTL_MS = (() => {
  const v = parseInt(process.env.GOLD_RATE_PUBLIC_CACHE_TTL_MS, 10);
  return Number.isFinite(v) && v > 0 ? v : 2 * 60 * 1000;
})();

function invalidateGoldRateCaches() {
  invalidateGoldRatesCache();
  appCache.delPrefix('goldrate:public:');
}

exports.list = async (req, res) => {
  try {
    let rates = await GoldRate.find().lean();
    const map = new Map(rates.map((r) => [String(r.purity).toUpperCase().trim(), r]));
    const result = PURITIES.map((p) => ({
      purity: p,
      pricePerGram: map.get(p)?.pricePerGram ?? 0,
      updatedAt: map.get(p)?.updatedAt ?? null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Public endpoint payload (cached)
exports.publicList = async (req, res) => {
  try {
    const key = 'goldrate:public:v1';
    const cached = appCache.get(key);
    if (cached) {
      return sendJsonWithEtag(req, res, { ...cached, cached: true }, { cacheControl: 'public, max-age=120' });
    }

    const payload = await runOnce(key, async () => {
      const rates = await GoldRate.find().lean();
      const map = new Map(rates.map((r) => [String(r.purity).toUpperCase().trim(), r]));
      const result = PURITIES.map((p) => ({
        purity: p,
        pricePerGram: map.get(p)?.pricePerGram ?? 0,
        pricePerGramPaise: map.get(p)?.pricePerGramPaise ?? 0,
        updatedAt: map.get(p)?.updatedAt ?? null,
      }));
      const pld = { rates: result };
      appCache.set(key, pld, GOLD_RATE_PUBLIC_CACHE_TTL_MS);
      return pld;
    });

    return sendJsonWithEtag(req, res, { ...payload, cached: false }, { cacheControl: 'public, max-age=120' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { purity, pricePerGram } = req.body;
    const p = (purity || '').toString().toUpperCase().trim();
    if (!PURITIES.includes(p)) {
      return res.status(400).json({ error: 'purity must be 14K, 18K, 22K, or 24K' });
    }
    const value = parseFloat(pricePerGram);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: 'pricePerGram must be a non-negative number' });
    }
    const rate = await GoldRate.findOneAndUpdate(
      { purity: p },
      { purity: p, pricePerGram: value, pricePerGramPaise: toPaise(value) },
      { new: true, upsert: true }
    );
    invalidateGoldRateCaches();
    res.json(rate);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBulk = async (req, res) => {
  try {
    const rates = Array.isArray(req.body.rates) ? req.body.rates : [];
    const results = [];
    for (const r of rates) {
      const p = (r.purity || '').toString().toUpperCase().trim();
      if (!PURITIES.includes(p)) continue;
      const value = parseFloat(r.pricePerGram);
      if (!Number.isFinite(value) || value < 0) continue;
      const doc = await GoldRate.findOneAndUpdate(
        { purity: p },
        { purity: p, pricePerGram: value, pricePerGramPaise: toPaise(value) },
        { new: true, upsert: true }
      );
      results.push(doc);
    }
    if (results.length > 0) {
      invalidateGoldRateCaches();
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
