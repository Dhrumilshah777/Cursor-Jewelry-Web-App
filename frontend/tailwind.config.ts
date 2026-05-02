import type { Config } from 'tailwindcss';

/**
 * Brand palette (THE BRIDE JEWELRY — green system)
 * Primary #1E3A2A | Secondary #517A5E | Mint #E4F1E7
 * Cream #FBF7F0 | Off-white #F5F2EA | Dark #1F1F1F | Medium #64735C | Border #E8E3D8
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Page canvas (cream) */
        body: '#FBF7F0',
        hero: '#FBF7F0',

        /** Section wash (trust strip, etc.) */
        'section-muted': '#F5F2EA',

        /** Cards / elevated surfaces */
        card: '#FFFFFF',
        cream: '#FFFFFF',

        /** Primary forest green — promo strip, CTAs, footer, active nav */
        primary: '#1E3A2A',

        /** Secondary sage — cart badge */
        secondary: '#517A5E',

        /** Pale mint accent surface */
        mint: '#E4F1E7',

        /** Promo / top banner (same as primary) */
        'gold-soft': '#1E3A2A',
        banner: '#1E3A2A',

        /** Decorative tones */
        'tone-warm': '#E4F1E7',
        'tone-highlight': '#517A5E',

        'in-stock': '#F5F2EA',

        /** Typography */
        text: '#1F1F1F',
        charcoal: '#1F1F1F',
        'body-text': '#64735C',
        'text-muted': '#64735C',
        stone: '#64735C',

        'icon-subtle': '#E8E3D8',

        /** Solid bars & primary chrome (footer, video strip, checkout black buttons → green) */
        cta: '#1E3A2A',
        'cta-hover': '#172e22',

        'footer-link': '#64735C',

        border: '#E8E3D8',

        /** Primary actions / highlights (same as primary green) */
        accent: '#1E3A2A',
        'accent-hover': '#172e22',
        'accent-cream': '#FFFFFF',

        gold: '#517A5E',
        'gold-light': '#6d9178',

        brown: '#1E3A2A',

        /** Cart / icon badges — secondary green + white number */
        'icon-badge': '#517A5E',

        'brand-purple': '#7056FF',
        'brand-coral': '#FF6B4A',
        'brand-mint': '#E4F1E7',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        poppins: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        'dm-sans': ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
