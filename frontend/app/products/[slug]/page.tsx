'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, assetUrl, getApiBase, addToWishlist, removeFromWishlist, isInWishlist, addToCart, getCart } from '@/lib/api';
import { productHref } from '@/lib/productLink';

type PriceBreakup = {
  // New paise-based breakup (backend source of truth)
  goldValuePaise?: number;
  makingChargePaise?: number;
  gstPaise?: number;
  totalPricePaise?: number;
  subtotalPaise?: number;
  pricePerGramPaise?: number;
  gstPercent?: number;
  makingChargeType?: string;
  makingChargeValue?: number;

  // Legacy fields (older backend responses)
  goldValue?: number;
  makingCharge?: number;
  gst?: number;
  totalPrice?: number;
  goldPurity?: string;
  netWeight?: number;
  pricePerGram?: number;
  fixedPricePaise?: number;
};

type Product = {
  _id: string;
  slug?: string;
  /** Present when URL used a retired slug; client should replace the route with this slug. */
  canonicalSlug?: string;
  name: string;
  category: string;
  price: string;
  image: string;
  subImages?: string[];
  weight?: string;
  carat?: string;
  colors?: string[];
  purchaseQuantity?: number;
  calculatedPrice?: number;
  priceBreakup?: PriceBreakup | null;
  description?: string;
  ringSize?: string;
  sku?: string;
  goldPurity?: string;
  goldType?: string;
  stock?: number;
};

const RECENTLY_VIEWED_KEY = 'recently_viewed_products';
const RECENTLY_VIEWED_MAX = 8;

type RecentlyViewedItem = { id: string; slug?: string; name: string; image: string; price: string };

