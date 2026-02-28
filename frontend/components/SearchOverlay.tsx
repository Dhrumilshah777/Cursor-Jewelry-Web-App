'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const POPULAR_SEARCHES = [
  { label: 'Rings', href: '/products?category=rings' },
  { label: 'Necklaces', href: '/products?category=necklaces' },
  { label: 'Earrings', href: '/products?category=earrings' },
  { label: 'Bracelets', href: '/products?category=bracelets' },
];

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

const SUGGESTED_COUNT = 5;

type SearchOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function SearchOverlay({ isOpen, onClose }: SearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [suggestedProducts, setSuggestedProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isVisible) {
      inputRef.current?.focus();
    }
  }, [isOpen, isVisible]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Fetch first 5 newest products for "Suggested for you" when overlay opens (API returns newest first)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    apiGet<(Product & { _id?: string })[]>('/api/products')
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const normalized = list.slice(0, SUGGESTED_COUNT).map((p) => ({
          id: p.id || p._id?.toString?.() || '',
          name: p.name || '',
          category: p.category || '',
          price: typeof p.price === 'number' ? String(p.price) : (p.price || ''),
          image: p.image || '',
        }));
        setSuggestedProducts(normalized.filter((p) => p.id && p.name));
      })
      .catch(() => setSuggestedProducts([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-white transition-transform duration-300 ease-out"
      style={{ transform: isVisible ? 'translateY(0)' : 'translateY(-100%)' }}
    >
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 pt-8 pb-12 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex flex-1 items-center">
            <input
              ref={inputRef}
              type="search"
              placeholder="Search products..."
              className="w-full border-0 border-b border-stone-200 bg-transparent py-3 pr-10 font-sans text-charcoal placeholder-stone-400 outline-none focus:border-charcoal"
              aria-label="Search products"
            />
            <span className="pointer-events-none absolute right-0 text-stone-400" aria-hidden>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-stone-500 transition-colors hover:text-charcoal"
            aria-label="Close search"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mt-12">
          <h3 className="font-sans text-xs font-medium uppercase tracking-wider text-stone-500">
            Popular searches
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {POPULAR_SEARCHES.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={onClose}
                className="rounded-full bg-stone-100 px-4 py-2 font-sans text-sm text-charcoal transition-colors hover:bg-stone-200"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <h3 className="font-sans text-xs font-medium uppercase tracking-wider text-stone-500">
            Suggested for you
          </h3>
          {suggestedProducts.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {suggestedProducts.map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/products/${product.id}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-sm py-2 transition-colors hover:bg-stone-50"
                  >
                    <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-stone-100">
                      <img
                        src={
                          product.image.startsWith('http')
                            ? product.image
                            : product.image.startsWith('/uploads/')
                            ? assetUrl(product.image)
                            : product.image || ''
                        }
                        alt=""
                        className="h-full w-full object-cover object-center"
                      />
                    </span>
                    <span className="font-sans text-sm font-medium text-charcoal">{product.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 font-sans text-sm text-stone-400">Start typing to see suggestions.</p>
          )}
        </div>
      </div>
    </div>
  );
}
