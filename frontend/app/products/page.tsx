'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

function productImageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

/** Normalize for comparison: "Sea cut" / "sea-cut" -> "sea-cut" */
function categoryToSlug(category: string) {
  return category.toLowerCase().trim().replace(/\s+/g, '-');
}

function matchesCategory(productCategory: string, urlCategory: string) {
  if (!urlCategory) return true;
  return categoryToSlug(productCategory) === urlCategory.toLowerCase().trim();
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Product[] & { _id?: string }[]>('/api/products')
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setProducts(
            list.map((p) => ({
              _id: String((p as { _id?: string })._id ?? ''),
              name: p.name,
              category: p.category,
              price: p.price,
              image: p.image,
            }))
          );
        }
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredProducts = categoryParam
    ? products.filter((p) => matchesCategory(p.category, categoryParam))
    : products;

  const categoryLabel = categoryParam
    ? categoryParam.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  if (loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-stone-500">Loading products…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          {categoryLabel ? `${categoryLabel}` : 'Products'}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {filteredProducts.length === 0
            ? categoryParam
              ? `No products in this category.`
              : 'No products yet.'
            : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}${categoryParam ? ' in this category' : ''}.`}
        </p>

        {categoryParam && (
          <p className="mt-2">
            <Link
              href="/products"
              className="text-sm text-charcoal underline hover:no-underline"
            >
              ← Show all products
            </Link>
          </p>
        )}

        {filteredProducts.length === 0 ? (
          <div className="mt-8 rounded border border-stone-200 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">
              {categoryParam
                ? 'No products in this category yet.'
                : 'Products added in the admin will appear here.'}
            </p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-charcoal underline hover:no-underline">
              ← Back to home
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <li
                key={product._id}
                className="group flex flex-col overflow-hidden rounded border border-stone-200 bg-white"
              >
                <Link href={`/products/${product._id}`} className="block flex-1">
                  <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
                    <img
                      src={productImageSrc(product.image)}
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
              </li>
            ))}
          </ul>
        )}

        {filteredProducts.length > 0 && (
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

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[50vh] px-4 py-12">
          <div className="mx-auto max-w-6xl">
            <p className="text-stone-500">Loading…</p>
          </div>
        </main>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}