function isMongoObjectIdString(s: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(String(s || '').trim());
}

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
  const router = useRouter();
  const routeSlug = typeof params?.slug === 'string' ? decodeURIComponent(params.slug) : '';
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
  const [lastCheckedPincode, setLastCheckedPincode] = useState('');
  const [addedToCart, setAddedToCart] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [youMayAlsoLike, setYouMayAlsoLike] = useState<Product[]>([]);
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);
  const [ringSizeInput, setRingSizeInput] = useState('');
  const [accordion, setAccordion] = useState({ ringDetails: true, delivery: false, care: false });
  const [alreadyInCart, setAlreadyInCart] = useState(false);

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
    addToRecentlyViewed({
      id: product._id,
      slug: product.slug,
      name: product.name,
      image: product.image,
      price: priceStr,
    });
    setRecentlyViewed(getRecentlyViewed().filter((item) => item.id !== product._id));
  }, [product?._id]);

  useEffect(() => {
    if (!product?._id) return;
    const checkCart = () => {
      const list = getCart();
      setAlreadyInCart(list.some((item) => item.id === product._id));
    };
    checkCart();
    if (typeof window !== 'undefined') {
      window.addEventListener('cart-updated', checkCart);
      return () => window.removeEventListener('cart-updated', checkCart);
    }
  }, [product?._id]);

  useEffect(() => {
    if (!product?._id) return;
    const syncWish = () => setWishlisted(isInWishlist(product._id));
    syncWish();
    if (typeof window !== 'undefined') {
      window.addEventListener('wishlist-updated', syncWish);
      window.addEventListener('auth-updated', syncWish);
      return () => {
        window.removeEventListener('wishlist-updated', syncWish);
        window.removeEventListener('auth-updated', syncWish);
      };
    }
  }, [product?._id]);

  useEffect(() => {
    setImageError(false);
    setSelectedImageIndex(0);
  }, [routeSlug]);

  const outOfStock = (product?.stock ?? 1) <= 0;

  useEffect(() => {
    if (product?.ringSize) setRingSizeInput(product.ringSize);
    else setRingSizeInput('');
  }, [product?.ringSize]);

  useEffect(() => {
    if (!routeSlug) {
      setLoading(false);
      setError('Invalid product');
      return;
    }

    // Mock products (frontend-only)
    const mock = MOCK_PRODUCTS.find((p) => p._id === routeSlug);
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
    fetch(`${base}/api/products/${encodeURIComponent(routeSlug)}`)
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
        const canon = typeof data.canonicalSlug === 'string' ? data.canonicalSlug.trim() : '';
        if (canon && canon !== routeSlug) {
          router.replace(`/products/${encodeURIComponent(canon)}`);
          return;
        }
        const slugFromApi = typeof data.slug === 'string' ? data.slug.trim() : '';
        if (slugFromApi && isMongoObjectIdString(routeSlug) && slugFromApi !== routeSlug) {
          router.replace(`/products/${encodeURIComponent(slugFromApi)}`);
          return;
        }
        const p = { ...data, _id: (data._id || data.id || '') as string };
        delete (p as { canonicalSlug?: string }).canonicalSlug;
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
  }, [routeSlug]);

  const checkDelivery = async () => {
    const pin = pincode.trim().replace(/\D/g, '');
    if (pin.length < 6) {
      setDeliveryError('Enter a valid 6-digit pincode');
      setDeliveryCheck(null);
      return;
    }
    if (pin === lastCheckedPincode && deliveryCheck) return;
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
      setLastCheckedPincode(pin);
      setDeliveryError('');
      setDeliveryCheck({
        message:
          data.message ||
          (data.estimatedDateMin && data.estimatedDateMax
            ? `Delivery Date ${formatDeliveryDate(data.estimatedDateMin)} - ${formatDeliveryDate(data.estimatedDateMax)}`
            : 'Delivery available'),
        estimatedDate: data.estimatedDateMin ?? data.estimatedDate ?? null,
        serviceable: data.serviceable,
        fallback: data.fallback === true,
      });
    } catch {
      setLastCheckedPincode(pin);
      setDeliveryCheck({ message: '📦 Delivery not available for this location', serviceable: false, fallback: true });
      setDeliveryError('');
    } finally {
      setDeliveryChecking(false);
    }
  };

  // Auto-trigger delivery check when pincode becomes 6 digits (debounced).
  useEffect(() => {
    const pin = pincode.trim().replace(/\D/g, '');
    if (pin.length !== 6) return;
    if (deliveryChecking) return;
    if (pin === lastCheckedPincode && deliveryCheck) return;
    const t = window.setTimeout(() => {
      checkDelivery();
    }, 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pincode]);

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
        slug: product.slug,
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

  const displayPrice = typeof product.calculatedPrice === 'number' ? product.calculatedPrice : parseFloat(product.price) || 0;
  const purchaseQty = Math.max(1, Number(product.purchaseQuantity) || 1);
  const compareAtPrice = (product as { compareAtPrice?: number }).compareAtPrice;
  const colorsList =
    product.colors && product.colors.length > 0
      ? product.colors
      : (product.goldType && String(product.goldType).trim() ? [String(product.goldType).trim()] : []);
  const isRing = /ring/i.test(product.category || '') || /ring/i.test(product.name || '');
  const toggleAccordion = (key: 'ringDetails' | 'delivery' | 'care') => {
    setAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <main className="min-h-[50vh] px-4 py-6 pb-24 sm:py-8 md:px-6 lg:px-8 md:pb-12">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-charcoal">HOME</Link>
          <span className="mx-2">&gt;</span>
          <span className="font-medium uppercase tracking-wide text-charcoal">{product.name}</span>
        </nav>

        {/* 3-row flow on mobile: gallery → buy column → product details. On lg: gallery+details in col 1, buy in col 2 (details directly under thumbs). */}
        <div className="grid items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-x-12 lg:gap-y-0">
          {/* Col 1 row 1: main image + thumbnails only */}
          <div className="min-w-0 lg:col-start-1 lg:row-start-1">
            <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-stone-100">
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
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {allImages.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {allImages.map((raw, i) => {
                  const src = raw ? resolveSrc(raw) : '';
                  const isSelected = selectedImageIndex === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setSelectedImageIndex(i);
                        setImageError(false);
                      }}
                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition-colors sm:h-24 sm:w-24 ${
                        isSelected ? 'border-charcoal' : 'border-stone-200 hover:border-stone-400'
                      }`}
                    >
                      {src ? (
                        <img src={src} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-400">
                          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Col 2 row 1: title, price, CTAs, accordions (lg aligns top with gallery) */}
          <div className="relative z-30 flex flex-col lg:col-start-2 lg:row-start-1 lg:pl-2">
            <div className="flex items-center gap-2">
              <div className="flex text-gold" aria-label="4.5 out of 5 stars">
                {[1, 2, 3, 4].map((i) => (
                  <svg key={i} className="h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                ))}
                <svg className="h-4 w-4 sm:h-5 sm:w-5 text-gold" fill="url(#half-star-product)" viewBox="0 0 20 20">
                  <defs><linearGradient id="half-star-product"><stop offset="50%" stopColor="currentColor" /><stop offset="50%" stopColor="#e5e7eb" /></linearGradient></defs>
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <span className="text-sm text-stone-600">95 REVIEWS</span>
              <button type="button" onClick={handleShare} className="ml-auto flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 text-stone-500 hover:bg-stone-50" aria-label="Share">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l7.5-4.314m-7.5 4.314l7.5-4.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186m0 0L12.75 5.25" /></svg>
              </button>
              <button
                type="button"
                onClick={toggleWishlist}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${wishlisted ? 'border-red-200 bg-red-50 text-red-600' : 'border-stone-300 text-stone-500 hover:bg-stone-50'}`}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
              >
                <svg className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
              </button>
            </div>

            <h1 className="mt-4 font-sans text-2xl font-bold text-charcoal sm:text-3xl">
              {product.name}
            </h1>
            {outOfStock && (
              <div className="mt-2 inline-flex w-fit items-center rounded bg-black px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Out of stock
              </div>
            )}
            <p className="mt-1 text-stone-600">
              {product.description?.split('\n')[0] || `This ${product.name} shines with elegant craftsmanship.`}
            </p>

            <div className="mt-4 flex flex-wrap items-baseline gap-2">
              <span className="font-sans text-2xl font-bold text-charcoal">₹ {displayPrice.toFixed(2)}</span>
              {compareAtPrice != null && compareAtPrice > displayPrice && (
                <span className="text-lg text-stone-400 line-through">₹ {Number(compareAtPrice).toFixed(2)}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-stone-500">(MRP inclusive of all taxes)</p>

            {colorsList.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-700">
                  Color: {colorsList[selectedColorIndex] ?? colorsList[0]}
                </p>
                {colorsList.length > 1 && (
                  <div className="mt-2 flex gap-2">
                    {colorsList.map((c, i) => {
                      const isSelected = selectedColorIndex === i;
                      const colorMap: Record<string, string> = {
                        'yellow gold': '#D4AF37',
                        'rose gold': '#B76E79',
                        'silver': '#C0C0C0',
                        'gold': '#D4AF37',
                        'platinum': '#E5E4E2',
                        'white gold': '#E5E7EB',
                      };
                      const bg = colorMap[c.toLowerCase()] || '#D4AF37';
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setSelectedColorIndex(i)}
                          className={`h-10 w-10 flex-shrink-0 rounded border-2 transition-all ${isSelected ? 'border-charcoal ring-2 ring-charcoal/20' : 'border-stone-200 hover:border-stone-400'}`}
                          style={{ backgroundColor: bg }}
                          aria-label={`Color ${c}`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {isRing && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-700">Ring Size</p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="text"
                    value={ringSizeInput}
                    onChange={(e) => setRingSizeInput(e.target.value)}
                    placeholder="e.g. 3.35"
                    className="w-24 border border-stone-300 px-3 py-2 text-sm"
                  />
                  <Link href="/ring-size-guide" className="text-sm text-charcoal underline hover:no-underline">Ring size guide</Link>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-700">
                Quantity: {purchaseQty}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (outOfStock) return;
                  if (alreadyInCart) return;
                  addToCart({
                    id: product._id,
                    slug: product.slug,
                    name: product.name,
                    price: String(displayPrice),
                    image: product.image,
                    quantity: purchaseQty,
                  });
                  setAddedToCart(true);
                  setAlreadyInCart(true);
                  setTimeout(() => setAddedToCart(false), 2500);
                }}
                disabled={alreadyInCart || outOfStock}
                className={`w-full py-3 font-sans text-sm font-semibold uppercase tracking-wide transition-colors ${
                  alreadyInCart || outOfStock
                    ? 'cursor-not-allowed bg-stone-300 text-stone-600'
                    : 'bg-[#1e3a5f] text-white hover:bg-[#152a45]'
                }`}
              >
                {outOfStock ? 'Out of stock' : alreadyInCart ? 'Already in cart' : 'Add to cart'}
              </button>
              {outOfStock && (
                <p className="text-xs text-stone-600">
                  This item is currently out of stock. You can still view details, but purchasing is disabled.
                </p>
              )}
              <Link
                href="/products"
                className="flex w-full items-center justify-center border border-black bg-black py-3 font-sans text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-stone-900"
              >
                Shop now
              </Link>
            </div>

            {/* Pincode check — below Add to cart */}
            <div className="mt-6 border border-stone-200 bg-stone-50 p-4">
              <p className="text-xs font-medium text-stone-600">Check delivery</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Pincode"
                  className="w-40 border border-stone-300 px-3 py-2 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                />
                <button
                  type="button"
                  onClick={checkDelivery}
                  disabled={deliveryChecking}
                  className="rounded bg-charcoal px-5 py-2 text-sm text-white disabled:opacity-60"
                >
                  {deliveryChecking ? 'Checking…' : 'Check'}
                </button>
              </div>
              {deliveryError && <p className="mt-2 text-xs text-red-600">{deliveryError}</p>}
              {deliveryCheck && <p className="mt-2 text-sm font-medium text-stone-700">{deliveryCheck.message}</p>}
            </div>

            {/* Collapsible: Ring Details, Delivery & Returns, Care */}
            <div className="mt-8 border-t border-stone-200 pt-6">
              <button type="button" className="flex w-full items-center justify-between py-2 text-left" onClick={() => toggleAccordion('ringDetails')}>
                <span className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Ring Details</span>
                <svg className={`h-5 w-5 text-stone-500 transition-transform ${accordion.ringDetails ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {accordion.ringDetails && (
                <div className="mt-2 space-y-1 border-b border-stone-100 pb-4 text-sm text-stone-700">
                  <p><span className="font-medium text-stone-600">SKU:</span> {product.sku || product._id || '—'}</p>
                  <p><span className="font-medium text-stone-600">Width:</span> {product.weight || '—'}</p>
                  <p><span className="font-medium text-stone-600">Diamond shape:</span> {product.carat || '—'}</p>
                  <p>
                    <span className="font-medium text-stone-600">Material:</span>{' '}
                    {[product.priceBreakup?.goldPurity || product.goldPurity, product.goldType].filter(Boolean).join(' · ') ||
                      product.category ||
                      '—'}
                  </p>
                  <p><span className="font-medium text-stone-600">Style:</span> {product.category || '—'}</p>
                  <p><span className="font-medium text-stone-600">Profile:</span> Medium</p>
                </div>
              )}

              <button type="button" className="flex w-full items-center justify-between py-2 text-left" onClick={() => toggleAccordion('delivery')}>
                <span className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Delivery & Returns</span>
                <svg className={`h-5 w-5 text-stone-500 transition-transform ${accordion.delivery ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {accordion.delivery && (
                <div className="mt-2 space-y-2 border-b border-stone-100 pb-4 text-sm text-stone-600">
                  <p>Free delivery on orders above ₹ 83,000. Standard delivery in 4–7 business days. Easy returns within 30 days.</p>
                </div>
              )}

              <button type="button" className="flex w-full items-center justify-between py-2 text-left" onClick={() => toggleAccordion('care')}>
                <span className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">Care Information</span>
                <svg className={`h-5 w-5 text-stone-500 transition-transform ${accordion.care ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {accordion.care && (
                <div className="mt-2 border-b border-stone-100 pb-4 text-sm text-stone-600">
                  Store in a dry place. Avoid contact with perfumes and chemicals. Clean with a soft cloth. Professional cleaning recommended annually.
                </div>
              )}
            </div>

            {/* Value propositions — one per line */}
            <div className="mt-4 flex flex-col gap-4 border-t border-stone-200 pt-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-charcoal">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase text-charcoal">Flexible payment</p>
                  <p className="text-xs text-stone-600">Pay with multiple payment options</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-charcoal">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase text-charcoal">Free shipping</p>
                  <p className="text-xs text-stone-600">On orders above Rs. 83,000.00</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-charcoal">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase text-charcoal">Online support</p>
                  <p className="text-xs text-stone-600">24 hours a day, 7 days a week</p>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 text-charcoal">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase text-charcoal">Lifetime warranty</p>
                  <p className="text-xs text-stone-600">A lifetime warranty for core</p>
                </div>
              </div>
            </div>
          </div>

          {/* Col 1 row 2: product copy directly under gallery (no dead space beside tall right column) */}
          <div className="min-w-0 border-t border-stone-200 pt-6 lg:col-start-1 lg:row-start-2 lg:pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-charcoal">Product Details</h3>
            <p className="mt-4 text-sm text-stone-700">
              <span className="font-bold italic text-charcoal">{product.name}</span>
              {product.description?.trim()
                ? ` ${product.description.split('\n')[0].trim()}`
                : ' showcases elegant craftsmanship and refined design.'}
            </p>
            <hr className="my-6 border-stone-200" />
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-charcoal">Weight</p>
                <ul className="mt-2 space-y-1 text-sm text-stone-700">
                  {product.weight && <li>Gross (Product) – {product.weight}</li>}
                  {product.priceBreakup?.netWeight != null && (
                    <li>Net (Gold) – {Number(product.priceBreakup.netWeight)} gm</li>
                  )}
                  {!product.weight && product.priceBreakup?.netWeight == null && <li>—</li>}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold text-charcoal">Purity</p>
                <p className="mt-2 text-sm text-stone-700">
                  {product.priceBreakup?.goldPurity || product.goldPurity || '—'}
                  {product.colors?.[0] ? ` (${product.colors[0]})` : ''}
                </p>
              </div>
            </div>
            {product.description && product.description.split('\n').length > 1 && (
              <p className="mt-6 text-sm text-stone-700 whitespace-pre-wrap">{product.description}</p>
            )}
          </div>
        </div>

        {/* Full-width: Price breakup, recommendations */}
        {product.priceBreakup && (
          <div className="mt-8 border-t border-stone-200 pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-charcoal">Price breakup</h3>
            <div className="mt-4 overflow-hidden rounded border border-stone-200">
              <table className="w-full text-left text-sm text-stone-700">
                <tbody>
                  {product.priceBreakup.netWeight != null && (
                    <tr className="border-b border-stone-200">
                      <td className="px-4 py-3">Net weight</td>
                      <td className="px-4 py-3 font-medium">{Number(product.priceBreakup.netWeight)} g</td>
                    </tr>
                  )}
                  <tr className="border-b border-stone-200">
                    <td className="px-4 py-3">
                      Gold value{product.priceBreakup.goldPurity ? ` (${product.priceBreakup.goldPurity})` : ''}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ₹{(
                        (typeof product.priceBreakup.goldValuePaise === 'number'
                          ? product.priceBreakup.goldValuePaise / 100
                          : Number(product.priceBreakup.goldValue)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-stone-200">
                    <td className="px-4 py-3">Making charge</td>
                    <td className="px-4 py-3 font-medium">
                      ₹{(
                        (typeof product.priceBreakup.makingChargePaise === 'number'
                          ? product.priceBreakup.makingChargePaise / 100
                          : Number(product.priceBreakup.makingCharge)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-stone-200">
                    <td className="px-4 py-3">GST charge ({product.priceBreakup.gstPercent ?? 3}%)</td>
                    <td className="px-4 py-3 font-medium">
                      ₹{(
                        (typeof product.priceBreakup.gstPaise === 'number'
                          ? product.priceBreakup.gstPaise / 100
                          : Number(product.priceBreakup.gst)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-stone-50 font-semibold text-charcoal">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3">
                      ₹{(
                        (typeof product.priceBreakup.totalPricePaise === 'number'
                          ? product.priceBreakup.totalPricePaise / 100
                          : Number(product.priceBreakup.totalPrice)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {youMayAlsoLike.length > 0 && (
          <div className="mt-8 border-t border-stone-200 pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-charcoal">You may also like</h3>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
              {youMayAlsoLike.map((p) => {
                const imgSrc = p.image.startsWith('http')
                  ? p.image
                  : p.image.startsWith('/')
                    ? p.image.startsWith('/uploads/')
                      ? assetUrl(p.image)
                      : p.image
                    : assetUrl(p.image.startsWith('/') ? p.image : `/${p.image}`);
                const priceStr = typeof p.calculatedPrice === 'number' ? p.calculatedPrice.toFixed(2) : p.price;
                return (
                  <Link
                    key={p._id}
                    href={productHref(p)}
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
          <div className="mt-8 border-t border-stone-200 pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-charcoal">Recently viewed</h3>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {recentlyViewed.map((item) => {
                const imgSrc = item.image.startsWith('http') ? item.image : item.image.startsWith('/') ? (item.image.startsWith('/uploads/') ? assetUrl(item.image) : item.image) : assetUrl(`/${item.image}`);
                return (
                  <Link key={item.id} href={productHref(item)} className="flex w-28 shrink-0 flex-col overflow-hidden border border-stone-200 bg-white">
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
        {/* Sticky Add to cart bar — 768px and below only */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white p-3 md:hidden">
          <div className="mx-auto max-w-5xl px-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-700">
              Quantity: {purchaseQty}
            </p>
            <button
              type="button"
              onClick={() => {
                if (outOfStock) return;
                if (alreadyInCart) return;
                addToCart({
                  id: product._id,
                  slug: product.slug,
                  name: product.name,
                  price: String(displayPrice),
                  image: product.image,
                  quantity: purchaseQty,
                });
                setAddedToCart(true);
                setAlreadyInCart(true);
                setTimeout(() => setAddedToCart(false), 2500);
              }}
              disabled={alreadyInCart || outOfStock}
              className={`flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                alreadyInCart || outOfStock
                  ? 'cursor-not-allowed bg-stone-300 text-stone-600'
                  : 'bg-[#1e3a5f] text-white hover:bg-[#152a45]'
              }`}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
              </svg>
              {outOfStock ? 'Out of stock' : alreadyInCart ? 'Already in cart' : addedToCart ? 'Added to cart' : 'Add to cart'}
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
