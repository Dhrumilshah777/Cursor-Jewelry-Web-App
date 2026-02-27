'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getWishlist, removeFromWishlist, assetUrl, type WishlistProduct } from '@/lib/api';

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistProduct[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) setItems(getWishlist());
  }, [mounted]);

  const handleRemove = (productId: string) => {
    removeFromWishlist(productId);
    setItems(getWishlist());
  };

  if (!mounted) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading wishlist…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Wishlist
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {items.length === 0
            ? 'Your wishlist is empty.'
            : `${items.length} item${items.length === 1 ? '' : 's'} saved.`}
        </p>

        {items.length === 0 ? (
          <div className="mt-8 rounded border border-stone-200 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">Add items from the Latest Beauty section by clicking the heart icon.</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-charcoal underline hover:no-underline"
            >
              ← Back to home
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((product) => (
              <li
                key={product.id}
                className="group flex flex-col overflow-hidden rounded border border-stone-200 bg-white"
              >
                <Link href={`/products/${product.id}`} className="block flex-1">
                  <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                    <img
                      src={
                        product.image.startsWith('http')
                          ? product.image
                          : product.image.startsWith('/uploads/')
                            ? assetUrl(product.image)
                            : product.image
                      }
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">
                      {product.name}
                    </h2>
                    <p className="mt-1 text-xs text-stone-500">{product.category}</p>
                    <p className="mt-2 font-sans text-sm font-semibold text-charcoal">{product.price}$</p>
                  </div>
                </Link>
                <div className="border-t border-stone-100 p-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(product.id)}
                    className="w-full rounded py-2 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-charcoal"
                  >
                    Remove from wishlist
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 && (
          <p className="mt-8">
            <Link href="/" className="text-sm text-charcoal underline hover:no-underline">
              ← Back to home
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
