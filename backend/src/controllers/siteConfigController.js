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
