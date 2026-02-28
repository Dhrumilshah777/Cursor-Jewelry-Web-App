'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiGet, assetUrl, getApiBase, addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  weight?: string;
  carat?: string;
  colors?: string[];
};

const MOCK_PRODUCTS: Array<Pick<Product, '_id' | 'name' | 'category' | 'price' | 'image'>> = [
  { _id: 'mock-1', name: 'Circle Necklace', category: 'Accessories', price: '52.00', image: '/instagram-1.jpg' },
  { _id: 'mock-2', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { _id: 'mock-3', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { _id: 'mock-4', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
  { _id: 'mock-5', name: 'Small Earrings', category: 'Accessories', price: '50.00', image: '/instagram-2.jpg' },
];

export default function ProductDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wishlisted, setWishlisted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError('Invalid product');
      return;
    }

    // Mock products (frontend-only)
    const mock = MOCK_PRODUCTS.find((p) => p._id === id);
    if (mock) {
      setProduct(mock as Product);
      setWishlisted(typeof window !== 'undefined' && isInWishlist(mock._id));
      setError('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const base = getApiBase();
    fetch(`${base}/api/products/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Product not found');
          throw new Error(res.statusText || 'Request failed');
        }
        return res.json();
      })
      .then((data: Product & { id?: string }) => {
        if (!data || (data && !data._id && !data.id)) {
          setError('Product not found');
          setProduct(null);
          return;
        }
        const p = { ...data, _id: (data._id || data.id || '') as string };
        setProduct(p);
        setWishlisted(typeof window !== 'undefined' && isInWishlist(p._id));
        setError('');
      })
      .catch((err: Error) => {
        const isNetwork = !err.message || err.message === 'Failed to fetch' || err.message.includes('Network');
        if (isNetwork) {
          setError('Could not load product. Check that NEXT_PUBLIC_API_URL points to your backend (e.g. Render URL) and try again.');
        } else {
          setError(err.message || 'Product not found');
        }
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const toggleWishlist = () => {
    if (!product) return;
    if (wishlisted) {
      removeFromWishlist(product._id);
      setWishlisted(false);
    } else {
      addToWishlist({
        id: product._id,
        name: product.name,
        category: product.category,
        price: product.price,
        image: product.image,
      });
      setWishlisted(true);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading product…</p>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-2xl font-semibold text-charcoal">
            {error === 'Product not found' ? 'Product not found' : 'Could not load product'}
          </h1>
          <p className="mt-2 text-stone-600">{error}</p>
          <Link href="/" className="mt-6 inline-block text-charcoal underline hover:no-underline">
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Image: full URL as-is; otherwise ensure /uploads/ path and use backend base URL
  const rawImage = product.image || '';
  const normalized = rawImage.startsWith('/') ? rawImage : `/${rawImage}`;
  const imageSrc = rawImage.startsWith('http')
    ? rawImage
    : normalized.startsWith('/uploads/')
      ? assetUrl(normalized)
      : normalized; // frontend public images like /instagram-1.jpg

  return (
    <main className="min-h-[50vh] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-charcoal">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-charcoal">Products</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{product.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
            {!imageError && imageSrc ? (
              <img
                src={imageSrc}
                alt={product.name}
                className="h-full w-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-400">
                <svg className="h-24 w-24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          <div>
            <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-stone-500">{product.category}</p>
            <p className="mt-4 font-sans text-xl font-semibold text-charcoal">{product.price}$</p>

            {(product.weight || product.carat) && (
              <dl className="mt-4 space-y-1 text-sm text-stone-600">
                {product.weight && (
                  <>
                    <dt className="inline font-medium">Weight: </dt>
                    <dd className="inline">{product.weight}</dd>
                  </>
                )}
                {product.carat && (
                  <>
                    <dt className="inline font-medium ml-2">Carat: </dt>
                    <dd className="inline">{product.carat}</dd>
                  </>
                )}
              </dl>
            )}
            {product.colors && product.colors.length > 0 && (
              <p className="mt-2 text-sm text-stone-600">
                <span className="font-medium">Colors: </span>
                {product.colors.join(', ')}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={toggleWishlist}
                className="flex items-center gap-2 rounded border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-stone-50"
              >
                <svg
                  className="h-5 w-5"
                  fill={wishlisted ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
                {wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              </button>
              <Link
                href="/"
                className="flex items-center rounded border border-stone-300 bg-stone-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-900"
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
