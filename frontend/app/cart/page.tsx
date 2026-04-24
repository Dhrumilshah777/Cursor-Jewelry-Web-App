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

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [subtotal, setSubtotal] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
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

  if (!mounted || loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading cart…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Cart
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {items.length === 0
            ? 'Your cart is empty.'
            : `${items.reduce((s, i) => s + i.quantity, 0)} item${items.reduce((s, i) => s + i.quantity, 0) === 1 ? '' : 's'} in your cart.`}
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded border border-stone-200 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">Add products from the collection or product pages.</p>
            <Link
              href="/products"
              className="mt-4 inline-block text-sm font-medium text-charcoal underline hover:no-underline"
            >
              Browse products
            </Link>
            <span className="mx-2 text-stone-400">·</span>
            <Link
              href="/"
              className="text-sm font-medium text-charcoal underline hover:no-underline"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <ul className="mt-8 divide-y divide-stone-200 border border-stone-200 rounded-lg bg-white">
              {items.map((item) => (
                <li key={item.id} className="flex flex-col sm:flex-row gap-4 p-4 sm:p-6">
                  <Link href={productHref(item)} className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 overflow-hidden rounded-md bg-stone-100">
                    <img
                      src={imageSrc(item.image)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={productHref(item)} className="font-sans font-semibold text-charcoal hover:underline">
                      {item.name}
                    </Link>
                    <p className="mt-1 text-sm text-stone-500">₹{item.price} each</p>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center border border-stone-300 rounded">
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.id, item.quantity - 1)}
                          className="h-8 w-8 flex items-center justify-center text-stone-600 hover:bg-stone-100"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm font-medium" aria-live="polite">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantity(item.id, item.quantity + 1)}
                          className="h-8 w-8 flex items-center justify-center text-stone-600 hover:bg-stone-100"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemove(item.id)}
                        className="text-sm text-stone-500 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="font-sans font-semibold text-charcoal">
                      ₹{(cartItemSubtotal(item)).toFixed(2)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="font-sans text-lg font-semibold text-charcoal">
                Subtotal: ₹{displaySubtotal.toFixed(2)}
              </p>
              <div className="flex gap-3">
                <Link
                  href="/products"
                  className="rounded border border-stone-300 px-4 py-2.5 text-sm font-medium text-charcoal hover:bg-stone-50"
                >
                  Continue shopping
                </Link>
                <Link
                  href={isUserLoggedIn() ? '/checkout' : '/login?returnTo=/checkout'}
                  className="rounded bg-charcoal px-4 py-2.5 text-sm font-medium text-white hover:bg-stone-800"
                >
                  Proceed to checkout
                </Link>
              </div>
            </div>
            {!isUserLoggedIn() && (
              <p className="mt-4 text-sm text-stone-500">
                Sign in when you proceed to checkout; your cart will be kept.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
