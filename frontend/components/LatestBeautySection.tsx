'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { apiGet, assetUrl, getWishlist, addToWishlist, removeFromWishlist, isInWishlist } from '@/lib/api';

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

const AUTOPLAY_MS = 5000;

function ProductCard({ product }: { product: Product }) {
  const [wishlisted, setWishlisted] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setWishlisted(isInWishlist(product.id));
  }, [product.id]);

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    if (wishlisted) {
      removeFromWishlist(product.id);
      setWishlisted(false);
    } else {
      addToWishlist({ id: product.id, name: product.name, category: product.category, price: product.price, image: product.image });
      setWishlisted(true);
    }
  };

  return (
    <article className="group mx-auto w-full max-w-sm flex-shrink-0 px-2 sm:px-3 md:px-4 lg:px-3">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-stone-100">
          {!imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image.startsWith('http') ? product.image : product.image.startsWith('/uploads/') ? assetUrl(product.image) : product.image}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-400">
              <svg className="h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </Link>
      <div className="mt-4">
        <Link href={`/products/${product.id}`}>
          <h3 className="font-sans text-sm font-semibold uppercase tracking-wide text-charcoal">
            {product.name}
          </h3>
        </Link>
        <p className="mt-1 font-sans text-xs text-stone-500">{product.category}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-sans text-sm font-semibold text-charcoal">{product.price}$</span>
          <div className="flex items-center gap-2">
            <Link
              href={`/products/${product.id}`}
              className="flex h-8 w-8 items-center justify-center text-stone-400 transition-colors hover:text-charcoal"
              aria-label="Quick view"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={toggleWishlist}
              className="flex h-8 w-8 items-center justify-center text-stone-400 transition-colors hover:text-charcoal"
              aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <svg
                className="h-4 w-4"
                fill={wishlisted ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

const BREAKPOINT_LG = 1024;
const BREAKPOINT_MD = 768;
const BREAKPOINT_SM = 480;
const VISIBLE_DESKTOP = 4;
const VISIBLE_TABLET = 3;
const VISIBLE_MOBILE = 2; // at least 2 slides at all sizes (including ≤425px)

function getVisibleCount(width: number): number {
  if (width >= BREAKPOINT_LG) return VISIBLE_DESKTOP;
  if (width >= BREAKPOINT_MD) return VISIBLE_TABLET;
  if (width >= BREAKPOINT_SM) return VISIBLE_MOBILE;
  return VISIBLE_MOBILE; // 2 even at 425px and below
}

export default function LatestBeautySection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_MOBILE);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use actual container width so 2 slides show at 425px and below; size slides in px for accuracy
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setContainerWidth(w);
      setVisibleCount(getVisibleCount(w));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    apiGet<Product[] & { _id?: string }[]>('/api/products')
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) {
          setProducts(
            list.map((p) => ({
              id: String((p as { _id?: string })._id ?? (p as Product).id ?? ''),
              name: p.name,
              category: p.category,
              price: p.price,
              image: p.image,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const maxIndex = Math.max(0, products.length - visibleCount);

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    if (products.length <= visibleCount) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [products.length, visibleCount, maxIndex]);

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, maxIndex)));
  };

  // Size by container width so 2 slides show at 425px and below; fallback to vw when container not measured
  const slideWidthPx = containerWidth > 0 ? containerWidth / visibleCount : 100 / visibleCount;
  const trackWidthPx = containerWidth > 0 ? (containerWidth / visibleCount) * products.length : products.length * (100 / visibleCount);
  const translatePx = currentIndex * slideWidthPx;
  const usePx = containerWidth > 0;

  return (
    <section className="mt-12 w-full overflow-hidden bg-cream py-16 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-sans text-3xl font-thin uppercase tracking-wide text-charcoal sm:text-3xl">
          Latest Beauty
        </h2>

        {products.length === 0 ? (
          <p className="mt-10 text-center text-stone-500">No products in this section yet.</p>
        ) : (
        <div ref={containerRef} className="relative mt-10 w-full overflow-hidden" style={{ minHeight: 320 }}>
        {/* Slider track: px or vw so exactly visibleCount slides fit in the container */}
        <div
          className="flex flex-nowrap transition-transform duration-500 ease-out"
          style={{
            width: usePx ? trackWidthPx : `${(100 / visibleCount) * products.length}vw`,
            transform: usePx ? `translateX(-${translatePx}px)` : `translateX(-${currentIndex * (100 / visibleCount)}vw)`,
          }}
        >
          {products.map((product) => (
            <div
              key={product.id}
              className="flex-shrink-0 overflow-hidden"
              style={
                usePx
                  ? { width: slideWidthPx, minWidth: slideWidthPx }
                  : { width: `${100 / visibleCount}vw`, minWidth: `${100 / visibleCount}vw` }
              }
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        {/* Dots: one per slider position */}
        {maxIndex > 0 && (
          <div className="mt-20 flex items-center justify-center gap-2">
            {Array.from({ length: maxIndex + 1 }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                className="h-1.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-charcoal/30"
                style={{
                  width: index === currentIndex ? '2rem' : '1.5rem',
                  backgroundColor: index === currentIndex ? 'rgb(41 37 36)' : 'rgb(214 211 209)',
                }}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : undefined}
              />
            ))}
          </div>
        )}
        </div>
        )}
      </div>
    </section>
  );
}
