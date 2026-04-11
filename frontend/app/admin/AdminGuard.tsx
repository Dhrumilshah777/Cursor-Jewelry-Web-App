'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { getApiBase, isAdminLoggedIn, clearAdminLoggedIn, apiGet } from '@/lib/api';

const NAV = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/products', label: 'Latest Beauty Products' },
  { href: '/admin/gold-rates', label: 'Gold Rates' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/hero', label: 'Hero Sliders' },
  { href: '/admin/category-cards', label: 'Category Cards' },
  { href: '/admin/video', label: 'Home Page Video' },
  { href: '/admin/beauty-in-motion', label: 'Beauty in Motion' },
  { href: '/admin/view-by-categories', label: 'View by Categories' },
  { href: '/admin/best-selling', label: 'Best Selling Jewelery' },
  { href: '/admin/shop-by-style', label: 'Shop by Style' },
  { href: '/admin/everyday-gifts', label: 'Everyday Gifts' },
  { href: '/admin/home-page-image', label: 'Home Page Image' },
  { href: '/admin/instagram', label: 'Instagram Section' },
];

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Verify admin cookie with backend when on protected page
  useEffect(() => {
    if (!mounted || pathname === '/admin/login' || pathname === '/admin/auth/callback') return;
    if (!isAdminLoggedIn()) {
      setSessionVerified(false);
      return;
    }
    apiGet<{ ok: boolean }>('/api/admin/me', { admin: true })
      .then(() => setSessionVerified(true))
      .catch(() => {
        clearAdminLoggedIn();
        setSessionVerified(false);
        router.replace('/admin/login');
      });
  }, [mounted, pathname, router]);

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <span className="text-stone-500">Loading…</span>
      </div>
    );
  }

  const isAdmin = isAdminLoggedIn();
  const isLoginPage = pathname === '/admin/login';
  const isAuthCallbackPage = pathname === '/admin/auth/callback';

  // Allow login and auth callback pages without a token
  if (isLoginPage || isAuthCallbackPage) {
    if (isAdmin && isLoginPage) {
      router.replace('/admin');
      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-100">
          <span className="text-stone-500">Redirecting…</span>
        </div>
      );
    }
    return <>{children}</>;
  }

  // No admin session: redirect to admin login
  if (!isAdmin) {
    router.replace('/admin/login');
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <span className="text-stone-500">Redirecting…</span>
      </div>
    );
  }

  // Wait for session verification (cookie valid?) before showing admin UI
  if (sessionVerified === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <span className="text-stone-500">Redirecting…</span>
      </div>
    );
  }
  if (sessionVerified !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <span className="text-stone-500">Verifying…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-stone-100">
      <aside className="w-56 flex-shrink-0 border-r border-stone-200 bg-white p-4">
        <Link href="/admin" className="block font-semibold text-charcoal">
          BLURE Admin
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded px-3 py-2 text-sm ${
                pathname === item.href ? 'bg-stone-200 font-medium text-charcoal' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 border-t border-stone-200 pt-4">
          <Link href="/" className="text-sm text-stone-500 hover:text-charcoal">
            ← Back to site
          </Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await fetch(`${getApiBase()}/api/auth/admin-logout`, { credentials: 'include' });
              } catch (_) {}
              clearAdminLoggedIn();
              router.push('/');
            }}
            className="mt-2 block text-sm text-stone-500 hover:text-charcoal"
          >
            Log out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
