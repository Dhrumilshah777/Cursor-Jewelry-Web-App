'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getCart,
  getValidatedCartFromApi,
  setCartApi,
  removeFromCart,
  updateCartQuantity,
  isUserLoggedIn,
  refreshUserSession,
  assetUrl,
  type CartItem,
} from '@/lib/api';
import { productHref } from '@/lib/productLink';

function cartItemSubtotal(item: CartItem): number {
  const p = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
  return p * item.quantity;
}

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

function formatInr(amount: number): string {
  try {
    return amount.toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    });
  } catch {
    return `₹${Math.round(amount).toLocaleString('en-IN')}`;
  }
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [giftBoxSelected, setGiftBoxSelected] = useState(false);
  const isUser = typeof window !== 'undefined' && !!isUserLoggedIn();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    (async () => {
      const ok = await refreshUserSession();
      if (ok) {
        getValidatedCartFromApi()
          .then(({ items: validated, subtotal: total }) => {
            setItems(validated);
            setSubtotal(total);
          })
          .catch(() => setItems([]))
          .finally(() => setLoading(false));
      } else {
        setItems(getCart());
        setSubtotal(getCart().reduce((sum, i) => sum + (parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0) * i.quantity, 0));
        setLoading(false);
      }
    })();
  }, [mounted]);

  const refreshValidated = () => {
    if (isUserLoggedIn()) {
      getValidatedCartFromApi().then(({ items: validated, subtotal: total }) => {
        setItems(validated);
        setSubtotal(total);
      }).catch(() => {});
    }
  };

  const handleRemove = async (productId: string) => {
    if (isUserLoggedIn()) {
      const next = items.filter((i) => i.id !== productId);
      try {
        await setCartApi(next);
        refreshValidated();
      } catch (_) {}
    } else {
      removeFromCart(productId);
      setItems(getCart());
      setSubtotal(getCart().reduce((sum, i) => sum + (parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0) * i.quantity, 0));
    }
  };

  const handleQuantity = async (productId: string, quantity: number) => {
    if (quantity < 1) {
      handleRemove(productId);
      return;
    }
    // Customers should not be able to increase quantity from the cart UI.
    const current = items.find((i) => i.id === productId)?.quantity;
    if (typeof current === 'number' && quantity > current) {
      return;
    }
    if (isUserLoggedIn()) {
      const next = items.map((i) => (i.id === productId ? { ...i, quantity } : i));
      try {
        await setCartApi(next);
        refreshValidated();
      } catch (_) {}
    } else {
      updateCartQuantity(productId, quantity);
      setItems(getCart());
      setSubtotal(getCart().reduce((sum, i) => sum + (parseFloat(String(i.price).replace(/[^0-9.]/g, '')) || 0) * i.quantity, 0));
    }
  };

  const displaySubtotal = isUser ? subtotal : items.reduce((sum, i) => sum + cartItemSubtotal(i), 0);
  const promoDiscount = items.length ? Math.round(displaySubtotal * 0.1) : 0;
  const shipping = 0;
  const giftBoxPrice = giftBoxSelected ? 499 : 0;
  const displayTotal = Math.max(0, displaySubtotal - promoDiscount + shipping + giftBoxPrice);

  if (!mounted || loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <p className="text-text-muted">Loading cart…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] bg-body px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <nav className="text-xs text-text-muted">
          <Link href="/" className="hover:text-text">
            Home
          </Link>
          <span className="mx-2">›</span>
          <span className="text-text">Cart</span>
        </nav>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-sans text-3xl font-semibold text-text">Your Cart</h1>
            <p className="mt-1 text-sm text-text-muted">Review your items and proceed to checkout</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V7.875a4.5 4.5 0 00-9 0V10.5M6.75 10.5h10.5l.75 10.5a1.125 1.125 0 01-1.125 1.2H7.125A1.125 1.125 0 016 21l.75-10.5z"
              />
            </svg>
            Secure Shopping
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded border border-border bg-card p-8 text-center">
            <p className="text-text-muted">Add products from the collection or product pages.</p>
            <Link
              href="/products"
              className="mt-4 inline-block text-sm font-medium text-text underline hover:no-underline"
            >
              Browse products
            </Link>
            <span className="mx-2 text-stone-400">·</span>
            <Link
              href="/"
              className="text-sm font-medium text-text underline hover:no-underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <section className="lg:col-span-2">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="hidden grid-cols-[1fr_120px_140px_140px] gap-4 border-b border-border bg-body px-6 py-4 text-xs font-semibold uppercase tracking-wide text-text-muted sm:grid">
                    <div>Product</div>
                    <div className="text-center">Quantity</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                  </div>

                  <ul className="divide-y divide-border">
                    {items.map((item) => {
                      const unit = parseFloat(String(item.price).replace(/[^0-9.]/g, '')) || 0;
                      const lineTotal = cartItemSubtotal(item);
                      return (
                        <li key={item.id} className="p-4 sm:px-6 sm:py-5">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_120px_140px_140px] sm:items-center">
                            <div className="flex min-w-0 gap-4">
                              <Link
                                href={productHref(item)}
                                className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100"
                              >
                                <img src={imageSrc(item.image)} alt="" className="h-full w-full object-cover" />
                              </Link>
                              <div className="min-w-0">
                                <Link
                                  href={productHref(item)}
                                  className="block truncate font-sans text-sm font-semibold text-text hover:underline"
                                >
                                  {item.name}
                                </Link>
                                <p className="mt-1 text-xs text-text-muted">18K Gold</p>
                                <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
                                  <button type="button" className="hover:text-text">
                                    ♡ Move to Wishlist
                                  </button>
                                  <span className="text-border">|</span>
                                  <button type="button" onClick={() => handleRemove(item.id)} className="hover:text-red-600">
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-start gap-3 sm:justify-center">
                              <div className="flex items-center rounded-lg border border-border bg-card">
                                <button
                                  type="button"
                                  onClick={() => handleQuantity(item.id, item.quantity - 1)}
                                  className="flex h-9 w-9 items-center justify-center text-text-muted hover:bg-body"
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <span className="w-10 text-center text-sm font-medium text-text" aria-live="polite">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  disabled
                                  className="flex h-9 w-9 cursor-not-allowed items-center justify-center text-text-muted/40"
                                  aria-label="Increase quantity (disabled)"
                                  title="Quantity increases are disabled"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:block sm:text-right">
                              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted sm:hidden">
                                Price
                              </span>
                              <p className="font-sans text-sm font-semibold text-text">{formatInr(unit)}</p>
                            </div>

                            <div className="flex items-center justify-between sm:block sm:text-right">
                              <span className="text-xs font-semibold uppercase tracking-wide text-text-muted sm:hidden">
                                Total
                              </span>
                              <p className="font-sans text-sm font-semibold text-text">{formatInr(lineTotal)}</p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="border-t border-border bg-body px-4 py-4 sm:px-6">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-50 text-text" aria-hidden>
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 22s7-4.5 7-11V6l-7-4-7 4v5c0 6.5 7 11 7 11z"
                          />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12l1.8 1.8L15 10" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-text">Add a gift box to your order</p>
                        <p className="text-xs text-text-muted">Make it extra special</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setGiftBoxSelected((v) => !v)}
                        className={`rounded-lg border px-4 py-2 text-sm font-semibold ${
                          giftBoxSelected
                            ? 'border-accent bg-accent text-white hover:bg-accent-hover'
                            : 'border-border bg-card text-text hover:bg-body'
                        }`}
                      >
                        {giftBoxSelected ? 'Added' : 'Add Gift Box'}{' '}
                        <span className="ml-2 text-xs font-medium opacity-80">₹499</span>
                      </button>
                    </div>
                  </div>
                </div>

                {!isUserLoggedIn() && (
                  <p className="mt-4 text-sm text-text-muted">Sign in when you proceed to checkout; your cart will be kept.</p>
                )}
              </section>

              <aside className="lg:col-span-1">
                <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-text">Order Summary</h2>
                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                      <span className="font-medium text-text">{formatInr(displaySubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Shipping</span>
                      <span className="font-medium text-green-600">{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span>Discount (SAVE10)</span>
                      <span className="font-medium text-green-600">-{formatInr(promoDiscount)}</span>
                    </div>
                    {giftBoxSelected && (
                      <div className="flex items-center justify-between text-text-muted">
                        <span>Gift box</span>
                        <span className="font-medium text-text">{formatInr(giftBoxPrice)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <span className="text-base font-semibold text-text">Total</span>
                      <span className="text-2xl font-semibold text-text">{formatInr(displayTotal)}</span>
                    </div>
                    <p className="text-xs text-green-700">You saved {formatInr(promoDiscount)}.</p>
                  </div>

                  <div className="mt-5 space-y-3">
                    <Link
                      href={isUserLoggedIn() ? '/checkout' : '/login?returnTo=/checkout'}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-text px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 10.5V7.875a4.5 4.5 0 00-9 0V10.5M6.75 10.5h10.5l.75 10.5a1.125 1.125 0 01-1.125 1.2H7.125A1.125 1.125 0 016 21l.75-10.5z"
                        />
                      </svg>
                      PROCEED TO CHECKOUT
                    </Link>
                    <Link
                      href="/products"
                      className="flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold text-text hover:bg-body"
                    >
                      CONTINUE SHOPPING
                    </Link>
                  </div>

                  <div className="mt-5 border-t border-border pt-5">
                    <p className="text-xs text-text-muted">We Accept</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {['VISA', 'Mastercard', 'AMEX', 'RuPay', 'UPI'].map((x) => (
                        <span
                          key={x}
                          className="rounded border border-border bg-body px-2 py-1 text-[11px] font-semibold text-text-muted"
                        >
                          {x}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <section className="mt-10 grid gap-4 border-t border-border pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  title: 'CERTIFIED JEWELRY',
                  subtitle: '100% Authentic',
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l3 6 6 .8-4.4 4.3 1 6-5.6-3-5.6 3 1-6L3 8.8 9 8l3-6z" />
                    </svg>
                  ),
                },
                {
                  title: '100% SECURE PAYMENTS',
                  subtitle: 'Safe & Encrypted',
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s7-4.5 7-11V6l-7-4-7 4v5c0 6.5 7 11 7 11z" />
                    </svg>
                  ),
                },
                {
                  title: 'EASY RETURNS',
                  subtitle: '15 Days Return Policy',
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 0115.5-6.4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 5.6V9h-3.4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-15.5 6.4" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 18.4V15h3.4" />
                    </svg>
                  ),
                },
                {
                  title: 'DEDICATED SUPPORT',
                  subtitle: "We’re here to help",
                  icon: (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0116 0v5a3 3 0 01-3 3h-1" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 17v-5a5 5 0 0110 0v5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6" />
                    </svg>
                  ),
                },
              ].map((b) => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="mt-0.5 text-text">{b.icon}</div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text">{b.title}</p>
                    <p className="mt-1 text-xs text-text-muted">{b.subtitle}</p>
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
