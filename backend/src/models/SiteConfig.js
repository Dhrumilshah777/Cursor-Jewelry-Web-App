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
    beautyInMotionVideos: { type: [String], default: [] },
    instagramImages: [{ src: String, alt: { type: String, default: 'Instagram' } }],
    viewByCategories: [{
      name: { type: String, required: true },
      image: { type: String, required: true },
      image2: { type: String, default: '' },
      slug: { type: String, default: '' },
      order: { type: Number, default: 0 },
    }],
    categoryCards: [{
      image: { type: String, default: '' },
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      link: { type: String, default: '/products' },
    }],
    bestSellingProductIds: [{ type: String, default: '' }],
    shopByStyle: [{
      image: { type: String, required: true },
      label: { type: String, default: '' },
      link: { type: String, default: '/products' },
      order: { type: Number, default: 0 },
    }],
    homePageImage: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
