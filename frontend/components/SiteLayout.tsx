'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import NavCategoryStrip from '@/components/NavCategoryStrip';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');

  if (isAdmin) return <>{children}</>;
  return (
    <>
      <Header />
      <NavCategoryStrip />
      <div className="pb-24 md:pb-0">
        {children}
        <Footer />
      </div>
      <MobileBottomNav />
    </>
  );
}
