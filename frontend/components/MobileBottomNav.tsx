'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCartCount, getValidatedCartFromApi, isUserLoggedIn, getWishlist, refreshUserSession } from '@/lib/api';

const items = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/cart', label: 'Cart', icon: 'bag' },
  { href: '/wishlist', label: 'Wishlist', icon: 'heart' },
  { href: '/#contact', label: 'Contact', icon: 'chat' },
  { href: '/login', label: 'Profile', icon: 'user' },
] as const;

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const outline = 'none';
  const stroke = active ? 'currentColor' : 'currentColor';
  const className = active ? 'h-5 w-5' : 'h-5 w-5';
  switch (type) {
    case 'home':
      return (
        <svg className={className} fill={active ? 'currentColor' : outline} stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M20.25 12H3.75" />
        </svg>
      );
    case 'bag':
      return (
        <svg className={className} fill={outline} stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      );
    case 'heart':
      return (
        <svg className={className} fill={active ? 'currentColor' : outline} stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      );
    case 'chat':
      return (
        <svg className={className} fill={outline} stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.338A5.312 5.312 0 0115.67 18.5c0 .53-.21 1.04-.586 1.414-.375.375-.885.586-1.414.586a5.312 5.312 0 00-3.27 1.086 9.764 9.764 0 01-2.555.338C4.03 20.25 0 16.556 0 12S4.03 3.75 9 3.75s9 3.694 9 8.25z" />
        </svg>
      );
    case 'user':
      return (
        <svg className={className} fill={outline} stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  const [cartCount, setCartCount] = useState(0);
  const [wishlistCount, setWishlistCount] = useState(0);
  useEffect(() => {
    const refreshCart = () => {
      if (isUserLoggedIn()) {
        getValidatedCartFromApi()
          .then(({ items }) => setCartCount(items.reduce((s, i) => s + i.quantity, 0)))
          .catch(() => setCartCount(0));
      } else {
        setCartCount(getCartCount());
      }
    };
    const refreshWishlist = () => setWishlistCount(getWishlist().length);

    refreshUserSession().finally(() => refreshCart());
    refreshWishlist();

    window.addEventListener('cart-updated', refreshCart);
    window.addEventListener('wishlist-updated', refreshWishlist);
    return () => {
      window.removeEventListener('cart-updated', refreshCart);
      window.removeEventListener('wishlist-updated', refreshWishlist);
    };
  }, []);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/#contact') return false;
    return pathname?.startsWith(href.replace(/#.*/, '')) ?? false;
  };

  return (
    <nav
      className="fixed bottom-4 left-4 right-4 z-40 mx-auto flex max-w-md items-center justify-around rounded-full bg-[#1e3a5f] px-4 py-3 shadow-lg md:hidden"
      aria-label="Mobile navigation"
    >
      {items.map(({ href, label, icon }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center rounded-full p-2.5 transition-colors ${
              active ? 'text-white' : 'text-white/70 hover:text-white/90'
            }`}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
          >
            {icon === 'bag' && cartCount > 0 ? (
              <span className="relative inline-block">
                <NavIcon type={icon} active={active} />
                <span className="absolute -right-2 -top-1 flex min-w-[14px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-medium leading-4 text-white">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              </span>
            ) : icon === 'heart' && wishlistCount > 0 ? (
              <span className="relative inline-block">
                <NavIcon type={icon} active={active} />
                <span className="absolute -right-2 -top-1 flex min-w-[14px] items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-medium leading-4 text-white">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              </span>
            ) : (
              <NavIcon type={icon} active={active} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
