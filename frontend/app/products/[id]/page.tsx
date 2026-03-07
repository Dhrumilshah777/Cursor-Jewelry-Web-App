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
  description?: string;
  ringSize?: string;
  sku?: string;
  goldPurity?: string;
};

const RECENTLY_VIEWED_KEY = 'recently_viewed_products';
const RECENTLY_VIEWED_MAX = 8;

type RecentlyViewedItem = { id: string; name: string; image: string; price: string };

function getRecentlyViewed(): RecentlyViewedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, RECENTLY_VIEWED_MAX) : [];
  } catch {
    return [];
  }
}

function addToRecentlyViewed(item: RecentlyViewedItem) {
  if (typeof window === 'undefined') return;
  const list = getRecentlyViewed().filter((p) => p.id !== item.id);
  list.unshift(item);
  localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(list.slice(0, RECENTLY_VIEWED_MAX)));
}

function categoryToSlug(cat: string): string {
  return String(cat || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || '';
}

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
  const [addedToCart, setAddedToCart] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [youMayAlsoLike, setYouMayAlsoLike] = useState<Product[]>([]);

  useEffect(() => {
    if (!product?.category) return;
    const slug = categoryToSlug(product.category);
    if (!slug) return;
    const base = getApiBase();
    fetch(`${base}/api/products?category=${encodeURIComponent(slug)}`)
      .then((res) => res.json())
      .then((data: { products?: Product[] } | Product[]) => {
        const list = Array.isArray((data as { products?: Product[] }).products)
          ? (data as { products: Product[] }).products
          : Array.isArray(data)
            ? (data as Product[])
            : [];
        const other = list.filter((p) => String(p._id) !== String(product._id)).slice(0, 6);
        setYouMayAlsoLike(other);
      })
      .catch(() => setYouMayAlsoLike([]));
  }, [product?._id, product?.category]);

  useEffect(() => {
    if (!product || typeof window === 'undefined') return;
    const priceStr = typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : (product.price || '');
    addToRecentlyViewed({ id: product._id, name: product.name, image: product.image, price: priceStr });
    setRecentlyViewed(getRecentlyViewed().filter((item) => item.id !== product._id));
  }, [product?._id]);

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

  const handleShare = () => {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    const title = product.name;
    const text = `Check out ${product.name}`;
    const copyFallback = () => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    };
    if (navigator.share) {
      navigator
        .share({ title, text, url })
        .then(() => { /* shared */ })
        .catch((err) => {
          if (err?.name !== 'AbortError') copyFallback();
        });
    } else {
      copyFallback();
    }
  };

  return (
    <main className="min-h-[50vh] px-4 pr-6 py-8 pb-24 sm:py-12 md:px-4 md:pb-8">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-charcoal">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/products" className="hover:text-charcoal">Products</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{product.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <div className="min-w-0 md:overflow-hidden">
            <div className="aspect-square w-full overflow-hidden bg-stone-100">
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
                    className={`h-14 w-14 shrink-0 overflow-hidden border-2 transition-colors ${
                      selectedImageIndex === i ? 'border-charcoal' : 'border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <img src={resolveSrc(raw)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Mobile: details below image (before You may also like) */}
            <div className="mt-4 block md:hidden">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                SKU: <span className="font-mono normal-case text-charcoal">{product.sku || product._id || '—'}</span>
              </p>
              <div className="mt-4 flex items-center gap-2">
                <h1 className="min-w-0 flex-1 font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
                  {product.name}
                </h1>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-10 w-10 shrink-0 items-center justify-center border border-stone-300 bg-white text-charcoal transition-colors hover:bg-stone-50"
                  aria-label="Share product"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l7.5-4.314m-7.5 4.314l7.5-4.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186m0 0L12.75 5.25m0 0l-2.25 2.25" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center border transition-colors ${
                    wishlisted ? 'border-red-200 bg-red-50 text-red-600' : 'border-stone-300 bg-white text-charcoal hover:bg-stone-50'
                  }`}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <svg className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
              </div>
              <p className="mt-4 font-sans text-xl font-semibold text-charcoal">
                ₹{typeof product.calculatedPrice === 'number' ? product.calculatedPrice.toFixed(2) : product.price}
              </p>
              {product.colors && product.colors.length > 0 && (
                <p className="mt-3 text-sm text-stone-600">
                  <span className="font-medium">Color: </span>
                  {product.colors.join(', ')}
                </p>
              )}
              <p className="mt-1 text-sm text-stone-600">
                <span className="font-medium">Metal Purity: </span>
                {product.priceBreakup?.goldPurity || product.goldPurity || product.carat || '—'}
              </p>
              {product.ringSize && (
                <p className="mt-1 text-sm text-stone-600">
                  <span className="font-medium">Ring Size: </span>
                  {product.ringSize}
                </p>
              )}
              <div className="mt-6 hidden flex-wrap items-center gap-3 md:flex">
                <button
                  type="button"
                  onClick={() => {
                    addToCart({ id: product._id, name: product.name, price: typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : product.price, image: product.image });
                    setAddedToCart(true);
                    setTimeout(() => setAddedToCart(false), 2500);
                  }}
                  className="flex items-center gap-2 border border-stone-800 bg-charcoal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  {addedToCart ? 'Added to cart' : 'Add to cart'}
                </button>
              </div>
              <div className="mt-6 border border-stone-200 bg-stone-50 p-4">
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
                    className="w-32 border border-stone-300 px-3 py-2 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                  />
                  <button
                    type="button"
                    onClick={checkDelivery}
                    disabled={deliveryChecking}
                    className="border border-stone-800 bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
                  >
                    {deliveryChecking ? 'Checking…' : 'Check Delivery'}
                  </button>
                </div>
                {deliveryError && <p className="mt-2 text-xs text-red-600">{deliveryError}</p>}
                {deliveryCheck && !deliveryError && (
                  <p className={`mt-2 text-sm font-medium ${deliveryCheck.fallback ? 'text-stone-700' : deliveryCheck.serviceable ? 'text-green-700' : 'text-amber-700'}`}>
                    {deliveryCheck.message}
                  </p>
                )}
              </div>
            </div>

            {youMayAlsoLike.length > 0 && (
              <div className="mt-4 border border-stone-200 bg-stone-50 p-4">
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">You may also like</h3>
                <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
                  {youMayAlsoLike.map((p) => {
                    const imgSrc = p.image.startsWith('http') ? p.image : p.image.startsWith('/') ? (p.image.startsWith('/uploads/') ? assetUrl(p.image) : p.image) : assetUrl(p.image.startsWith('/') ? p.image : `/${p.image}`);
                    const priceStr = typeof p.calculatedPrice === 'number' ? p.calculatedPrice.toFixed(2) : p.price;
                    return (
                      <Link
                        key={p._id}
                        href={`/products/${p._id}`}
                        className="flex w-44 shrink-0 flex-col overflow-hidden border border-stone-200 bg-white sm:w-52"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-stone-100">
                          <img src={imgSrc} alt={p.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="p-3">
                          <p className="font-sans text-sm font-semibold text-charcoal">₹{priceStr}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-stone-600">{p.name}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {recentlyViewed.length > 0 && (
              <div className="mt-4 border border-stone-200 bg-stone-50 p-4">
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Recently viewed</h3>
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                  {recentlyViewed.map((item) => {
                    const imgSrc = item.image.startsWith('http') ? item.image : item.image.startsWith('/') ? (item.image.startsWith('/uploads/') ? assetUrl(item.image) : item.image) : assetUrl(`/${item.image}`);
                    return (
                      <Link
                        key={item.id}
                        href={`/products/${item.id}`}
                        className="flex w-28 shrink-0 flex-col overflow-hidden border border-stone-200 bg-white"
                      >
                        <div className="aspect-square w-full overflow-hidden bg-stone-100">
                          <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs font-medium text-charcoal">{item.name}</p>
                          <p className="text-xs text-stone-600">₹{item.price}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {product.priceBreakup && (
              <div className="mt-4 border border-stone-200 bg-stone-50 p-4">
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
            {product.description && (
              <div className="mt-4 border border-stone-200 bg-stone-50 p-4">
                <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Product details</h3>
                <p className="mt-2 text-sm text-stone-700 whitespace-pre-wrap">{product.description}</p>
              </div>
            )}
          </div>

          <div className="relative z-30 isolate hidden md:block">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              SKU: <span className="font-mono normal-case text-charcoal">{product.sku || product._id || '—'}</span>
            </p>

            <div className="relative z-20 mt-4 flex items-center gap-2">
              <h1 className="min-w-0 flex-1 font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal sm:text-3xl">
                {product.name}
              </h1>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleShare(); }}
                className="relative z-20 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border border-stone-300 bg-white text-charcoal transition-colors hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-charcoal/20"
                aria-label="Share product"
              >
                <svg className="h-5 w-5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l7.5-4.314m-7.5 4.314l7.5-4.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186m0 0L12.75 5.25m0 0l-2.25 2.25" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(); }}
                className={`relative z-20 flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border transition-colors focus:outline-none focus:ring-2 focus:ring-charcoal/20 ${
                  wishlisted ? 'border-red-200 bg-red-50 text-red-600' : 'border-stone-300 bg-white text-charcoal hover:bg-stone-50'
                }`}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <svg
                  className="h-5 w-5 pointer-events-none"
                  fill={wishlisted ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </button>
            </div>

            <p className="mt-4 font-sans text-xl font-semibold text-charcoal">
              ₹{typeof product.calculatedPrice === 'number' ? product.calculatedPrice.toFixed(2) : product.price}
            </p>

            {product.colors && product.colors.length > 0 && (
              <p className="mt-3 text-sm text-stone-600">
                <span className="font-medium">Color: </span>
                {product.colors.join(', ')}
              </p>
            )}

            <p className="mt-1 text-sm text-stone-600">
              <span className="font-medium">Metal Purity: </span>
              {product.priceBreakup?.goldPurity || product.goldPurity || product.carat || '—'}
            </p>

            {product.ringSize && (
              <p className="mt-1 text-sm text-stone-600">
                <span className="font-medium">Ring Size: </span>
                {product.ringSize}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  addToCart({ id: product._id, name: product.name, price: typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : product.price, image: product.image });
                  setAddedToCart(true);
                  setTimeout(() => setAddedToCart(false), 2500);
                }}
                className="flex items-center gap-2 border border-stone-800 bg-charcoal px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                {addedToCart ? 'Added to cart' : 'Add to cart'}
              </button>
            </div>

            <div className="mt-6 border border-stone-200 bg-stone-50 p-4">
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
                  className="w-32 border border-stone-300 px-3 py-2 text-base [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                />
                <button
                  type="button"
                  onClick={checkDelivery}
                  disabled={deliveryChecking}
                  className="border border-stone-800 bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
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

          </div>
        </div>

        {/* Sticky Add to cart bar — 768px and below only */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white p-3 md:hidden">
          <div className="mx-auto max-w-5xl px-4">
            <button
              type="button"
              onClick={() => {
                addToCart({ id: product._id, name: product.name, price: typeof product.calculatedPrice === 'number' ? String(product.calculatedPrice) : product.price, image: product.image });
                setAddedToCart(true);
                setTimeout(() => setAddedToCart(false), 2500);
              }}
              className="flex w-full items-center justify-center gap-2 border border-stone-800 bg-charcoal px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {addedToCart ? 'Added to cart' : 'Add to cart'}
            </button>
          </div>
        </div>

        {addedToCart && (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-stone-200 bg-charcoal px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300"
            role="status"
            aria-live="polite"
          >
            Added to Cart
          </div>
        )}
        {linkCopied && (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-stone-200 bg-charcoal px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300"
            role="status"
            aria-live="polite"
          >
            Link copied
          </div>
        )}
      </div>
    </main>
  );
}
