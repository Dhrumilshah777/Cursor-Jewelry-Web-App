import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: '#F8F6F3',
        charcoal: '#1C1917',
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
