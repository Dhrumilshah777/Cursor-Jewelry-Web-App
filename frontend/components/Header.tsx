'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import SearchOverlay from '@/components/SearchOverlay';
import { getCartCount, getCartFromApi, isUserLoggedIn } from '@/lib/api';

const mainNavLinks = [
  { href: '/', label: 'HOME' },
  { href: '/products?category=engagement-rings', label: 'ENGAGEMENT RINGS' },
  { href: '/products?category=wedding-rings', label: 'WEDDING RINGS' },
  { href: '/products?category=fine-jewellery', label: 'FINE JEWELLERY' },
  { href: '/products?category=custom', label: 'CUSTOM DESIGN' },
  { href: '/products?category=diamonds', label: 'DIAMONDS' },
  { href: '/products', label: 'GIFTS' },
  { href: '/blog', label: 'BLOG' },
  { href: '#contact', label: 'CONTACT' },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      if (isUserLoggedIn()) {
        getCartFromApi()
          .then((items) => setCartCount(items.reduce((s, i) => s + i.quantity, 0)))
          .catch(() => setCartCount(0));
      } else {
        setCartCount(getCartCount());
      }
    };
    refresh();
    window.addEventListener('cart-updated', refresh);
    return () => window.removeEventListener('cart-updated', refresh);
  }, []);

  return (
    <header className="sticky top-0 left-0 right-0 z-50 w-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      {/* 1. Top promotional banner – theme brown */}
      <div className="bg-[#1e3a5f] py-1.5 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-white sm:text-sm">
          FLAT 10% OFF FIRST PURCHASE. CODE SAVE10
        </p>
      </div>

      {/* 2. Main header – white */}
      <div className="border-b border-stone-100 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-3 py-2 sm:px-6 lg:px-8">
          {/* Left: Search on mobile; Book appointment on desktop */}
          <div className="flex min-w-0 flex-1 items-center justify-start">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-10 w-10 items-center justify-center text-stone-700 md:hidden"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <Link
              href="#appointment"
              className="hidden text-xs font-medium uppercase tracking-wider text-stone-800 underline underline-offset-2 hover:text-stone-600 md:block"
            >
              Book a virtual appointment
            </Link>
          </div>

          {/* Center: Logo + brand name */}
          <Link href="/" className="flex flex-shrink-0 flex-col items-center">
            <span className="flex items-center justify-center font-serif text-2xl font-semibold tracking-tight text-[#1e3a5f] sm:text-3xl">
              <span className="relative">
                TB
                <svg
                  className="absolute -right-1 -top-3 h-3 w-3 text-[#1e3a5f] sm:-top-4 sm:h-4 sm:w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden
                >
                  <path d="M12 2L14.5 8.5L21 9L16 13.5L17.5 20L12 17L6.5 20L8 13.5L3 9L9.5 8.5L12 2Z" />
                </svg>
              </span>
            </span>
            <span className="mt-0.5 font-serif text-sm font-medium uppercase tracking-[0.2em] text-stone-800 sm:text-base">
              The Bride Jewelry
            </span>
          </Link>

          {/* Right: Search, Account, Wishlist, Cart (outline icons) */}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-6 md:gap-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden text-stone-700 transition-opacity hover:opacity-70 md:block"
              aria-label="Search"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <Link href="/login" className="hidden text-stone-700 transition-opacity hover:opacity-70 md:block" aria-label="Account">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </Link>
            <Link href="/wishlist" className="hidden text-stone-700 transition-opacity hover:opacity-70 md:block" aria-label="Wishlist">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </Link>
            <Link href="/cart" className="relative hidden text-stone-700 transition-opacity hover:opacity-70 md:block" aria-label="Cart">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-medium text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center text-stone-700 md:hidden"
              aria-expanded={mobileOpen}
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* 3. Bottom navigation – horizontal links (visible only 1024px+) */}
        <nav className="border-t border-stone-100 py-2" aria-label="Main">
          <div className="mx-auto hidden max-w-7xl flex-wrap items-center justify-center gap-6 px-4 sm:gap-8 sm:px-6 lg:flex lg:gap-10 lg:px-8">
            {mainNavLinks.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                className="font-sans text-xs font-medium uppercase tracking-[0.15em] text-stone-800 transition-opacity hover:opacity-70"
              >
                {label}
              </Link>
            ))}
          </div>
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-stone-200 bg-white px-4 py-6 shadow-lg md:hidden">
          <button
            type="button"
            onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
            className="mb-4 flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-wider text-stone-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search
          </button>
          <nav className="flex flex-col gap-4">
            {mainNavLinks.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="font-sans text-xs font-medium uppercase tracking-wider text-stone-800"
              >
                {label}
              </Link>
            ))}
            <Link href="/cart" onClick={() => setMobileOpen(false)} className="font-sans text-xs font-medium uppercase tracking-wider text-stone-800">
              Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            </Link>
            <Link href="/login" onClick={() => setMobileOpen(false)} className="font-sans text-xs font-medium uppercase tracking-wider text-stone-800">
              Login
            </Link>
            <Link href="/register" onClick={() => setMobileOpen(false)} className="font-sans text-xs font-medium uppercase tracking-wider text-stone-800">
              Register
            </Link>
          </nav>
        </div>
      )}

      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
