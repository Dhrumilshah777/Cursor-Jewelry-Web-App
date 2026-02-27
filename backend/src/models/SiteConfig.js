const mongoose = require('mongoose');

const heroSlideSchema = new mongoose.Schema({
  image: String,
  video: String,
  title: [String],
  subtitle: String,
  cta: String,
  ctaHref: { type: String, default: '/products' },
  order: { type: Number, default: 0 },
}, { _id: true });

const siteConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    heroSlides: [heroSlideSchema],
    homeVideoUrl: { type: String, default: '' },
    instagramImages: [{ src: String, alt: { type: String, default: 'Instagram' } }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
