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
    everydayGifts: [{
      image: { type: String, default: '' },
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      link: { type: String, default: '/products' },
      order: { type: Number, default: 0 },
    }],
    homePageImage: { type: String, default: '' },
    promoCards: [{
      title: { type: String, default: '' },
      subtitle: { type: String, default: '' },
      ctaText: { type: String, default: 'Shop now' },
      link: { type: String, default: '/products' },
      image: { type: String, default: '' },
      backgroundColor: { type: String, default: '' },
      centered: { type: Boolean, default: false },
    }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.SiteConfig || mongoose.model('SiteConfig', siteConfigSchema);
