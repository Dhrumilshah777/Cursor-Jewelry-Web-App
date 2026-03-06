'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiGet, assetUrl, addToCart } from '@/lib/api';
import FilterSidebar, { type Facets } from '@/components/FilterSidebar';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

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

function ProductsContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || '';

  const [data, setData] = useState<ProductsResponse>({ products: [], facets: defaultFacets });
  const [loading, setLoading] = useState(true);
  const [addedToCartId, setAddedToCartId] = useState<string | null>(null);

  const queryString = searchParams.toString();
  const apiUrl = queryString ? `/api/products?${queryString}` : '/api/products';

  useEffect(() => {
    setLoading(true);
    apiGet<ProductsResponse>(apiUrl)
      .then((res) => {
        const products = Array.isArray((res as { products?: Product[] }).products)
          ? (res as ProductsResponse).products
          : Array.isArray(res) ? (res as unknown as Product[]) : [];
        const facets = (res as ProductsResponse).facets || defaultFacets;
        setData({
          products: products.map((p) => ({
            _id: String((p as { _id?: string })._id ?? ''),
            name: p.name,
            category: p.category,
            price: p.price,
            image: p.image,
          })),
          facets,
        });
      })
      .catch(() => setData({ products: [], facets: defaultFacets }))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const { products: filteredProducts, facets } = data;
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
              ? 'No products match these filters.'
              : 'No products yet.'
            : `${filteredProducts.length} product${filteredProducts.length === 1 ? '' : 's'}.`}
        </p>

        <div className="mt-8 flex flex-col gap-8 lg:flex-row">
          <FilterSidebar
            facets={facets}
            totalCount={filteredProducts.length}
            className="lg:sticky lg:top-8 lg:self-start"
          />
          <div className="min-w-0 flex-1">
            {filteredProducts.length === 0 ? (
              <div className="rounded border border-stone-200 bg-stone-50 p-8 text-center">
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
                        <p className="mt-2 font-sans text-sm font-semibold text-charcoal">₹{product.price}</p>
                      </div>
                    </Link>
                    <div className="border-t border-stone-100 p-3">
                      <button
                        type="button"
                        onClick={() => {
                          addToCart({ id: product._id, name: product.name, price: product.price, image: product.image });
                          setAddedToCartId(product._id);
                          setTimeout(() => setAddedToCartId(null), 2500);
                        }}
                        className="w-full rounded border border-stone-300 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-stone-50"
                      >
                        {addedToCartId === product._id ? 'Added to cart' : 'Add to cart'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {addedToCartId && (
              <div
                className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-stone-200 bg-charcoal px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300"
                role="status"
                aria-live="polite"
              >
                Added to Cart
              </div>
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
