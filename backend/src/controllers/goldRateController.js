const GoldRate = require('../models/GoldRate');

const PURITIES = ['18K', '22K', '24K'];

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

exports.update = async (req, res) => {
  try {
    const { purity, pricePerGram } = req.body;
    const p = (purity || '').toString().toUpperCase().trim();
    if (!PURITIES.includes(p)) {
      return res.status(400).json({ error: 'purity must be 18K, 22K, or 24K' });
    }
    const value = parseFloat(pricePerGram);
    if (!Number.isFinite(value) || value < 0) {
      return res.status(400).json({ error: 'pricePerGram must be a non-negative number' });
    }
    const rate = await GoldRate.findOneAndUpdate(
      { purity: p },
      { purity: p, pricePerGram: value },
      { new: true, upsert: true }
    );
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
        { purity: p, pricePerGram: value },
        { new: true, upsert: true }
      );
      results.push(doc);
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
