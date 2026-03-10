const SiteConfig = require('../models/SiteConfig');

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
      slug: String(c.slug || slugFromName(c.name)).trim() || slugFromName(c.name),
      order: i,
    })).filter((c) => c.image);
    await config.save();
    const list = (config.viewByCategories || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json(list.map((c, i) => ({
      _id: c._id?.toString() || String(i),
      name: c.name,
      image: c.image,
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
