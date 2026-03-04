const SiteConfig = require('../models/SiteConfig');

const DEFAULT_KEY = 'main';

async function getConfig() {
  let config = await SiteConfig.findOne({ key: DEFAULT_KEY });
  if (!config) {
    config = await SiteConfig.create({ key: DEFAULT_KEY, heroSlides: [], instagramImages: [] });
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
    config.heroSlides = req.body;
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
