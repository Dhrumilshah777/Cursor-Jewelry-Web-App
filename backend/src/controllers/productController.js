const Product = require('../models/Product');
const AuditLog = require('../models/AuditLog');
const { getProductPrice } = require('../services/priceCalculator');
const { generateSKU, getCategoryCode, validatePurity } = require('../services/skuGenerator');
const { slugify, ensureUniqueSlug, isSlugTaken, isMongoObjectIdString } = require('../services/productSlug');
const appCache = require('../cache/appCache');
const { runOnce } = require('../cache/inFlight');
const { sendJsonWithEtag } = require('../utils/etag');
const { SLUG_COLLATION } = require('../config/slugCollation');

const PRODUCT_LIST_CACHE_TTL_MS = (() => {
  const v = parseInt(process.env.PRODUCT_LIST_CACHE_TTL_MS, 10);
  return Number.isFinite(v) && v > 0 ? v : 45 * 1000;
})();

const PRODUCT_DETAIL_CACHE_TTL_MS = (() => {
  const v = parseInt(process.env.PRODUCT_DETAIL_CACHE_TTL_MS, 10);
  return Number.isFinite(v) && v > 0 ? v : 90 * 1000;
})();

function categoryToSlug(cat) {
  return String(cat || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
}

function stableQueryKey(query) {
  const q = query && typeof query === 'object' ? query : {};
  const keys = Object.keys(q).sort();
  const out = {};
  keys.forEach((k) => {
    const v = q[k];
    if (Array.isArray(v)) out[k] = v.map((x) => String(x)).join(',');
    else if (v === undefined) out[k] = '';
    else out[k] = String(v);
  });
  return JSON.stringify(out);
}

function invalidateProductCaches() {
  appCache.delPrefix('products:list:');
  appCache.delPrefix('products:one:');
}

function getAllowedImageHosts() {
  const hosts = new Set();
  const envHosts = (process.env.IMAGEKIT_ALLOWED_HOSTS || 'ik.imagekit.io')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  envHosts.forEach((h) => hosts.add(h.toLowerCase()));

  const endpoint = (process.env.IMAGEKIT_URL_ENDPOINT || '').trim();
  if (endpoint) {
    try {
      const u = new URL(endpoint);
      if (u.hostname) hosts.add(u.hostname.toLowerCase());
    } catch {
      // ignore invalid endpoint
    }
  }

  return Array.from(hosts);
}

function isAllowedImageUrl(urlString, allowedHosts) {
  if (!urlString) return false;
  let u;
  try {
    u = new URL(String(urlString));
  } catch {
    return false;
  }
  if (!/^https?:$/.test(u.protocol)) return false;
  const host = (u.hostname || '').toLowerCase();
  if (!host) return false;
  return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
}

exports.list = async (req, res) => {
  try {
    // Admin must never hit cache (always fetch fresh).
    if (req.admin) {
      const products = await Product.find({ active: { $ne: false } }).sort({ order: 1, createdAt: -1 });
      const withPrices = [];
      for (const p of products) {
        const { price } = await getProductPrice(p);
        const po = p.toObject ? p.toObject() : p;
        const numPrice = parseFloat(po.price || price || '0') || 0;
        withPrices.push({
          ...po,
          price: String(po.price || price || '0'),
          calculatedPrice: price,
          _numPrice: numPrice,
        });
      }

      const categorySlug = (req.query.category || '').toString().trim().toLowerCase();
      const minPrice = parseFloat(req.query.minPrice);
      const maxPrice = parseFloat(req.query.maxPrice);
      const colorParam = (req.query.color || '').toString().trim();
      const colorsFilter = colorParam ? colorParam.split(',').map((c) => c.trim()).filter(Boolean) : [];

      let filtered = withPrices;
      if (categorySlug) {
        filtered = filtered.filter((p) => categoryToSlug(p.category) === categorySlug);
      }
      if (Number.isFinite(minPrice) && minPrice > 0) {
        filtered = filtered.filter((p) => p._numPrice >= minPrice);
      }
      if (Number.isFinite(maxPrice) && maxPrice > 0) {
        filtered = filtered.filter((p) => p._numPrice <= maxPrice);
      }
      if (colorsFilter.length > 0) {
        filtered = filtered.filter((p) => {
          const productColors = (p.colors || []).map((c) => String(c).trim().toLowerCase());
          return colorsFilter.some((c) => productColors.includes(c.toLowerCase()));
        });
      }

      const out = filtered.map(({ _numPrice, ...rest }) => rest);

      const prices = withPrices.map((p) => p._numPrice).filter((n) => n > 0);
      const categoryCounts = {};
      withPrices.forEach((p) => {
        const slug = categoryToSlug(p.category);
        const name = (p.category || 'Uncategorized').trim();
        if (!slug) return;
        if (!categoryCounts[slug]) categoryCounts[slug] = { slug, name, count: 0 };
        categoryCounts[slug].count += 1;
      });
      const colorCounts = {};
      withPrices.forEach((p) => {
        (p.colors || []).forEach((c) => {
          const key = String(c).trim();
          if (!key) return;
          if (!colorCounts[key]) colorCounts[key] = { name: key, count: 0 };
          colorCounts[key].count += 1;
        });
      });

      const facets = {
        totalProducts: withPrices.length,
        categories: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
        priceRange: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
        colors: Object.entries(colorCounts)
          .map(([name, o]) => ({ name, count: o.count }))
          .sort((a, b) => b.count - a.count),
      };

      return res.json({ products: out, facets });
    }

    const cacheKey = `products:list:${stableQueryKey(req.query)}`;
    const cached = appCache.get(cacheKey);
    if (cached) {
      return sendJsonWithEtag(req, res, { ...cached, cached: true }, { cacheControl: 'public, max-age=30' });
    }

    const payload = await runOnce(cacheKey, async () => {
      const products = await Product.find({ active: { $ne: false } }).sort({ order: 1, createdAt: -1 });
      const withPrices = [];
      for (const p of products) {
        const { price } = await getProductPrice(p);
        const po = p.toObject ? p.toObject() : p;
        const numPrice = parseFloat(po.price || price || '0') || 0;
        withPrices.push({
          ...po,
          price: String(po.price || price || '0'),
          calculatedPrice: price,
          _numPrice: numPrice,
        });
      }

      const categorySlug = (req.query.category || '').toString().trim().toLowerCase();
      const minPrice = parseFloat(req.query.minPrice);
      const maxPrice = parseFloat(req.query.maxPrice);
      const colorParam = (req.query.color || '').toString().trim();
      const colorsFilter = colorParam ? colorParam.split(',').map((c) => c.trim()).filter(Boolean) : [];

      let filtered = withPrices;
      if (categorySlug) {
        filtered = filtered.filter((p) => categoryToSlug(p.category) === categorySlug);
      }
      if (Number.isFinite(minPrice) && minPrice > 0) {
        filtered = filtered.filter((p) => p._numPrice >= minPrice);
      }
      if (Number.isFinite(maxPrice) && maxPrice > 0) {
        filtered = filtered.filter((p) => p._numPrice <= maxPrice);
      }
      if (colorsFilter.length > 0) {
        filtered = filtered.filter((p) => {
          const productColors = (p.colors || []).map((c) => String(c).trim().toLowerCase());
          return colorsFilter.some((c) => productColors.includes(c.toLowerCase()));
        });
      }

      const out = filtered.map(({ _numPrice, ...rest }) => rest);

      const prices = withPrices.map((p) => p._numPrice).filter((n) => n > 0);
      const categoryCounts = {};
      withPrices.forEach((p) => {
        const slug = categoryToSlug(p.category);
        const name = (p.category || 'Uncategorized').trim();
        if (!slug) return;
        if (!categoryCounts[slug]) categoryCounts[slug] = { slug, name, count: 0 };
        categoryCounts[slug].count += 1;
      });
      const colorCounts = {};
      withPrices.forEach((p) => {
        (p.colors || []).forEach((c) => {
          const key = String(c).trim();
          if (!key) return;
          if (!colorCounts[key]) colorCounts[key] = { name: key, count: 0 };
          colorCounts[key].count += 1;
        });
      });

      const facets = {
        totalProducts: withPrices.length,
        categories: Object.values(categoryCounts).sort((a, b) => b.count - a.count),
        priceRange: {
          min: prices.length ? Math.min(...prices) : 0,
          max: prices.length ? Math.max(...prices) : 0,
        },
        colors: Object.entries(colorCounts).map(([name, o]) => ({ name, count: o.count })).sort((a, b) => b.count - a.count),
      };

      const pld = { products: out, facets };
      appCache.set(cacheKey, pld, PRODUCT_LIST_CACHE_TTL_MS);
      return pld;
    });

    return sendJsonWithEtag(req, res, { ...payload, cached: false }, { cacheControl: 'public, max-age=30' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    // Admin must never hit cache (always fetch fresh).
    if (req.admin) {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ error: 'Product not found', message: 'Product not found' });
      }
      const po = product.toObject ? product.toObject() : product;
      const { price, breakup } = await getProductPrice(product);
      return res.json({ ...po, price: String(po.price || price), calculatedPrice: price, priceBreakup: breakup });
    }

    const param = String(req.params.id || '').trim();
    if (!param) {
      return res.status(404).json({ error: 'Product not found', message: 'Product not found' });
    }

    const cacheKey = `products:one:${param}`;
    const cached = appCache.get(cacheKey);
    if (cached) {
      return sendJsonWithEtag(req, res, { ...cached, cached: true }, { cacheControl: 'public, max-age=60' });
    }

    const payload = await runOnce(cacheKey, async () => {
      let product = null;
      if (isMongoObjectIdString(param)) {
        product = await Product.findById(param);
      }
      if (!product) {
        const slugLower = param.toLowerCase();
        product = await Product.findOne({ slug: slugLower }).collation(SLUG_COLLATION);
        if (!product) {
          product = await Product.findOne({ oldSlugs: slugLower }).collation(SLUG_COLLATION);
        }
      }
      if (!product) return null;
      const po = product.toObject ? product.toObject() : product;
      const { price, breakup } = await getProductPrice(product);
      const slugLower = param.toLowerCase();
      const matchedOldSlug =
        !isMongoObjectIdString(param) &&
        typeof po.slug === 'string' &&
        po.slug.toLowerCase() !== slugLower &&
        Array.isArray(po.oldSlugs) &&
        po.oldSlugs.some((s) => String(s).toLowerCase() === slugLower);
      const pld = {
        ...po,
        price: String(po.price || price),
        calculatedPrice: price,
        priceBreakup: breakup,
        ...(matchedOldSlug ? { canonicalSlug: po.slug } : {}),
      };
      appCache.set(cacheKey, pld, PRODUCT_DETAIL_CACHE_TTL_MS);
      return pld;
    });

    if (!payload) {
      return res.status(404).json({ error: 'Product not found', message: 'Product not found' });
    }
    return sendJsonWithEtag(req, res, { ...payload, cached: false }, { cacheControl: 'public, max-age=60' });
  } catch (err) {
    if (err.name === 'CastError') {
      return res.status(404).json({ error: 'Product not found', message: 'Product not found' });
    }
    res.status(500).json({ error: err.message });
  }
};

