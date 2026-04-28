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
  braceletSize?: string;
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

const MOCK_PRODUCTS: Array<
  Pick<
    Product,
    | '_id'
    | 'slug'
    | 'name'
    | 'category'
    | 'price'
    | 'image'
    | 'subImages'
    | 'goldPurity'
    | 'goldType'
    | 'weight'
    | 'sku'
    | 'ringSize'
    | 'stock'
  >
> = [
  {
    _id: 'demo-1',
    slug: 'demo-solitaire-ring',
    name: 'Demo Solitaire Ring',
    category: 'Rings',
    price: '32450.00',
    image: 'https://live.jewelbox.co.in/wp-content/uploads/2026/03/1774873698_PER1831.jpg',
    subImages: [
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='800'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23ffffff'/%3E%3Ccircle%20cx='400'%20cy='320'%20r='110'%20fill='%23f3f4f6'/%3E%3Cpath%20d='M220%20480%20c110%2060%20250%2060%20360%200'%20fill='none'%20stroke='%23d6d3d1'%20stroke-width='40'%20stroke-linecap='round'/%3E%3C/svg%3E",
      "data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='800'%20height='800'%20viewBox='0%200%20800%20800'%3E%3Crect%20width='800'%20height='800'%20fill='%23ffffff'/%3E%3Cpath%20d='M400%20200%20c-80%2060-100%20120-100%20200%200%20120%20100%20220%20100%20220%20s100-100%20100-220%20c0-80-20-140-100-200z'%20fill='%23f3f4f6'/%3E%3C/svg%3E",
    ],
    goldPurity: '18K (750)',
    goldType: 'Yellow Gold',
    weight: '2.31 g (Approx.)',
    sku: 'RING-18K-002',
    ringSize: '15 (UK)',
    stock: 10,
  },
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
  const [quantity, setQuantity] = useState(1);
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
    setQuantity(Math.max(1, Number(product?.purchaseQuantity) || 1));
  }, [product?._id, product?.purchaseQuantity]);

  useEffect(() => {
    if (!routeSlug) {
      setLoading(false);
      setError('Invalid product');
      return;
    }

    // Mock products (frontend-only)
    const mock = MOCK_PRODUCTS.find((p) => p._id === routeSlug || p.slug === routeSlug);
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
          <p className="text-text-muted">Loading product…</p>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-2xl font-semibold text-text">
            {error === 'Product not found' ? 'Product not found' : 'Could not load product'}
          </h1>
          <p className="mt-2 text-text-muted">{error}</p>
          <Link href="/" className="mt-6 inline-block text-text underline hover:no-underline">
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  // Build gallery: main image + sub images; resolve URL for each
  const resolveSrc = (raw: string) => {
    if (!raw) return '';
    if (raw.startsWith('data:')) return raw;
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
  const isBracelet = /bracelet/i.test(product.category || '') || /bracelet/i.test(product.name || '');

  const goldPurityLabel =
    product.priceBreakup?.goldPurity ||
    product.goldPurity ||
    (typeof product.priceBreakup?.gstPercent === 'number' ? undefined : undefined);
  const goldTypeLabel = product.goldType || colorsList[0];
  const metaParts = [goldPurityLabel, goldTypeLabel, product.carat].filter((v) => typeof v === 'string' && v.trim());
  const metaLine = metaParts.join(' | ');

  const specRows: Array<{ label: string; value: string }> = [
    { label: 'Metal', value: goldTypeLabel ? String(goldTypeLabel) : '' },
    { label: 'Gold purity', value: goldPurityLabel ? String(goldPurityLabel) : '' },
    {
      label: 'Product weight',
      value: product.weight
        ? String(product.weight)
        : (product.priceBreakup?.netWeight != null ? `${Number(product.priceBreakup.netWeight)} g` : ''),
    },
    { label: 'SKU', value: product.sku ? String(product.sku) : '' },
  ].filter((r) => r.value && String(r.value).trim());

  const normalizedWeight = (() => {
    const w = specRows.find((r) => r.label === 'Product weight')?.value || '';
    if (!w) return '';
    const s = String(w).trim();
    if (/\(approx\.\)$/i.test(s)) return s;
    // If it looks like "2.31 g" or "2.31g", append Approx. like the reference.
    if (/\bg\b/i.test(s) && !/[a-zA-Z]{3,}/.test(s.replace(/\bg\b/i, ''))) return `${s} (Approx.)`;
    return s;
  })();

  type SpecTile = {
    key: string;
    label: string;
    value: string;
    icon: 'hex' | 'scale' | 'balance' | 'tag' | 'ruler' | 'medal';
  };
  const baseSpecTiles: SpecTile[] = [
    { key: 'metal', label: 'Metal', value: goldTypeLabel ? String(goldTypeLabel) : '', icon: 'hex' },
    { key: 'purity', label: 'Gold purity', value: goldPurityLabel ? String(goldPurityLabel) : '', icon: 'scale' },
    { key: 'weight', label: 'Product weight', value: normalizedWeight, icon: 'balance' },
    { key: 'sku', label: 'SKU', value: product.sku ? String(product.sku) : '', icon: 'tag' },
    ...(isRing
      ? ([
          {
            key: 'ringSize',
            label: 'Ring size',
            value: (() => {
              const fromInput = ringSizeInput.trim();
              if (fromInput) return fromInput;
              const fromProduct = product.ringSize ? String(product.ringSize).trim() : '';
              return fromProduct || '—';
            })(),
            icon: 'ruler',
          },
        ] as SpecTile[])
      : []),
    ...(isBracelet
      ? ([
          {
            key: 'braceletSize',
            label: 'Bracelet size',
            value: product.braceletSize ? String(product.braceletSize).trim() : '',
            icon: 'ruler',
          },
        ] as SpecTile[])
      : []),
    { key: 'bis', label: 'BIS hallmarked', value: 'Yes', icon: 'medal' },
  ];

  const specTiles = baseSpecTiles.filter((t): t is SpecTile =>
    Boolean(t.value && String(t.value).trim())
  );

  const iconSvg = (icon: SpecTile['icon']) => {
    const cls = 'h-6 w-6 shrink-0';
    switch (icon) {
      case 'hex':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2l8 4.5v11L12 22 4 17.5v-11L12 2z" />
          </svg>
        );
      case 'scale':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
            <circle cx="12" cy="12" r="5" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
          </svg>
        );
      case 'balance':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        );
      case 'tag':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h7l5 5-7 7-5-5V7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7l-2 2v5l5 5" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 10h.01" />
          </svg>
        );
      case 'ruler':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 17l10-10 8 8-10 10H3v-8z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 13l2 2M9 11l2 2M11 9l2 2" />
          </svg>
        );
      case 'medal':
        return (
          <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 12 2 2 4-4" />
          </svg>
        );
      default:
        return null;
    }
  };

  const handleBuyNow = () => {
    if (!product) return;
    if (outOfStock) return;
    addToCart({
      id: product._id,
      slug: product.slug,
      name: product.name,
      price: String(displayPrice),
      image: product.image,
      quantity: Math.max(1, quantity),
    });
    setAlreadyInCart(true);
    if (typeof window !== 'undefined') {
      const loggedIn = localStorage.getItem('user_logged_in') === '1';
      router.push(loggedIn ? '/checkout' : '/login?returnTo=/checkout');
    }
  };

  return (
    <main className="min-h-[50vh] bg-body px-4 py-6 pb-24 sm:py-8 md:px-6 lg:px-8 md:pb-12">
      <div className="mx-auto max-w-6xl">
        <nav className="mb-6 text-sm text-text-muted">
          <Link href="/" className="hover:text-text">HOME</Link>
          <span className="mx-2">&gt;</span>
          <span className="font-medium uppercase tracking-wide text-text">{product.name}</span>
        </nav>

        <div className="grid items-start gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-x-12">
          {/* Left: thumbnails + main image */}
          <div className="min-w-0">
            <div
              className={`grid gap-4 md:items-start ${allImages.length > 1 ? 'md:grid-cols-[88px_1fr]' : ''}`}
            >
              {allImages.length > 1 && (
                <div className="hidden md:flex md:flex-col md:gap-3 md:overflow-auto md:pr-1 md:max-h-[540px]">
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
                        className={`h-20 w-20 overflow-hidden rounded-md border-2 bg-card transition-colors ${
                          isSelected ? 'border-accent' : 'border-border hover:border-text-muted'
                        }`}
                        aria-label={`View image ${i + 1}`}
                      >
                        {src ? (
                          <img src={src} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-stone-200" />
                        )}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled
                    className="flex h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border bg-card text-[10px] font-semibold uppercase tracking-wide text-text-muted"
                    title="360° view coming soon"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12a8 8 0 018-8M20 12a8 8 0 01-16 0" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="leading-none">360°</span>
                  </button>
                </div>
              )}

              <div className="aspect-square w-full overflow-hidden rounded-xl">
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
            </div>

            {allImages.length > 1 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
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
                      className={`h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 bg-card transition-colors ${
                        isSelected ? 'border-accent' : 'border-border hover:border-text-muted'
                      }`}
                      aria-label={`View image ${i + 1}`}
                    >
                      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-stone-200" />}
                    </button>
                  );
                })}
              </div>
            )}

          </div>

          {/* Right: info panel */}
          <div className="min-w-0">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <h1 className="font-sans text-2xl font-semibold text-text sm:text-3xl">
                  {product.name}
                </h1>
                {metaLine ? <p className="mt-1 text-sm text-text-muted">{metaLine}</p> : null}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text hover:bg-body"
                  aria-label="Share"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l7.5-4.314m-7.5 4.314l7.5-4.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186m0 0L12.75 5.25" /></svg>
                </button>
                <button
                  type="button"
                  onClick={toggleWishlist}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                    wishlisted ? 'border-border bg-body text-text' : 'border-border text-text hover:bg-body'
                  }`}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <svg className="h-5 w-5" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div>
                <p className="font-sans text-3xl font-semibold text-text">₹ {displayPrice.toFixed(2)}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">(Inclusive of all taxes)</p>
              </div>
              {compareAtPrice != null && compareAtPrice > displayPrice && (
                <p className="mb-1 font-sans text-lg text-stone-400 line-through">₹ {Number(compareAtPrice).toFixed(2)}</p>
              )}
              <div className="ml-auto pb-1">
                {outOfStock ? (
                  <span className="inline-flex items-center rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-700">
                    Out of stock
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
                    In stock
                  </span>
                )}
              </div>
            </div>

            {/* Optional variations */}
            {colorsList.length > 1 && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Color: {colorsList[selectedColorIndex] ?? colorsList[0]}
                </p>
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
                        className={`h-10 w-10 flex-shrink-0 rounded border-2 transition-all ${
                          isSelected ? 'border-text ring-2 ring-text/15' : 'border-border hover:border-text-muted'
                        }`}
                        style={{ backgroundColor: bg }}
                        aria-label={`Color ${c}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Product details — borders use border-border (#E7E1D7); fill stays white */}
            {specTiles.length > 0 && (
              <div className="mt-6">
                <h3 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Product details
                </h3>
                <div className="overflow-hidden rounded-xl border border-border bg-card p-px shadow-sm">
                  <div className="grid grid-cols-3 gap-px bg-border">
                    {specTiles.slice(0, 6).map((t) => (
                      <div
                        key={t.key}
                        className="flex min-h-[92px] flex-col items-center justify-center gap-3 bg-card px-3 py-4 text-center sm:min-h-[100px] sm:px-4 sm:py-5"
                      >
                        <span className="text-accent [&_svg]:h-5 [&_svg]:w-5">{iconSvg(t.icon)}</span>
                        <div className="flex w-full max-w-[14rem] flex-col items-center">
                          <p className="w-full text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-text-muted sm:text-[11px]">
                            {t.label}
                          </p>
                          <p className="mt-3 w-full border-t border-border pt-3 text-xs font-medium leading-snug text-text sm:text-sm">
                            {t.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Quantity + CTAs (like reference) */}
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Quantity: <span className="font-semibold text-text">{Math.max(1, quantity)}</span>
              </p>
              <div className="mt-2 grid grid-cols-[140px_1fr] gap-3">
                <div className="flex items-center justify-between rounded border border-border bg-card px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-8 w-8 rounded text-lg text-text-muted hover:bg-body"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold text-text" aria-live="polite">
                    {Math.max(1, quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="h-8 w-8 rounded text-lg text-text-muted hover:bg-body"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (outOfStock) return;
                      addToCart({
                        id: product._id,
                        slug: product.slug,
                        name: product.name,
                        price: String(displayPrice),
                        image: product.image,
                        quantity: Math.max(1, quantity),
                      });
                      setAddedToCart(true);
                      setAlreadyInCart(true);
                      setTimeout(() => setAddedToCart(false), 2500);
                    }}
                    disabled={outOfStock}
                    className={`w-full rounded px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                      outOfStock
                        ? 'cursor-not-allowed bg-border text-text-muted'
                        : 'border-2 border-accent bg-card text-accent hover:bg-body hover:border-accent'
                    }`}
                  >
                    Add to cart
                  </button>
                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={outOfStock}
                    className={`w-full rounded px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                      outOfStock ? 'cursor-not-allowed bg-border text-text-muted' : 'bg-accent text-white hover:bg-accent-hover'
                    }`}
                  >
                    Buy now
                  </button>
                </div>
              </div>
              {alreadyInCart && !outOfStock && (
                <p className="mt-2 text-xs text-text-muted">This product is already in your cart; adding again will increase quantity.</p>
              )}
            </div>

            {/* Delivery check */}
            <div className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-body text-accent">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h12v10H3V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10h3l3 3v4h-6v-7z" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">Check delivery</p>
                  <p className="mt-1 text-xs text-text-muted">Enter pincode to check estimated delivery date</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Pincode"
                      className="min-w-[140px] flex-1 rounded border border-border bg-card px-3 py-2 text-sm text-text placeholder:text-text-muted"
                      onKeyDown={(e) => e.key === 'Enter' && checkDelivery()}
                    />
                    <button
                      type="button"
                      onClick={checkDelivery}
                      disabled={deliveryChecking}
                      className="rounded bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-60"
                    >
                      {deliveryChecking ? 'Checking…' : 'Check'}
                    </button>
                  </div>
                  {deliveryError && <p className="mt-2 text-xs text-red-600">{deliveryError}</p>}
                  {deliveryCheck && <p className="mt-2 text-sm font-medium text-text">{deliveryCheck.message}</p>}
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Full-width trust banner (reference) */}
        <div className="mt-8 grid grid-cols-2 divide-x divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
          {[
            { title: 'Free shipping', sub: 'Across India', icon: 'truck' as const },
            { title: 'BIS hallmarked', sub: 'Gold purity assured', icon: 'shield' as const },
            { title: 'Secure payment', sub: 'Trusted gateway', icon: 'lock' as const },
            { title: 'Lifetime warranty', sub: 'On core jewellery', icon: 'shield2' as const },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 px-4 py-4 sm:px-5">
              <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-body text-accent shadow-sm">
                {item.icon === 'truck' && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7h12v10H3V7z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10h3l3 3v4h-6v-7z" />
                  </svg>
                )}
                {item.icon === 'shield' && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l8 4.5v6c0 5-3.5 8.5-8 9.5-4.5-1-8-4.5-8-9.5v-6L12 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4" />
                  </svg>
                )}
                {item.icon === 'lock' && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V8a4 4 0 10-8 0v3" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 11h12v10H6V11z" />
                  </svg>
                )}
                {item.icon === 'shield2' && (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 21s-7-4.35-7-10a4 4 0 017-2.5A4 4 0 0119 11c0 5.65-7 10-7 10z" />
                  </svg>
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-text">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{item.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Full-width: Price breakup, recommendations */}
        {product.priceBreakup && (
          <div className="mt-8 border-t border-border pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-text">Price breakup</h3>
            <div className="mt-4 overflow-hidden rounded border border-border bg-card">
              <table className="w-full text-left text-sm text-text">
                <tbody>
                  {product.priceBreakup.netWeight != null && (
                    <tr className="border-b border-border">
                      <td className="px-4 py-3">Net weight</td>
                      <td className="px-4 py-3 font-medium">{Number(product.priceBreakup.netWeight)} g</td>
                    </tr>
                  )}
                  <tr className="border-b border-border">
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
                  <tr className="border-b border-border">
                    <td className="px-4 py-3">Making charge</td>
                    <td className="px-4 py-3 font-medium">
                      ₹{(
                        (typeof product.priceBreakup.makingChargePaise === 'number'
                          ? product.priceBreakup.makingChargePaise / 100
                          : Number(product.priceBreakup.makingCharge)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3">GST charge ({product.priceBreakup.gstPercent ?? 3}%)</td>
                    <td className="px-4 py-3 font-medium">
                      ₹{(
                        (typeof product.priceBreakup.gstPaise === 'number'
                          ? product.priceBreakup.gstPaise / 100
                          : Number(product.priceBreakup.gst)) || 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                  <tr className="bg-body font-semibold text-text">
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
          <div className="mt-8 border-t border-border pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-text">You may also like</h3>
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
                    className="flex w-44 shrink-0 flex-col overflow-hidden border border-border bg-card sm:w-52"
                  >
                    <div className="aspect-square w-full overflow-hidden bg-stone-100">
                      <img src={imgSrc} alt={p.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="font-sans text-sm font-semibold text-text">₹{priceStr}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{p.name}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {recentlyViewed.length > 0 && (
          <div className="mt-8 border-t border-border pt-8">
            <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-text">Recently viewed</h3>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
              {recentlyViewed.map((item) => {
                const imgSrc = item.image.startsWith('http') ? item.image : item.image.startsWith('/') ? (item.image.startsWith('/uploads/') ? assetUrl(item.image) : item.image) : assetUrl(`/${item.image}`);
                return (
                  <Link key={item.id} href={productHref(item)} className="flex w-28 shrink-0 flex-col overflow-hidden border border-border bg-card">
                    <div className="aspect-square w-full overflow-hidden bg-stone-100">
                      <img src={imgSrc} alt={item.name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-xs font-medium text-text">{item.name}</p>
                      <p className="text-xs text-text-muted">₹{item.price}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {/* Sticky bottom bar (mobile): price + BUY NOW */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card p-3 md:hidden">
          <div className="mx-auto max-w-5xl px-4">
            <div className="grid grid-cols-[1fr_1.2fr] items-center gap-3">
              <div className="min-w-0">
                <p className="font-sans text-base font-semibold text-text">₹ {displayPrice.toFixed(2)}</p>
                <p className="text-[11px] text-text-muted">(Inclusive of all taxes)</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (outOfStock) return;
                  addToCart({
                    id: product._id,
                    slug: product.slug,
                    name: product.name,
                    price: String(displayPrice),
                    image: product.image,
                    quantity: purchaseQty,
                  });
                  setAlreadyInCart(true);
                  if (typeof window !== 'undefined') {
                    const loggedIn = localStorage.getItem('user_logged_in') === '1';
                    router.push(loggedIn ? '/checkout' : '/login?returnTo=/checkout');
                  }
                }}
                disabled={outOfStock}
                className={`w-full rounded px-4 py-3 text-sm font-semibold uppercase tracking-wide transition-colors ${
                  outOfStock ? 'cursor-not-allowed bg-border text-text-muted' : 'bg-accent text-white hover:bg-accent-hover'
                }`}
              >
                Buy now
              </button>
            </div>
          </div>
        </div>

        {addedToCart && (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-border bg-accent px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300"
            role="status"
            aria-live="polite"
          >
            Added to Cart
          </div>
        )}
        {linkCopied && (
          <div
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-border bg-accent px-5 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300"
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
