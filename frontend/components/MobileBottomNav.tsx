'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getCartCount, getValidatedCartFromApi, isUserLoggedIn, getWishlist, refreshUserSession } from '@/lib/api';
import { triggerLoginModal } from '@/components/LoginModal';

const items = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/cart', label: 'Cart', icon: 'cart' },
  { href: '/wishlist', label: 'Wishlist', icon: 'heart' },
  { href: '/login', label: 'Account', icon: 'user' },
] as const;

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const stroke = 'currentColor';
  const className = active ? 'h-6 w-6' : 'h-6 w-6';
  switch (type) {
    case 'home':
      return (
        <svg className={className} fill="none" stroke={stroke} strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 01-1.5 1.5H4.5A1.5 1.5 0 013 20v-9.5z" />
        </svg>
      );
    case 'cart':
      return (
        <svg className={className} fill="none" stroke={stroke} strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
          />
        </svg>
      );
    case 'heart':
      return (
        <svg className={className} fill="none" stroke={stroke} strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      );
    case 'chat':
      return (
        <svg className={className} fill="none" stroke={stroke} strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-8 8H7l-4 2 1.5-4.5A8 8 0 11121 12z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01" />
        </svg>
      );
    case 'user':
      return (
        <svg className={className} fill="none" stroke={stroke} strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
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
    return pathname?.startsWith(href.replace(/#.*/, '')) ?? false;
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white md:hidden"
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
        {items.map(({ href, label, icon }) => {
          const active = isActive(href);
          const showBadge = icon === 'cart' ? cartCount : icon === 'heart' ? wishlistCount : 0;
          const isAccount = href === '/login';
          return (
            isAccount && !isUserLoggedIn() ? (
              <button
                key={href}
                type="button"
                onClick={() => triggerLoginModal(pathname || '/')}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] leading-none"
                aria-label={label}
              >
                <span className="relative text-stone-400">
                  <NavIcon type={icon} active={false} />
                </span>
                <span className="text-stone-400">{label}</span>
              </button>
            ) : (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] leading-none"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                <span className={`relative ${active ? 'text-charcoal' : 'text-stone-400'}`}>
                  <NavIcon type={icon} active={active} />
                  {icon === 'cart' && showBadge > 0 ? (
                    <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cta px-1 text-[10px] font-semibold leading-4 text-card">
                      {showBadge > 99 ? '99+' : showBadge}
                    </span>
                  ) : null}
                </span>
                <span className={`${active ? 'text-charcoal' : 'text-stone-400'}`}>{label}</span>
              </Link>
            )
          );
        })}
      </div>
    </nav>
  );
}
