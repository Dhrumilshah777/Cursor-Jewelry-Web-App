'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category?: string;
  price: string;
  image: string;
};

function productImageSrc(image: string): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

const MOCK_PRODUCTS: Product[] = [
  { _id: 'mock-1', name: 'Pearl Choker', category: 'Necklaces', price: '12,499', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600' },
  { _id: 'mock-2', name: 'Gold Hoop Earrings', category: 'Earrings', price: '8,999', image: 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600' },
  { _id: 'mock-3', name: 'Layered Chain Necklace', category: 'Necklaces', price: '15,299', image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=600' },
  { _id: 'mock-4', name: 'Snake Ring', category: 'Rings', price: '9,500', image: 'https://images.unsplash.com/photo-1603561586110-d6a5dc2d2478?w=600' },
  { _id: 'mock-5', name: 'Classic Studs', category: 'Earrings', price: '6,299', image: 'https://images.unsplash.com/photo-1596944920636-eb8c2d2c2e0e?w=600' },
];

const REPEAT_COUNT = 3;
const AUTOPLAY_MS = 4000;

export default function NewArrivalSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isJumpingRef = useRef(false);

  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    apiGet<{ products?: Product[] }>('/api/products')
      .then((data) => {
        const list = Array.isArray((data as { products?: Product[] }).products)
          ? (data as { products: Product[] }).products
          : [];
        const slice = list.slice(0, 12).map((p) => ({
          _id: p._id ?? '',
          name: p.name ?? '',
          category: p.category ?? '',
          price: String(p.price ?? ''),
          image: p.image ?? '',
        }));
        setProducts(slice.length > 0 ? slice : isLocalhost ? MOCK_PRODUCTS : []);
      })
      .catch(() => {
        const isLocalhost =
          typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        setProducts(isLocalhost ? MOCK_PRODUCTS : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateActiveIndex = useCallback(() => {
    const container = scrollRef.current;
    const refs = slideRefsRef.current;
    if (!container || !refs.length) return;
    const containerCenter = container.scrollLeft + container.offsetWidth / 2;
    let closest = 0;
    let minDist = Infinity;
    refs.forEach((slideEl, i) => {
      if (!slideEl) return;
      const slideCenter = slideEl.offsetLeft + slideEl.offsetWidth / 2;
      const dist = Math.abs(slideCenter - containerCenter);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }, []);

  useEffect(() => {
    if (products.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    const setScrollToMiddle = () => {
      const setWidth = el.scrollWidth / REPEAT_COUNT;
      el.scrollLeft = setWidth;
      requestAnimationFrame(() => updateActiveIndex());
    };
    setScrollToMiddle();
    const ro = new ResizeObserver(setScrollToMiddle);
    ro.observe(el);
    return () => ro.disconnect();
  }, [products.length, updateActiveIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || products.length === 0 || isJumpingRef.current) return;
    const setWidth = el.scrollWidth / REPEAT_COUNT;
    if (el.scrollLeft >= setWidth * 2 - 1) {
      isJumpingRef.current = true;
      el.scrollLeft -= setWidth;
      requestAnimationFrame(() => { isJumpingRef.current = false; });
    } else if (el.scrollLeft <= 1) {
      isJumpingRef.current = true;
      el.scrollLeft += setWidth;
      requestAnimationFrame(() => { isJumpingRef.current = false; });
    }
    updateActiveIndex();
  }, [products.length, updateActiveIndex]);

  const scroll = (dir: 'prev' | 'next') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.offsetWidth * 0.85;
    el.scrollBy({ left: dir === 'next' ? step : -step, behavior: 'smooth' });
  };

  useEffect(() => {
    if (products.length === 0) return;
    const id = setInterval(() => scroll('next'), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [products.length]);

  if (loading) return null;
  if (products.length === 0) return null;

  const infiniteProducts = Array.from({ length: REPEAT_COUNT }, () => products).flat();

  return (
    <section className="relative overflow-hidden bg-[#f5f0eb] py-14 sm:py-16 md:py-20">
      <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* NEW — overlaps top of carousel */}
        <h2
          className="pointer-events-none relative z-10 text-center font-serif text-6xl font-medium tracking-wide text-[#6b5344] sm:text-7xl md:text-8xl lg:text-[5.5rem] xl:text-[6.5rem] 2xl:text-[7.5rem]"
          style={{ marginBottom: '-2.75rem' }}
        >
          NEW
        </h2>

        {/* Carousel — sits slightly under NEW and above ARRIVAL */}
        <div className="relative z-0 w-full py-0">
          <button
            type="button"
            onClick={() => scroll('prev')}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition-colors hover:bg-white md:left-4"
            aria-label="Previous"
          >
            <svg className="h-5 w-5 text-[#6b5344]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('next')}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow-md transition-colors hover:bg-white md:right-4"
            aria-label="Next"
          >
            <svg className="h-5 w-5 text-[#6b5344]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto md:gap-6"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {infiniteProducts.map((product, i) => {
              const isActive = activeIndex === i;
              return (
                <div
                  key={`${product._id}-${i}`}
                  ref={(el) => {
                    slideRefsRef.current[i] = el;
                  }}
                  className="relative flex w-[70vw] flex-shrink-0 snap-center sm:w-[50vw] md:w-[28%] lg:w-[24%]"
                >
                  <Link href={`/products/${product._id}`} className="block w-full">
                    <div
                      className={`relative w-full overflow-hidden rounded-lg bg-[#e8e0d8] shadow-lg transition-all duration-300 ${
                        isActive
                          ? 'z-10 scale-[1.02] shadow-xl ring-2 ring-[#6b5344]/20'
                          : 'scale-100 shadow-lg'
                      }`}
                    >
                      <div className="aspect-[3/4] w-full">
                        <img
                          src={productImageSrc(product.image)}
                          alt={product.name}
                          className="h-full w-full object-cover object-center"
                        />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* ARRIVAL — overlaps bottom of carousel */}
        <h2
          className="pointer-events-none relative z-10 -mt-14 text-center font-serif text-6xl font-medium tracking-wide text-[#6b5344] sm:text-7xl md:text-8xl lg:text-[5.5rem] xl:text-[6.5rem] 2xl:text-[7.5rem]"
        >
          ARRIVAL
        </h2>
      </div>
    </section>
  );
}
