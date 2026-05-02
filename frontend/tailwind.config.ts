import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        /** Theme (jewelry): CTA black, white surfaces, gray borders, gold accent */
        body: '#FFFFFF',
        hero: '#FFFFFF',
        banner: '#FFFFFF',
        card: '#FFFFFF',
        cream: '#FFFFFF',
        'in-stock': '#F5F5F5',

        /** Primary text & near-black UI */
        text: '#111827',
        charcoal: '#111827',
        /** Solid black CTAs (buttons, badges) */
        cta: '#0B0B0B',
        'cta-hover': '#080808',

        /** Secondary / muted copy */
        'text-muted': '#9CA3AF',
        stone: '#9CA3AF',
        /** Footer & secondary links */
        'footer-link': '#6B7280',

        /** Borders & dividers */
        border: '#E5E7EB',

        /** Brand accent (gold) — primary actions on light, promo highlights */
        accent: '#C6A46C',
        'accent-hover': '#b89458',
        /** Text/icons on gold (high contrast) */
        'accent-cream': '#0B0B0B',
        /** Legacy alias: “gold” accents in UI (totals, highlights) */
        gold: '#C6A46C',
        'gold-light': '#d4b896',

        /** Outline / dark emphasis (legacy `brown`) */
        brown: '#0B0B0B',

        /** Pills on icons (cart count, etc.) */
        'icon-badge': '#0B0B0B',

        /** Login / SMS flow accents (unchanged hues; optional) */
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
