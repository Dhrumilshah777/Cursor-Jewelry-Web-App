import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Surfaces */
        body: '#FFFFFF',
        hero: '#FFFFFF',
        banner: '#FFFFFF',
        card: '#FFFFFF',
        cream: '#FFFFFF',
        'in-stock': '#F5F5F5',

        /**
         * Typography
         * Primary: headings, logo, nav categories, main icons → warm soft black
         * Body: descriptions, product labels, UI labels
         * Muted: supporting / tertiary copy
         */
        text: '#2B1F1A',
        charcoal: '#2B1F1A',
        'body-text': '#6B5E57',
        'text-muted': '#9CA3AF',
        stone: '#9CA3AF',

        /** Icons: match primary text; subtle inactive UI uses border gray */
        'icon-subtle': '#E5E7EB',

        /** Solid black CTAs */
        cta: '#0B0B0B',
        'cta-hover': '#080808',

        /** Footer & secondary links */
        'footer-link': '#6B5E57',

        /** Borders & dividers */
        border: '#E5E7EB',

        /** Brand gold — accents, premium highlights, accent icons */
        accent: '#C6A46C',
        'accent-hover': '#b89458',
        'accent-cream': '#0B0B0B',
        gold: '#C6A46C',
        'gold-light': '#d4b896',

        brown: '#0B0B0B',
        'icon-badge': '#0B0B0B',

        'brand-purple': '#7056FF',
        'brand-coral': '#FF6B4A',
        'brand-mint': '#E8F4FC',
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
