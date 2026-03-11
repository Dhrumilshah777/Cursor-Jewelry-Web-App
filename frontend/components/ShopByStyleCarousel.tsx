'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl } from '@/lib/api';

type Slide = { image: string; label: string; link?: string };

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

/** Mock slides when API returns empty (e.g. localhost) */
const MOCK_SLIDES: Slide[] = [
  { image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600', label: 'OFFICE WEAR', link: '/products' },
  { image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600', label: 'DAILY WEAR', link: '/products' },
  { image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=600', label: 'PARTY WEAR', link: '/products' },
  { image: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=600', label: 'WEDDING WEAR', link: '/products' },
  { image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600', label: 'DATE NIGHT', link: '/products' },
];

export default function ShopByStyleCarousel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    apiGet<Slide[]>('/api/site/shop-by-style')
      .then((list) => {
        const arr = Array.isArray(list) ? list.filter((s) => s?.image) : [];
        setSlides(arr.length > 0 ? arr : isLocalhost ? MOCK_SLIDES : []);
      })
      .catch(() => {
        const isLocalhost =
          typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        setSlides(isLocalhost ? MOCK_SLIDES : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir: 'prev' | 'next') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.offsetWidth * 0.85;
    el.scrollBy({ left: dir === 'next' ? step : -step, behavior: 'smooth' });
  };

  if (loading) return null;
  if (slides.length === 0) return null;

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-center text-3xl font-thin uppercase text-[#1e3a5f]">
          Shop by Style
        </h2>

        <div className="relative">
          {/* Navigation arrows */}
          <button
            type="button"
            onClick={() => scroll('prev')}
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white md:left-4"
            aria-label="Previous"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('next')}
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-colors hover:bg-white md:right-4"
            aria-label="Next"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Carousel */}
          <div
            ref={scrollRef}
            className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto py-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {slides.map((slide, i) => (
              <Link
                key={i}
                href={slide.link || '/products'}
                className="relative flex w-[75vw] flex-shrink-0 snap-center sm:w-[45vw] md:w-[32%] lg:w-[30%]"
              >
                <div className="relative w-full overflow-hidden rounded-xl bg-stone-200">
                  <div className="aspect-[3/4] w-full">
                    <img
                      src={resolveImageUrl(slide.image)}
                      alt={slide.label}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-3 text-center">
                    <span className="font-sans text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
                      {slide.label}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
