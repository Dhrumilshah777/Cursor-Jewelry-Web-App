const SiteConfig = require('../models/SiteConfig');
const Product = require('../models/Product');
const { getProductPrice } = require('../services/priceCalculator');

const DEFAULT_KEY = 'main';

async function getConfig() {
  let config = await SiteConfig.findOne({ key: DEFAULT_KEY });
  if (!config) {
    config = await SiteConfig.create({ key: DEFAULT_KEY, heroSlides: [], instagramImages: [], categoryCards: [] });
  }
  return config;
}

exports.getHero = async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config.heroSlides || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateHero = async (req, res) => {
  try {
    const config = await getConfig();
    const slides = Array.isArray(req.body) ? req.body : [];
    config.heroSlides = slides.map((s, i) => ({
      image: s.image || '',
      video: s.video || '',
      title: s.title,
      subtitle: s.subtitle,
      cta: s.cta,
      ctaHref: s.ctaHref || '/products',
      order: i,
    }));
    config.markModified('heroSlides');
    await config.save();
    res.json(config.heroSlides);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getVideo = async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ homeVideoUrl: config.homeVideoUrl || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateVideo = async (req, res) => {
  try {
    const config = await getConfig();
    config.homeVideoUrl = req.body.homeVideoUrl != null ? req.body.homeVideoUrl : config.homeVideoUrl;
    await config.save();
    res.json({ homeVideoUrl: config.homeVideoUrl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getBeautyInMotionVideos = async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ videos: config.beautyInMotionVideos || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBeautyInMotionVideos = async (req, res) => {
  try {
    const config = await getConfig();
    config.beautyInMotionVideos = Array.isArray(req.body.videos) ? req.body.videos.filter(Boolean) : [];
    await config.save();
    res.json({ videos: config.beautyInMotionVideos });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

function slugFromName(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'category';
}

exports.getViewByCategories = async (req, res) => {
  try {
    const config = await getConfig();
    const list = (config.viewByCategories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(list.map((c, i) => ({
      _id: c._id?.toString() || String(i),
      name: c.name,
      image: c.image,
      image2: c.image2 || '',
      slug: c.slug || slugFromName(c.name),
      order: c.order ?? i,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateViewByCategories = async (req, res) => {
  try {
    const config = await getConfig();
    const raw = Array.isArray(req.body.categories) ? req.body.categories : [];
    config.viewByCategories = raw.map((c, i) => ({
      name: String(c.name || '').trim() || 'Category',
      image: String(c.image || '').trim() || '',
      image2: String(c.image2 || '').trim() || '',
      slug: String(c.slug || slugFromName(c.name)).trim() || slugFromName(c.name),
      order: i,
    })).filter((c) => c.image);
    await config.save();
    const list = (config.viewByCategories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(list.map((c, i) => ({
      _id: c._id?.toString() || String(i),
      name: c.name,
      image: c.image,
      image2: c.image2 || '',
      slug: c.slug || slugFromName(c.name),
      order: c.order ?? i,
    })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getInstagram = async (req, res) => {
  try {
    const config = await getConfig();
    res.json(config.instagramImages || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateInstagram = async (req, res) => {
  try {
    const config = await getConfig();
    config.instagramImages = req.body;
    await config.save();
    res.json(config.instagramImages);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const defaultCategoryCards = [
  { image: '', title: 'Moissanite', description: 'Browse our best collection of brilliant and durable moissanite jewelry.', link: '/products' },
  { image: '', title: 'Lab Grown Diamond', description: 'Browse our best collection of Conflict-free lab diamond jewellery.', link: '/products' },
];

exports.getCategoryCards = async (req, res) => {
  try {
    const config = await getConfig();
    const cards = config.categoryCards && config.categoryCards.length >= 2
      ? config.categoryCards.slice(0, 2)
      : defaultCategoryCards;
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateCategoryCards = async (req, res) => {
  try {
    const config = await getConfig();
    const raw = Array.isArray(req.body) ? req.body : [];
    config.categoryCards = raw.slice(0, 2).map((c, i) => ({
      image: String(c.image || '').trim(),
      title: String(c.title || '').trim() || (defaultCategoryCards[i] && defaultCategoryCards[i].title) || '',
      description: String(c.description || '').trim() || (defaultCategoryCards[i] && defaultCategoryCards[i].description) || '',
      link: String(c.link || '').trim() || '/products',
    }));
    await config.save();
    res.json(config.categoryCards);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getBestSelling = async (req, res) => {
  try {
    const config = await getConfig();
    const ids = (config.bestSellingProductIds || []).filter((id) => id && String(id).trim());
    if (ids.length === 0) return res.json([]);
    const products = await Product.find({ _id: { $in: ids }, active: { $ne: false } });
    const byId = {};
    products.forEach((p) => { byId[p._id.toString()] = p; });
    const withPrices = [];
    for (const id of ids) {
      const p = byId[id];
      if (!p) continue;
      const { price } = await getProductPrice(p);
      const po = p.toObject ? p.toObject() : p;
      withPrices.push({
        _id: po._id?.toString(),
        name: po.name,
        category: po.category || '',
        price: String(po.price || price || '0'),
        image: po.image || '',
      });
    }
    res.json(withPrices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getBestSellingIds = async (req, res) => {
  try {
    const config = await getConfig();
    const ids = (config.bestSellingProductIds || []).filter((id) => id && String(id).trim());
    res.json({ productIds: ids });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateBestSelling = async (req, res) => {
  try {
    const config = await getConfig();
    const raw = Array.isArray(req.body.productIds) ? req.body.productIds : [];
    config.bestSellingProductIds = raw.map((id) => String(id).trim()).filter(Boolean);
    await config.save();
    res.json({ productIds: config.bestSellingProductIds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getShopByStyle = async (req, res) => {
  try {
    const config = await getConfig();
    const list = (config.shopByStyle || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(list.map((s, i) => ({
      image: s.image,
      label: s.label || '',
      link: s.link || '/products',
      order: s.order ?? i,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateShopByStyle = async (req, res) => {
  try {
    const config = await getConfig();
    const raw = Array.isArray(req.body.slides) ? req.body.slides : [];
    config.shopByStyle = raw.map((s, i) => ({
      image: String(s.image || '').trim(),
      label: String(s.label || '').trim(),
      link: String(s.link || '').trim() || '/products',
      order: i,
    })).filter((s) => s.image);
    await config.save();
    const list = (config.shopByStyle || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(list.map((s, i) => ({ image: s.image, label: s.label || '', link: s.link || '/products', order: s.order ?? i })));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getHomePageImage = async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ image: config.homePageImage || '' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateHomePageImage = async (req, res) => {
  try {
    const config = await getConfig();
    config.homePageImage = String(req.body.image || '').trim();
    await config.save();
    res.json({ image: config.homePageImage });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const defaultPromoCards = [
  { title: 'Elsa Paretty Jewelry', subtitle: 'Lorem ipsum estibulum blandi', ctaText: 'Shop now', link: '/products', image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=800', backgroundColor: '#b87333', centered: false },
  { title: 'Euphoria', subtitle: '', ctaText: 'Shop more', link: '/products', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800', backgroundColor: '#f5f0e8', centered: true },
];

exports.getPromoCards = async (req, res) => {
  try {
    const config = await getConfig();
    const cards = config.promoCards && config.promoCards.length >= 2 ? config.promoCards.slice(0, 2) : defaultPromoCards;
    res.json(cards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePromoCards = async (req, res) => {
  try {
    const config = await getConfig();
    const raw = Array.isArray(req.body) ? req.body : [];
    config.promoCards = raw.slice(0, 2).map((c, i) => ({
      title: String(c.title || '').trim() || (defaultPromoCards[i] && defaultPromoCards[i].title) || '',
      subtitle: String(c.subtitle || '').trim(),
      ctaText: String(c.ctaText || '').trim() || (defaultPromoCards[i] && defaultPromoCards[i].ctaText) || 'Shop now',
      link: String(c.link || '').trim() || (defaultPromoCards[i] && defaultPromoCards[i].link) || '/products',
      image: String(c.image || '').trim(),
      backgroundColor: String(c.backgroundColor || '').trim() || (defaultPromoCards[i] && defaultPromoCards[i].backgroundColor) || '',
      centered: Boolean(c.centered),
    }));
    await config.save();
    res.json(config.promoCards);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
