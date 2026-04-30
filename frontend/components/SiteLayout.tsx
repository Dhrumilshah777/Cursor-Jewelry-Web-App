'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import NavCategoryStrip from '@/components/NavCategoryStrip';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import LoginModal from '@/components/LoginModal';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith('/admin');
  const isHome = pathname === '/';
  const isProductDetail = Boolean(pathname && /^\/products\/[^/]+$/.test(pathname));

  if (isAdmin) return <>{children}</>;
  return (
    <>
      <Header />
      {isHome && <NavCategoryStrip />}
      {children}
      <Footer />
      {!isProductDetail && <MobileBottomNav />}
      <LoginModal />
    </>
  );
}
