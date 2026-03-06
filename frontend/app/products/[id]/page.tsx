'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiGet, assetUrl, getApiBase, addToWishlist, removeFromWishlist, isInWishlist, addToCart } from '@/lib/api';

type PriceBreakup = {
  goldValue: number;
  makingCharge: number;
  gst: number;
  totalPrice: number;
  goldPurity?: string;
  netWeight?: number;
  pricePerGram?: number;
};

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  subImages?: string[];
  weight?: string;
  carat?: string;
  colors?: string[];
  calculatedPrice?: number;
  priceBreakup?: PriceBreakup | null;
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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [pincode, setPincode] = useState('');
  const [deliveryCheck, setDeliveryCheck] = useState<{ message: string; estimatedDate?: string | null; serviceable?: boolean; fallback?: boolean } | null>(null);
  const [deliveryChecking, setDeliveryChecking] = useState(false);
  const [deliveryError, setDeliveryError] = useState('');

  useEffect(() => {
    setImageError(false);
    setSelectedImageIndex(0);
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

  const checkDelivery = async () => {
    const pin = pincode.trim().replace(/\D/g, '');
    if (pin.length < 6) {
      setDeliveryError('Enter a valid 6-digit pincode');
      setDeliveryCheck(null);
      return;
    }
    setDeliveryError('');
    setDeliveryCheck(null);
    setDeliveryChecking(true);
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/delivery-check?pincode=${encodeURIComponent(pin)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeliveryCheck({ message: data.message || data.error || 'Could not check delivery', serviceable: false });
        setDeliveryError(data.error || '');
        return;
      }
      setDeliveryError('');
      setDeliveryCheck({
        message: data.message || (data.estimatedDate ? `Delivery by ${formatDeliveryDate(data.estimatedDate)}` : 'Delivery available'),
        estimatedDate: data.estimatedDate ?? null,
        serviceable: data.serviceable,
        fallback: data.fallback === true,
      });
    } catch {
      setDeliveryCheck({ message: 'Estimated delivery: 4–7 business days.', serviceable: false, fallback: true });
      setDeliveryError('');
    } finally {
      setDeliveryChecking(false);
    }
  };

  function formatDeliveryDate(isoDate: string) {
    const d = new Date(isoDate + 'T12:00:00Z');
    const day = d.getUTCDate();
    const month = d.toLocaleDateString('en-IN', { month: 'long' });
    const year = d.getUTCFullYear();
    return `${day} ${month} ${year}`;
  }

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
        price: typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : product.price,
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

  // Build gallery: main image + sub images; resolve URL for each
  const resolveSrc = (raw: string) => {
    if (!raw) return '';
    const normalized = raw.startsWith('/') ? raw : `/${raw}`;
    return raw.startsWith('http') ? raw : normalized.startsWith('/uploads/') ? assetUrl(normalized) : normalized;
  };
  const allImages = [product.image, ...(product.subImages || [])].filter(Boolean);
  const selectedSrc = allImages[selectedImageIndex] ? resolveSrc(allImages[selectedImageIndex]) : '';

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
          <div>
            <div className="aspect-square w-full overflow-hidden rounded-lg bg-stone-100">
              {!imageError && selectedSrc ? (
                <img
                  key={selectedImageIndex}
                  src={selectedSrc}
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
            {allImages.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {allImages.map((raw, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => { setSelectedImageIndex(i); setImageError(false); }}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                      selectedImageIndex === i ? 'border-charcoal' : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <img src={resolveSrc(raw)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal sm:text-3xl">
              {product.name}
            </h1>
            <p className="mt-2 text-sm text-stone-500">{product.category}</p>
            <p className="mt-4 font-sans text-xl font-semibold text-charcoal">
              ₹{typeof product.calculatedPrice === 'number' ? product.calculatedPrice.toFixed(2) : product.price}
            </p>
            {product.priceBreakup && (
              <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Price breakup</h3>
                <ul className="mt-3 space-y-2 text-sm text-stone-700">
                  {product.priceBreakup.netWeight != null && (
                    <li className="flex justify-between">
                      <span>Net weight</span>
                      <span className="font-medium">{Number(product.priceBreakup.netWeight)} g</span>
                    </li>
                  )}
                  <li className="flex justify-between">
                    <span>Gold price{product.priceBreakup.goldPurity ? ` (${product.priceBreakup.goldPurity})` : ''}</span>
                    <span className="font-medium">₹{Number(product.priceBreakup.goldValue).toFixed(2)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Making charge</span>
                    <span className="font-medium">₹{Number(product.priceBreakup.makingCharge).toFixed(2)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>GST charge (3%)</span>
                    <span className="font-medium">₹{Number(product.priceBreakup.gst).toFixed(2)}</span>
                  </li>
                  <li className="flex justify-between border-t border-stone-200 pt-2 mt-2 font-semibold text-charcoal">
                    <span>Total</span>
                    <span>₹{Number(product.priceBreakup.totalPrice).toFixed(2)}</span>
                  </li>
                </ul>
              </div>
            )}

            <div className="mt-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Check delivery</h3>
              <p className="mt-1 text-xs text-stone-500">Enter your pincode to see estimated delivery date.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Pincode"
                  className="w-32 rounded border border-stone-300 px-3 py-2 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                />
                <button
                  type="button"
                  onClick={checkDelivery}
                  disabled={deliveryChecking}
                  className="rounded border border-stone-800 bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
                >
                  {deliveryChecking ? 'Checking…' : 'Check Delivery'}
                </button>
              </div>
              {deliveryError && <p className="mt-2 text-xs text-red-600">{deliveryError}</p>}
              {deliveryCheck && !deliveryError && (
                <p className={`mt-2 text-sm font-medium ${
                  deliveryCheck.fallback ? 'text-stone-700' : deliveryCheck.serviceable ? 'text-green-700' : 'text-amber-700'
                }`}>
                  {deliveryCheck.message}
                </p>
              )}
            </div>

            {(product.weight || product.priceBreakup?.netWeight != null || product.carat) && (
              <dl className="mt-4 space-y-1 text-sm text-stone-600">
                {product.weight && (
                  <div>
                    <dt className="font-medium">Gross weight:</dt>
                    <dd className="mt-0.5">{product.weight}</dd>
                  </div>
                )}
                {product.priceBreakup?.netWeight != null && (
                  <div>
                    <dt className="font-medium">Net weight:</dt>
                    <dd className="mt-0.5">{Number(product.priceBreakup.netWeight)} g</dd>
                  </div>
                )}
                {product.carat && (
                  <div>
                    <dt className="font-medium">Carat:</dt>
                    <dd className="mt-0.5">{product.carat}</dd>
                  </div>
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
                onClick={() => addToCart({ id: product._id, name: product.name, price: typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : product.price, image: product.image })}
                className="flex items-center gap-2 rounded border border-stone-800 bg-charcoal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                Add to cart
              </button>
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
