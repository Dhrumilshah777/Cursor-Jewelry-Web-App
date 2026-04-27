import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Style guide (PDP mockup) */
        body: '#F5EFE6',
        hero: '#E8D8C3',
        banner: '#D6C2A8',
        'in-stock': '#F7EEE5',
        /** Outline CTAs + banner emphasis */
        brown: '#3A2E1F',
        card: '#FFFFFF',
        text: '#1A1A1A',
        'text-muted': '#8A8A8A',
        /** Footer / secondary links */
        'footer-link': '#6D6D6D',
        border: '#E7E1D7',
        accent: '#C6A46C',
        'accent-hover': '#B8955A',
        /** Cart count / icon pills on dark nav icons */
        'icon-badge': '#95713E',

        /** Legacy names still used across the app */
        cream: '#F5EFE6',
        charcoal: '#1A1A1A',
        'accent-cream': '#FFFFFF',
        gold: '#B8860B',
        'gold-light': '#D4AF37',
        stone: '#78716C',
        /** Login / accent (SMS OTP flow) */
        'brand-purple': '#7056FF',
        'brand-coral': '#FF6B4A',
        'brand-mint': '#E8F4FC',
      },
      fontFamily: {
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        poppins: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        'dm-sans': ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
