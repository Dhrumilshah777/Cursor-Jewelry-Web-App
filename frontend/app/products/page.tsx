'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, assetUrl, addToWishlist, removeFromWishlist, getWishlist } from '@/lib/api';
import FilterSidebar, { type Facets } from '@/components/FilterSidebar';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  colors?: string[];
  stock?: number;
};

/** Mirrors backend `categoryToSlug` so filters match URL query params. */
function categoryToSlug(cat: string) {
  return String(cat || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') || '';
}

function numPrice(p: Product) {
  return parseFloat(p.price || '0') || 0;
}

/** Same rules as `productController.list` — catalog is fetched once, filtered here. */
function filterProducts(products: Product[], params: URLSearchParams): Product[] {
  const categorySlug = (params.get('category') || '').toString().trim().toLowerCase();
  const minPrice = parseFloat(params.get('minPrice') || '');
  const maxPrice = parseFloat(params.get('maxPrice') || '');
  const colorParam = (params.get('color') || '').toString().trim();
  const colorsFilter = colorParam ? colorParam.split(',').map((c) => c.trim()).filter(Boolean) : [];

  let filtered = products;
  if (categorySlug) {
    filtered = filtered.filter((p) => categoryToSlug(p.category) === categorySlug);
  }
  if (Number.isFinite(minPrice) && minPrice > 0) {
    filtered = filtered.filter((p) => numPrice(p) >= minPrice);
  }
  if (Number.isFinite(maxPrice) && maxPrice > 0) {
    filtered = filtered.filter((p) => numPrice(p) <= maxPrice);
  }
  if (colorsFilter.length > 0) {
    filtered = filtered.filter((p) => {
      const productColors = (p.colors || []).map((c) => String(c).trim().toLowerCase());
      return colorsFilter.some((c) => productColors.includes(c.toLowerCase()));
    });
  }
  return filtered;
}

type ProductsResponse = { products: Product[]; facets: Facets };

function productImageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

const defaultFacets: Facets = {
  totalProducts: 0,
  categories: [],
  priceRange: { min: 0, max: 0 },
  colors: [],
};

const SKELETON_CARD_COUNT = 6;

function ProductsLoadingSkeleton() {
  return (
    <main className="min-h-[50vh] px-4 py-12" aria-busy="true" aria-label="Loading products">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-8 w-40 rounded-md bg-stone-200 sm:w-56" />
        <div className="mt-2 h-4 w-28 rounded bg-stone-100" />

        <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
          <div className="h-10 w-28 rounded-full bg-stone-200" />
          <div className="h-4 w-14 rounded bg-stone-100" />
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          <div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
            <div className="rounded border border-stone-200 bg-white p-5">
              <div className="h-4 w-16 rounded bg-stone-200" />
              <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
                <div className="h-4 w-full rounded bg-stone-100" />
                <div className="h-4 w-5/6 rounded bg-stone-100" />
                <div className="h-4 w-4/5 rounded bg-stone-100" />
                <div className="h-4 w-full rounded bg-stone-100" />
                <div className="h-4 w-3/4 rounded bg-stone-100" />
              </div>
              <div className="mt-6 space-y-3 border-t border-stone-100 pt-4">
                <div className="h-4 w-24 rounded bg-stone-200" />
                <div className="h-4 w-full rounded bg-stone-100" />
                <div className="h-4 w-11/12 rounded bg-stone-100" />
              </div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <ul className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
              {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                <li key={i}>
                  <div className="aspect-square w-full rounded-none bg-stone-200" />
                  <div className="min-h-[4.5rem] pt-3">
                    <div className="h-4 w-full rounded bg-stone-200" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-stone-100" />
                    <div className="mt-3 h-4 w-20 rounded bg-stone-200" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || '';
  const filterQueryKey = searchParams.toString();

  const [data, setData] = useState<ProductsResponse>({ products: [], facets: defaultFacets });
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [wishlistedIds, setWishlistedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    apiGet<ProductsResponse>('/api/products')
      .then((res) => {
        if (cancelled) return;
        const products = Array.isArray((res as { products?: Product[] }).products)
          ? (res as ProductsResponse).products
          : Array.isArray(res) ? (res as unknown as Product[]) : [];
        const facets = (res as ProductsResponse).facets || defaultFacets;
        setData({
          products: products.map((p) => {
            const raw = p as { _id?: string; colors?: string[]; stock?: number };
            return {
              _id: String(raw._id ?? ''),
              name: p.name,
              category: p.category,
              price: p.price,
              image: p.image,
              colors: Array.isArray(raw.colors) ? raw.colors : [],
              stock: typeof raw.stock === 'number' ? raw.stock : undefined,
            };
          }),
          facets,
        });
      })
      .catch(() => {
        if (!cancelled) setData({ products: [], facets: defaultFacets });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { products: allProducts, facets } = data;
  const filteredProducts = useMemo(() => {
    const params = new URLSearchParams(filterQueryKey);
    return filterProducts(allProducts, params);
  }, [allProducts, filterQueryKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setWishlistedIds(new Set(getWishlist().map((p) => p.id)));
    sync();
    window.addEventListener('wishlist-updated', sync);
    window.addEventListener('auth-updated', sync);
    return () => {
      window.removeEventListener('wishlist-updated', sync);
      window.removeEventListener('auth-updated', sync);
    };
  }, [filteredProducts.length]);
  const categoryLabel = categoryParam
    ? categoryParam.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  if (loading) {
    return <ProductsLoadingSkeleton />;
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
              ? 'No products match these filters.'
              : 'No products yet.'
            : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}.`}
        </p>

        {/* Mobile filter button */}
        <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-charcoal shadow-sm hover:bg-stone-50"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
            aria-controls="products-filter-drawer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18M6 12h12M10 20h4" />
            </svg>
            Filter
          </button>
          {searchParams.toString() && (
            <Link href="/products" className="text-sm font-medium text-charcoal underline hover:no-underline">
              Clear
            </Link>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <FilterSidebar
              facets={facets}
              totalCount={filteredProducts.length}
              className="lg:sticky lg:top-8 lg:self-start"
            />
          </div>
          <div className="min-w-0 flex-1">
            {filteredProducts.length === 0 ? (
              <div className="border border-stone-200 bg-stone-50 p-8 text-center">
                <p className="text-stone-600">
                  {searchParams.toString()
                    ? 'Try changing or clearing filters.'
                    : 'Products added in the admin will appear here.'}
                </p>
                <Link href="/products" className="mt-4 inline-block text-sm font-medium text-charcoal underline hover:no-underline">
                  Clear filters
                </Link>
                <span className="mx-2 text-stone-400">|</span>
                <Link href="/" className="text-sm font-medium text-charcoal underline hover:no-underline">
                  ← Back to home
                </Link>
              </div>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <li key={product._id} className="group">
                    <Link href={`/products/${product._id}`} className="block">
                      <div className="relative aspect-square w-full overflow-hidden rounded-none bg-stone-100">
                        <img
                          src={productImageSrc(product.image)}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {(product.stock ?? 1) <= 0 && (
                          <div className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                            Out of stock
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const id = String(product._id);
                            setWishlistedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(id)) {
                                removeFromWishlist(id);
                                next.delete(id);
                              } else {
                                addToWishlist({
                                  id,
                                  name: product.name,
                                  category: product.category,
                                  price: product.price,
                                  image: product.image,
                                });
                                next.add(id);
                              }
                              return next;
                            });
                          }}
                          className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 shadow-sm backdrop-blur transition-colors hover:bg-white ${
                            wishlistedIds.has(String(product._id))
                              ? 'border-red-200 text-red-600'
                              : 'border-stone-200 text-stone-600'
                          }`}
                          aria-label={wishlistedIds.has(String(product._id)) ? 'Remove from wishlist' : 'Add to wishlist'}
                        >
                          <svg
                            className="h-5 w-5"
                            fill={wishlistedIds.has(String(product._id)) ? 'currentColor' : 'none'}
                            stroke="currentColor"
                            strokeWidth={1.5}
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="min-h-[4.5rem] pt-3">
                        <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal line-clamp-2">
                          {product.name}
                        </h2>
                        <p className="mt-1 text-xs text-stone-500">{product.category}</p>
                        <p className="mt-2 font-sans text-sm font-semibold text-charcoal">₹{product.price}</p>
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
        </div>

        {/* Mobile filter drawer */}
        {filtersOpen && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Filters"
            id="products-filter-drawer"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setFiltersOpen(false)}
              aria-label="Close filters"
            />
            <div className="absolute right-0 top-0 h-full w-[88vw] max-w-sm overflow-auto bg-white p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Filters</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-full border border-stone-300 px-3 py-1.5 text-sm text-charcoal hover:bg-stone-50"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <FilterSidebar facets={facets} totalCount={filteredProducts.length} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<ProductsLoadingSkeleton />}>
      <ProductsContent />
    </Suspense>
  );
}
