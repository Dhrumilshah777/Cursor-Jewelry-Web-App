/** @type {import('next').NextConfig} */
const nextConfig = {
  // Backend URL for API calls (set in .env.local later)
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  },
};

module.exports = nextConfig;
