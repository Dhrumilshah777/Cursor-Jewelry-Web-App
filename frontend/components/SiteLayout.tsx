'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import NavCategoryStrip from '@/components/NavCategoryStrip';
import Footer from '@/components/Footer';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return <>{children}</>;
  return (
    <>
      <Header />
      <NavCategoryStrip />
      {children}
      <Footer />
    </>
  );
}
