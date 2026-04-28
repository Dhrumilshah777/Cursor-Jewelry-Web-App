import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Black & white theme */
        body: '#FFFFFF',
        hero: '#FFFFFF',
        banner: '#FFFFFF',
        'in-stock': '#F5F5F5',
        /** Outline CTAs + banner emphasis */
        brown: '#111111',
        card: '#FFFFFF',
        text: '#111111',
        'text-muted': '#6B7280',
        /** Footer / secondary links */
        'footer-link': '#374151',
        border: '#E5E7EB',
        accent: '#012249',
        'accent-hover': '#011a36',
        /** Cart count / icon pills on dark nav icons */
        'icon-badge': '#012249',

        /** Legacy names still used across the app */
        cream: '#FFFFFF',
        charcoal: '#111111',
        'accent-cream': '#FFFFFF',
        gold: '#111111',
        'gold-light': '#111111',
        stone: '#6B7280',
        /** Login / accent (SMS OTP flow) */
        'brand-purple': '#7056FF',
        'brand-coral': '#FF6B4A',
        'brand-mint': '#E8F4FC',
      },
      fontFamily: {
        /** Headings */
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        /** Body */
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        /** Backwards-compatible aliases */
        poppins: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'dm-sans': ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
