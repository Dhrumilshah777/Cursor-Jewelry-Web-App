'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { apiGet, assetUrl } from '@/lib/api';

const REPEAT_COUNT = 3;
const AUTOPLAY_MS = 2000;

type GiftItem = { image: string; title: string; description: string; link: string };

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

function GiftCard({
  item,
  isCarousel,
  isActive,
  cardRef,
  large,
}: {
  item: GiftItem;
  isCarousel: boolean;
  isActive?: boolean;
  cardRef?: (el: HTMLDivElement | null) => void;
  large?: boolean;
}) {
  const cardContent = (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 hover:scale-105"
        style={{ backgroundImage: `url(${resolveImageUrl(item.image)})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-4 py-3 text-center">
        <span className="font-sans text-sm font-semibold uppercase tracking-wide text-white sm:text-base">
          {item.title}
        </span>
        {item.description && (
          <p className="mt-1 font-sans text-sm text-white/95 sm:text-base">{item.description}</p>
        )}
      </div>
    </>
  );

  return (
    <div
      ref={cardRef}
      className={`
        relative flex-shrink-0 overflow-hidden rounded-xl bg-stone-200
        ${isCarousel ? 'w-[62vw] snap-center sm:w-[45vw]' : ''}
        ${large && !isCarousel ? 'md:row-span-2' : ''}
        ${isActive && isCarousel ? 'z-10 scale-105 shadow-lg ring-2 ring-charcoal/10' : ''}
      `}
    >
      <Link
        href={item.link || '/products'}
        className={`block ${isCarousel ? 'w-full' : 'h-full min-h-[280px] md:min-h-0 md:h-full'}`}
      >
        {isCarousel ? (
          <div className="relative w-full overflow-hidden rounded-xl transition-all duration-300">
            <div className="aspect-[2/3] w-full">
              <div className="relative h-full w-full">{cardContent}</div>
            </div>
          </div>
        ) : (
          <div className="relative h-full w-full">{cardContent}</div>
        )}
      </Link>
    </div>
  );
}

export default function GiftForEveryOccasionSection() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefsRef = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const isJumpingRef = useRef(false);

  useEffect(() => {
    apiGet<GiftItem[]>('/api/site/everyday-gifts')
      .then((list) => setGifts(Array.isArray(list) ? list.filter((g) => g?.image) : []))
      .catch(() => setGifts([]))
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
    if (gifts.length === 0) return;
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
  }, [gifts.length, updateActiveIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || gifts.length === 0 || isJumpingRef.current) return;
    const setWidth = el.scrollWidth / REPEAT_COUNT;
    if (el.scrollLeft >= setWidth * 2 - 1) {
      isJumpingRef.current = true;
      el.scrollLeft -= setWidth;
      requestAnimationFrame(() => {
        isJumpingRef.current = false;
      });
    } else if (el.scrollLeft <= 1) {
      isJumpingRef.current = true;
      el.scrollLeft += setWidth;
      requestAnimationFrame(() => {
        isJumpingRef.current = false;
      });
    }
    updateActiveIndex();
  }, [gifts.length, updateActiveIndex]);

  const scroll = (dir: 'prev' | 'next') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.offsetWidth * 0.85;
    el.scrollBy({ left: dir === 'next' ? step : -step, behavior: 'smooth' });
  };

  // Auto-advance carousel every 2s (phone/tablet view)
  useEffect(() => {
    if (gifts.length === 0) return;
    const id = setInterval(() => scroll('next'), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [gifts.length]);

  if (loading) return null;
  if (gifts.length === 0) return null;

  const infiniteGifts = Array.from({ length: REPEAT_COUNT }, () => gifts).flat();

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 mt-6 text-center text-3xl font-thin uppercase tracking-wide text-primary sm:mb-12">
          Everyday Gifts
        </h2>

        {/* Desktop: grid layout — min-height so rows don't collapse (card content is absolute) */}
        <div className="hidden min-h-[420px] gap-4 md:grid md:grid-cols-2 md:grid-rows-[1fr_1fr]">
          {gifts.map((item, i) => (
            <GiftCard key={i} item={item} isCarousel={false} large={i === 0} />
          ))}
        </div>

        {/* Mobile / tablet: carousel */}
        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => scroll('prev')}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-colors hover:bg-white"
            aria-label="Previous"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('next')}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-colors hover:bg-white"
            aria-label="Next"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto py-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {infiniteGifts.map((item, i) => (
              <GiftCard
                key={i}
                item={item}
                isCarousel
                isActive={activeIndex === i}
                cardRef={(el) => {
                  slideRefsRef.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