function hasValidGoldPricing(body) {
  const p = (body.goldPurity || '').toString().toUpperCase().replace(/\s/g, '');
  const w = parseFloat(body.netWeight);
  return ['14K', '18K', '22K', '24K'].includes(p) && Number.isFinite(w) && w > 0;
}

exports.create = async (req, res) => {
  try {
    const body = { ...req.body };
    const hasGold = hasValidGoldPricing(body);
    if (!hasGold) {
      return res.status(400).json({
        error: 'Gold-based pricing is required. Set gold purity (14K, 18K, 22K, or 24K) and net weight (grams).',
      });
    }
    body.purchaseQuantity = Math.max(1, parseInt(body.purchaseQuantity, 10) || 1);

    const categoryCode = getCategoryCode(body.category);
    if (!categoryCode) {
      return res.status(400).json({
        error: 'Invalid category for SKU. Use one of: Rings, Earrings, Chain, Bracelet, Pendant (or codes: RING, ERNG, CHN, BRCL, PEND).',
      });
    }

    let sku;
    try {
      const purityCheck = validatePurity(body.goldPurity);
      if (!purityCheck.valid) {
        return res.status(400).json({ error: purityCheck.error });
      }
      sku = await generateSKU(categoryCode, body.goldPurity);
    } catch (skuErr) {
      return res.status(400).json({ error: skuErr.message });
    }
    body.sku = sku;
    body.fixedPricePaise = 0;
    body.price = '';

    const baseSlug =
      body.slug !== undefined && body.slug !== null && String(body.slug).trim()
        ? slugify(body.slug)
        : slugify(body.name);
    if (!baseSlug) {
      return res.status(400).json({ error: 'Invalid name or slug for URL' });
    }
    delete body.oldSlugs;

    let createdProduct = null;
    let createErr = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const baseForSlug =
        attempt === 0
          ? baseSlug
          : slugify(`${String(body.name || 'product')}-${attempt}-${Math.random().toString(36).slice(2, 9)}`);
      // eslint-disable-next-line no-await-in-loop
      body.slug = await ensureUniqueSlug(baseForSlug, null);
      try {
        // eslint-disable-next-line no-await-in-loop
        createdProduct = await Product.create(body);
        createErr = null;
        break;
      } catch (err) {
        createErr = err;
        if (err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
          continue;
        }
        if (err.code === 11000 && err.keyPattern && err.keyPattern.sku) {
          return res.status(409).json({ error: 'Duplicate SKU. Please try creating the product again.' });
        }
        throw err;
      }
    }
    if (!createdProduct) {
      return res.status(409).json({
        error: createErr?.message || 'Could not allocate a unique slug. Please try again.',
      });
    }
    invalidateProductCaches();
    res.status(201).json(createdProduct);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.bulkCreate = async (req, res) => {
  const startedAt = Date.now();
  const allowedHosts = getAllowedImageHosts();

  const input = req.body?.products ?? req.body;
  if (!Array.isArray(input)) {
    return res.status(400).json({ error: 'Expected an array of products (or { products: [...] })' });
  }

  const failures = [];
  const created = [];
  const localSlugs = new Set();

  // Pre-check duplicates within the upload itself
  const seenSkus = new Set();
  input.forEach((row, idx) => {
    const sku = (row && row.sku !== undefined) ? String(row.sku).trim() : '';
    if (!sku) return;
    const key = sku.toUpperCase();
    if (seenSkus.has(key)) {
      failures.push({ index: idx, sku, error: 'Duplicate SKU inside upload (SKU must be unique per row)' });
    } else {
      seenSkus.add(key);
    }
  });

  const skuList = Array.from(seenSkus);
  const existing = skuList.length ? await Product.find({ sku: { $in: skuList } }).select('sku').lean() : [];
  const existingSet = new Set(existing.map((p) => String(p.sku || '').toUpperCase()));

  for (let i = 0; i < input.length; i += 1) {
    const row = input[i];
    if (!row || typeof row !== 'object') {
      failures.push({ index: i, sku: '', error: 'Row must be an object' });
      continue;
    }

    const sku = (row.sku !== undefined) ? String(row.sku).trim() : '';
    if (!sku) {
      failures.push({ index: i, sku: '', error: 'Missing required field: sku' });
      continue;
    }
    const skuKey = sku.toUpperCase();

    if (failures.some((f) => f.index === i)) {
      continue;
    }
    if (existingSet.has(skuKey)) {
      failures.push({ index: i, sku, error: 'SKU already exists (row rejected)' });
      continue;
    }

    const body = { ...row, sku };

    const hasGold = hasValidGoldPricing(body);
    if (!hasGold) {
      failures.push({
        index: i,
        sku,
        error: 'Gold-based pricing is required. Set gold purity (14K, 18K, 22K, or 24K) and net weight (grams).',
      });
      continue;
    }
    body.purchaseQuantity = Math.max(1, parseInt(body.purchaseQuantity, 10) || 1);

    if (!body.name) {
      failures.push({ index: i, sku, error: 'Missing required field: name' });
      continue;
    }

    if (!isAllowedImageUrl(body.image, allowedHosts)) {
      failures.push({ index: i, sku, error: `Invalid image URL. Must be an ImageKit URL (allowed hosts: ${allowedHosts.join(', ')})` });
      continue;
    }
    if (Array.isArray(body.subImages)) {
      const bad = body.subImages.find((u) => !isAllowedImageUrl(u, allowedHosts));
      if (bad) {
        failures.push({ index: i, sku, error: `Invalid subImages URL: ${String(bad)} (ImageKit URLs only)` });
        continue;
      }
    }

    const purityCheck = validatePurity(body.goldPurity);
    if (!purityCheck.valid) {
      failures.push({ index: i, sku, error: purityCheck.error });
      continue;
    }
    body.fixedPricePaise = 0;
    body.price = '';

    delete body.oldSlugs;
    const baseSlug =
      body.slug !== undefined && body.slug !== null && String(body.slug).trim()
        ? slugify(body.slug)
        : slugify(body.name);
    if (!baseSlug) {
      failures.push({ index: i, sku, error: 'Invalid name or slug for URL' });
      continue;
    }
    let createdRow = null;
    let fatalBulkFailure = null;
    for (let att = 0; att < 12; att += 1) {
      const baseForSlug =
        att === 0 ? baseSlug : slugify(`${String(body.name || 'product')}-${att}-${Math.random().toString(36).slice(2, 9)}`);
      // eslint-disable-next-line no-await-in-loop
      let slugCandidate = await ensureUniqueSlug(baseForSlug, null);
      let guard = 0;
      // eslint-disable-next-line no-await-in-loop
      while (localSlugs.has(slugCandidate) && guard < 24) {
        guard += 1;
        // eslint-disable-next-line no-await-in-loop
        slugCandidate = await ensureUniqueSlug(`${baseForSlug}-${guard}-${Math.random().toString(36).slice(2, 7)}`, null);
      }
      if (localSlugs.has(slugCandidate)) {
        fatalBulkFailure = { index: i, sku, error: 'Could not reserve unique slug in batch' };
        break;
      }
      localSlugs.add(slugCandidate);
      body.slug = slugCandidate;
      try {
        // eslint-disable-next-line no-await-in-loop
        createdRow = await Product.create(body);
        break;
      } catch (err) {
        localSlugs.delete(slugCandidate);
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.slug) {
          continue;
        }
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern.sku) {
          fatalBulkFailure = { index: i, sku, error: 'Duplicate SKU (row rejected)' };
        } else {
          fatalBulkFailure = { index: i, sku, error: err.message || 'Failed to create product' };
        }
        break;
      }
    }
    if (createdRow) {
      created.push(createdRow);
      existingSet.add(skuKey);
    } else if (fatalBulkFailure) {
      failures.push(fatalBulkFailure);
    } else {
      failures.push({ index: i, sku, error: 'Duplicate slug (row rejected after retries)' });
    }
  }

  try {
    const actor = req.admin ? { role: req.admin.role, email: req.admin.email, sub: req.admin.sub, id: req.admin.id } : null;
    const meta = {
      totalRows: input.length,
      createdCount: created.length,
      failedCount: failures.length,
      durationMs: Date.now() - startedAt,
      failuresSample: failures.slice(0, 50),
    };
    await AuditLog.create({
      action: 'PRODUCT_BULK_CREATE',
      actor,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || '',
      meta,
    });
  } catch {
    // audit should never block the response
  }

  if (created.length > 0) {
    invalidateProductCaches();
  }

  return res.status(created.length > 0 ? 201 : 200).json({
    ok: failures.length === 0,
    total: input.length,
    createdCount: created.length,
    failedCount: failures.length,
    created,
    failures,
  });
};

