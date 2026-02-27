import type { Metadata } from 'next';
import { Cormorant_Garamond, DM_Sans, Poppins } from 'next/font/google';
import './globals.css';
import PageLoader from '@/components/PageLoader';
import SiteLayout from '@/components/SiteLayout';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['200', '300', '400', '500', '600'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BLURE — The Maison Blure',
  description: 'Inspired by heavenly wonders. Jewelry that suffuses each sign with unique character.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cormorant.variable} ${dmSans.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-charcoal antialiased">
        <PageLoader />
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
