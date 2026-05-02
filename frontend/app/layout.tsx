import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';
import PageLoader from '@/components/PageLoader';
import SiteLayout from '@/components/SiteLayout';

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-playfair',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BLURE — The Maison Blure',
  description: 'Inspired by heavenly wonders. Jewelry that suffuses each sign with unique character.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-main font-sans text-text antialiased">
        <PageLoader />
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