exports.update = async (req, res) => {
  try {
    const body = { ...req.body };
    // Never allow client to attempt to mutate immutable Mongo id fields.
    if ('_id' in body) delete body._id;
    if ('id' in body) delete body.id;

    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    if (!Object.prototype.hasOwnProperty.call(body, 'slug')) {
      delete body.oldSlugs;
    } else {
      const rawSlug = body.slug;
      delete body.slug;
      if (rawSlug !== undefined && rawSlug !== null && String(rawSlug).trim() !== '') {
        const newSlug = slugify(String(rawSlug));
        if (!newSlug) {
          return res.status(400).json({ error: 'Invalid slug' });
        }
        if (newSlug !== existing.slug) {
          // eslint-disable-next-line no-await-in-loop
          if (await isSlugTaken(newSlug, existing._id)) {
            return res.status(409).json({ error: 'Slug already in use' });
          }
          const prev = existing.slug;
          const olds = Array.isArray(existing.oldSlugs)
            ? existing.oldSlugs.map((s) => String(s).toLowerCase().trim()).filter(Boolean)
            : [];
          if (prev && !olds.includes(prev)) olds.push(prev);
          body.slug = newSlug;
          body.oldSlugs = olds;
        }
      }
    }

    const merged = { ...existing.toObject(), ...body };
    const hasGold = hasValidGoldPricing(merged);
    if (!hasGold) {
      return res.status(400).json({
        error: 'Gold-based pricing is required. Set gold purity (14K, 18K, 22K, or 24K) and net weight (grams).',
      });
    }
    if ('purchaseQuantity' in body) {
      body.purchaseQuantity = Math.max(1, parseInt(body.purchaseQuantity, 10) || 1);
    }
    if ('stock' in body) {
      body.stock = Math.max(0, parseInt(body.stock, 10) || 0);
    }
    body.fixedPricePaise = 0;
    if ('price' in body) body.price = '';
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true });
    invalidateProductCaches();
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    invalidateProductCaches();
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.invalidateProductCaches = invalidateProductCaches;
