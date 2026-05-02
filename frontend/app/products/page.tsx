'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, assetUrl, addToWishlist, removeFromWishlist, getWishlist } from '@/lib/api';
import { productHref } from '@/lib/productLink';
import FilterSidebar, { type Facets } from '@/components/FilterSidebar';

type Product = {
  _id: string;
  slug?: string;
  name: string;
  category: string;
  price: string;
  image: string;
  colors?: string[];
  stock?: number;
  createdAt?: string;
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
  if (image.startsWith('data:')) return image;
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

const DEMO_PRODUCTS: Product[] = [
  {
    _id: 'demo-1',
    slug: 'demo-solitaire-ring',
    name: 'Demo Solitaire Ring',
    category: 'Rings',
    price: '32450.00',
    image: 'https://live.jewelbox.co.in/wp-content/uploads/2026/03/1774873698_PER1831.jpg',
    colors: ['Yellow Gold'],
    stock: 10,
  },
  {
    _id: 'demo-2',
    slug: 'demo-gold-pendant',
    name: 'Demo Gold Pendant',
    category: 'Pendants',
    price: '12500.00',
    image:
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='800'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f5f5f4'/%3E%3Cpath%20d='M400%20160%20c-60%2040-80%2090-80%20140%200%2090%2080%20160%2080%20160%20s80-70%2080-160%20c0-50-20-100-80-140z'%20fill='%23e7e5e4'/%3E%3Cpath%20d='M320%20240%20c30-35%2060-55%2080-65%2020%2010%2050%2030%2080%2065'%20fill='none'%20stroke='%23d6d3d1'%20stroke-width='16'%20stroke-linecap='round'/%3E%3Ctext%20x='400'%20y='690'%20text-anchor='middle'%20font-family='Arial'%20font-size='30'%20fill='%23787878'%3EDemo%20Product%3C/text%3E%3C/svg%3E",
    colors: ['Rose Gold'],
    stock: 5,
  },
  {
    _id: 'demo-3',
    slug: 'demo-earrings',
    name: 'Demo Earrings',
    category: 'Earrings',
    price: '8900.00',
    image:
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='800'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23f5f5f4'/%3E%3Ccircle%20cx='320'%20cy='340'%20r='70'%20fill='%23e7e5e4'/%3E%3Ccircle%20cx='480'%20cy='340'%20r='70'%20fill='%23e7e5e4'/%3E%3Cpath%20d='M320%20410%20v120'%20stroke='%23d6d3d1'%20stroke-width='18'%20stroke-linecap='round'/%3E%3Cpath%20d='M480%20410%20v120'%20stroke='%23d6d3d1'%20stroke-width='18'%20stroke-linecap='round'/%3E%3Ctext%20x='400'%20y='690'%20text-anchor='middle'%20font-family='Arial'%20font-size='30'%20fill='%23787878'%3EDemo%20Product%3C/text%3E%3C/svg%3E",
    colors: ['White Gold'],
    stock: 3,
  },
];

function ProductsLoadingSkeleton() {
  return (
    <main className="min-h-[50vh] px-2 py-6 sm:px-3 sm:py-10 lg:px-4 lg:py-12" aria-busy="true" aria-label="Loading products">
      <div className="mx-auto max-w-7xl animate-pulse">
        {/* Top heading + desktop sort/view controls */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="h-7 w-28 rounded bg-stone-200" />
            <div className="h-4 w-56 rounded bg-stone-100" />
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex items-center gap-2">
              <div className="h-4 w-24 rounded bg-stone-100" />
              <div className="h-10 w-52 rounded bg-card border border-border" />
            </div>
            <div className="flex items-center gap-2 rounded border border-border bg-card p-1">
              <div className="h-9 w-9 rounded bg-stone-200" />
              <div className="h-9 w-9 rounded bg-stone-200" />
            </div>
          </div>
        </div>

        {/* Mobile controls placeholder */}
        <div className="mt-5 flex items-center justify-between gap-3 lg:hidden">
          <div className="h-10 w-28 rounded bg-stone-200" />
          <div className="flex items-center gap-2">
            <div className="h-10 w-32 rounded bg-stone-200" />
            <div className="h-6 w-12 rounded bg-stone-100" />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          {/* Desktop sidebar skeleton */}
          <div className="hidden lg:block lg:w-64 lg:flex-shrink-0">
            <div className="rounded border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <div className="h-4 w-16 rounded bg-stone-200" />
                <div className="h-4 w-20 rounded bg-stone-100" />
              </div>

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

          {/* Product card grid skeleton */}
          <div className="min-w-0 flex-1">
            <ul className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3">
              {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                <li key={i} className="group">
                  <div className="relative aspect-square w-full overflow-hidden rounded-none bg-stone-200">
                    <div className="absolute right-2 top-2 h-9 w-9 rounded-full bg-card border border-border" />
                  </div>
                  <div className="min-h-[7rem] pt-3">
                    <div className="h-4 w-full rounded bg-stone-100" />
                    <div className="mt-2 h-3 w-2/3 rounded bg-stone-100" />
                    <div className="mt-3 h-4 w-20 rounded bg-stone-200" />
                    <div className="mt-4 h-9 w-full rounded bg-stone-100" />
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
  const [sortBy, setSortBy] = useState<'newest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    let cancelled = false;
    apiGet<ProductsResponse>('/api/products')
      .then((res) => {
        if (cancelled) return;
        const products = Array.isArray((res as { products?: Product[] }).products)
          ? (res as ProductsResponse).products
          : Array.isArray(res) ? (res as unknown as Product[]) : [];
        const facets = (res as ProductsResponse).facets || defaultFacets;
        const normalized = products.map((p) => {
          const raw = p as { _id?: string; slug?: string; colors?: string[]; stock?: number };
          return {
            _id: String(raw._id ?? ''),
            slug: typeof raw.slug === 'string' ? raw.slug : undefined,
            name: p.name,
            category: p.category,
            price: p.price,
            image: p.image,
            colors: Array.isArray(raw.colors) ? raw.colors : [],
            stock: typeof raw.stock === 'number' ? raw.stock : undefined,
            createdAt: (p as unknown as { createdAt?: string | Date }).createdAt
              ? String((p as unknown as { createdAt?: string | Date }).createdAt)
              : undefined,
          };
        });

        // Localhost/dev convenience: show demo products when DB is empty.
        const finalProducts = normalized.length > 0 ? normalized : DEMO_PRODUCTS;
        const finalFacets = normalized.length > 0 ? facets : defaultFacets;

        setData({ products: finalProducts, facets: finalFacets });
      })
      .catch(() => {
        if (!cancelled) setData({ products: DEMO_PRODUCTS, facets: defaultFacets });
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
    const list = filterProducts(allProducts, params);
    if (sortBy === 'newest') {
      // Backend uses mongoose timestamps; we keep it optional and fall back to stable order.
      return list.slice().sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    }
    return list;
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
    <main className="min-h-[50vh] px-2 py-6 sm:px-3 sm:py-10 lg:px-4 lg:py-12">
      <div className="mx-auto max-w-7xl">
        {/* Desktop poster / hero banner */}
        <div className="mb-8 hidden lg:block">
          <div className="overflow-hidden rounded-none border border-border bg-card">
            <div className="relative h-[90px] w-full xl:h-[110px]">
              <img
                src="https://live.jewelbox.co.in/wp-content/uploads/2026/01/all_rings_web.jpg"
                alt="Products poster"
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          </div>
        </div>

        {/* Breadcrumbs (under poster on desktop) */}
        <nav aria-label="Breadcrumb" className="mb-6 hidden lg:block">
          <ol className="flex flex-wrap items-center gap-2 text-sm text-text-muted">
            <li>
              <Link href="/" className="hover:text-text">
                Home
              </Link>
            </li>
            <li aria-hidden className="text-stone-300">/</li>
            <li>
              <Link href="/products" className="hover:text-text">
                Products
              </Link>
            </li>
            {categoryLabel && (
              <>
                <li aria-hidden className="text-stone-300">/</li>
                <li className="font-medium text-text">{categoryLabel}</li>
              </>
            )}
          </ol>
        </nav>

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
            {/* Title + controls (sits directly above products) */}
            <div className="mb-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-text">
                    {categoryLabel ? `${categoryLabel}` : 'Products'}
                  </h1>
                  <p className="mt-1 text-sm text-text-muted">
                    {filteredProducts.length === 0
                      ? categoryParam
                        ? 'No products match these filters.'
                        : 'No products yet.'
                      : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}`}
                  </p>
                </div>

                {/* Mobile view toggles (grid/list) */}
                <div className="flex items-center gap-2 rounded border border-border bg-card p-1 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode('grid')}
                    className={`h-9 w-9 rounded ${viewMode === 'grid' ? 'bg-accent text-cta' : 'text-text-muted hover:bg-body'}`}
                    aria-label="Grid view"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('list')}
                    className={`h-9 w-9 rounded ${viewMode === 'list' ? 'bg-accent text-cta' : 'text-text-muted hover:bg-body'}`}
                    aria-label="List view"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-5 w-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                    </svg>
                  </button>
                </div>

                {/* Desktop sort + view controls */}
                <div className="hidden items-center gap-3 lg:flex">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-muted">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy((e.target.value as 'newest') || 'newest')}
                      className="rounded border border-border bg-card px-3 py-2 text-sm text-text"
                      aria-label="Sort products"
                    >
                      <option value="newest">Newest First</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 rounded border border-border bg-card p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`h-9 w-9 rounded ${viewMode === 'grid' ? 'bg-accent text-cta' : 'text-text-muted hover:bg-body'}`}
                      aria-label="Grid view"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`h-9 w-9 rounded ${viewMode === 'list' ? 'bg-accent text-cta' : 'text-text-muted hover:bg-body'}`}
                      aria-label="List view"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile controls (Filters + Sort) */}
              <div className="flex items-center justify-between gap-3 lg:hidden">
                <button
                  type="button"
                  onClick={() => setFiltersOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-text shadow-sm hover:bg-body"
                  aria-haspopup="dialog"
                  aria-expanded={filtersOpen}
                  aria-controls="products-filter-drawer"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h18M6 12h12M10 20h4" />
                  </svg>
                  FILTERS
                </button>

                <div className="flex items-center gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy((e.target.value as 'newest') || 'newest')}
                    className="h-10 rounded-md border border-border bg-card px-3 text-sm font-medium text-text"
                    aria-label="Sort products"
                  >
                    <option value="newest">Newest First</option>
                  </select>
                  {searchParams.toString() && (
                    <Link href="/products" className="text-sm font-medium text-text underline hover:no-underline">
                      Clear
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="border border-border bg-card p-8 text-center">
                <p className="text-text-muted">
                  {searchParams.toString()
                    ? 'Try changing or clearing filters.'
                    : 'Products added in the admin will appear here.'}
                </p>
                <Link href="/products" className="mt-4 inline-block text-sm font-medium text-text underline hover:no-underline">
                  Clear filters
                </Link>
                <span className="mx-2 text-stone-400">|</span>
                <Link href="/" className="text-sm font-medium text-text underline hover:no-underline">
                  ← Back to home
                </Link>
              </div>
            ) : (
              <ul
                className={
                  viewMode === 'list'
                    ? 'flex flex-col gap-4'
                    : 'grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-3'
                }
              >
                {filteredProducts.map((product) => (
                  <li
                    key={product._id}
                    className={`group overflow-hidden rounded-none bg-white ${
                      viewMode === 'list' ? 'flex gap-4 p-4' : 'p-3 sm:p-4'
                    }`}
                  >
                    {(() => {
                      const outOfStock = (product.stock ?? 1) <= 0;
                      const href = productHref(product);
                      return (
                        <>
                          <div
                            className={
                              viewMode === 'list'
                                ? 'relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-stone-100'
                                : 'relative aspect-square w-full overflow-hidden bg-stone-100'
                            }
                          >
                            <Link href={href} className="block h-full w-full">
                              <img
                                src={productImageSrc(product.image)}
                                alt={product.name}
                                className={`h-full w-full object-cover ${outOfStock ? '' : 'transition-transform duration-300 group-hover:scale-105'}`}
                              />
                            </Link>

                            {(product.stock ?? 1) <= 0 && (
                              <div className="absolute left-2 top-2 rounded bg-black/80 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                                OUT OF STOCK
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
                              className={`absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full border bg-card/90 shadow-sm backdrop-blur transition-colors hover:bg-card ${
                                wishlistedIds.has(String(product._id))
                                  ? 'border-red-200 text-red-600'
                                  : 'border-border text-text-muted'
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

                          <div className={viewMode === 'list' ? 'flex min-w-0 flex-1 flex-col justify-between' : 'pt-3'}>
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                                {product.category}
                              </p>
                              <h2 className="mt-2 line-clamp-2 font-sans text-sm font-semibold text-text">
                                <Link href={href} className="hover:underline">
                                  {product.name}
                                </Link>
                              </h2>
                              <p className="mt-2 font-sans text-sm font-semibold text-text">
                                ₹{product.price}
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}

            {filteredProducts.length > 0 && (
              <p className="mt-8">
                <Link href="/" className="text-sm text-text underline hover:no-underline">
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
            <div className="absolute right-0 top-0 h-full w-[88vw] max-w-sm overflow-auto bg-card p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-sans text-sm font-semibold uppercase tracking-wide text-text">Filters</h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm font-medium text-cta hover:bg-accent-hover"
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
