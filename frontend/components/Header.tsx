'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import SearchOverlay from '@/components/SearchOverlay';

const navLinks = [
  { href: '/products', label: 'COLLECTION' },
  { href: '/products', label: 'GIFTS' },
  { href: '/products', label: 'STORE' },
  { href: '#contacts', label: 'CONTACTS' },
];

const SCROLL_THRESHOLD = 0.1; // 10% of viewport height

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const checkScroll = () => {
      const threshold = window.innerHeight * SCROLL_THRESHOLD;
      setScrolled(window.scrollY > threshold);
    };
    checkScroll();
    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const isSticky = scrolled;
  const textClass = isSticky ? 'text-charcoal' : 'text-white';
  const textMutedClass = isSticky ? 'text-charcoal/90' : 'text-white/90';
  const lineClass = isSticky ? 'bg-charcoal/60' : 'bg-white/60';

  return (
    <header
      className={`left-0 right-0 z-50 w-full transition-all duration-300 ${
        isSticky ? 'fixed top-0 bg-white/95 shadow-md backdrop-blur-sm' : 'absolute top-8 bg-transparent'
      }`}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pt-5 pb-4 sm:px-6 lg:px-8">
        {/* Row 1: Logo (center) + Icons (right) */}
        <div className="relative flex items-center justify-between">
          <div className="flex-1 md:min-w-0 mt-10" aria-hidden />
          <Link href="/" className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center">
            <span className={`font-serif text-2xl font-medium tracking-wide transition-colors duration-300 sm:text-3xl ${textClass}`}>
              BLURE
            </span>
            <span className={`mt-0.5 font-sans text-[10px] font-light uppercase tracking-[0.35em] transition-colors duration-300 ${textMutedClass}`}>
              THE MAISON BLURE
            </span>
            <span className={`mt-1 block h-px w-12 transition-colors duration-300 ${lineClass}`} aria-hidden />
          </Link>
          <div className="flex flex-1 items-center justify-end gap-6 md:gap-8">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className={`hidden transition-opacity hover:opacity-80 md:block ${textMutedClass}`}
              aria-label="Search"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </button>
            <Link href="#" className={`hidden transition-opacity hover:opacity-80 md:block ${textMutedClass}`} aria-label="Store locations">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
            </Link>
            <Link href="/login" className={`hidden transition-opacity hover:opacity-80 md:block ${textMutedClass}`} aria-label="Account">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </Link>
            <Link href="/wishlist" className={`hidden transition-opacity hover:opacity-80 md:block ${textMutedClass}`} aria-label="Wishlist">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </Link>
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setLangOpen((o) => !o)}
                className={`flex items-center gap-1 font-sans text-xs font-light uppercase tracking-wider transition-colors duration-300 ${textClass}`}
                aria-expanded={langOpen}
                aria-haspopup="listbox"
                aria-label="Language"
              >
                EN
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {langOpen && (
                <ul
                  className="absolute right-0 top-full mt-2 min-w-[4rem] rounded border border-white/20 bg-charcoal/95 py-2 backdrop-blur-sm"
                  role="listbox"
                >
                  <li><button type="button" className="w-full px-4 py-1 text-left text-sm text-white hover:bg-white/10" role="option">EN</button></li>
                  <li><button type="button" className="w-full px-4 py-1 text-left text-sm text-white hover:bg-white/10" role="option">FR</button></li>
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className={`flex h-10 w-10 items-center justify-center transition-colors duration-300 md:hidden ${textClass}`}
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

        {/* Row 2: Nav links under the logo (hidden on mobile, in hamburger instead) */}
        <nav className="mt-12 hidden justify-center gap-8 md:flex md:gap-16" aria-label="Main">
          {navLinks.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className={`font-sans text-xs font-light uppercase tracking-[0.25em] transition-opacity duration-300 hover:opacity-80 ${textClass}`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-white/20 bg-charcoal/98 px-4 py-6 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={() => { setSearchOpen(true); setMobileOpen(false); }}
            className="mb-4 flex items-center gap-2 font-sans text-xs uppercase tracking-wider text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            Search
          </button>
          <nav className="flex flex-col gap-4">
            {navLinks.map(({ href, label }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="font-sans text-xs font-light uppercase tracking-[0.2em] text-white"
              >
                {label}
              </Link>
            ))}
            <Link href="/login" onClick={() => setMobileOpen(false)} className="font-sans text-xs uppercase tracking-wider text-white">Login</Link>
            <Link href="/register" onClick={() => setMobileOpen(false)} className="font-sans text-xs uppercase tracking-wider text-white">Register</Link>
          </nav>
        </div>
      )}
    <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
