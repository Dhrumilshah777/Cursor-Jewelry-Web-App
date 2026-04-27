'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

function resolveVideoUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

const REPEAT_COUNT = 3;

export default function BeautyInMotionSection() {
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const slideRefsRef = useRef<(HTMLDivElement | null)[]>([]);
  const videoRefsRef = useRef<(HTMLVideoElement | null)[]>([]);
  const isJumpingRef = useRef(false);

  useEffect(() => {
    apiGet<{ videos?: string[] }>('/api/site/beauty-in-motion')
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos.filter(Boolean) : []))
      .catch(() => setVideos([]))
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
    if (videos.length === 0) return;
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
  }, [videos.length, updateActiveIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || videos.length === 0 || isJumpingRef.current) return;
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
  }, [videos.length, updateActiveIndex]);

  const scroll = (dir: 'prev' | 'next') => {
    const el = scrollRef.current;
    if (!el) return;
    const step = el.offsetWidth * 0.85;
    el.scrollBy({ left: dir === 'next' ? step : -step, behavior: 'smooth' });
  };

  if (loading) return null;
  if (videos.length === 0) return null;

  const infiniteVideos = Array.from({ length: REPEAT_COUNT }, () => videos).flat();

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mt-6 mb-12 text-center text-3xl font-thin uppercase tracking-wide text-blue-700">
          Beauty in Motion
        </h2>

        <div className="relative">
          <button
            type="button"
            onClick={() => scroll('prev')}
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-colors hover:bg-white md:left-4"
            aria-label="Previous"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('next')}
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-colors hover:bg-white md:right-4"
            aria-label="Next"
          >
            <svg className="h-5 w-5 text-charcoal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="scrollbar-hide flex snap-x snap-mandatory gap-4 md:gap-8 overflow-x-auto py-2"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {infiniteVideos.map((videoUrl, i) => {
              const isActive = activeIndex === i;
              const src = resolveVideoUrl(videoUrl);
              return (
                <div
                  key={i}
                  ref={(el) => {
                    slideRefsRef.current[i] = el;
                  }}
                  className="relative flex w-[62vw] flex-shrink-0 snap-center sm:w-[45vw] md:w-[calc((100%-2rem*3)/4)]"
                >
                  <div
                    className={`relative w-full ovXerflow-hidden rounded-xl bg-stone-200 transition-all duration-300 ${
                      isActive
                        ? 'z-10 scale-105 shadow-lg ring-2 ring-charcoal/10'
                        : 'scale-100 shadow-none'
                    }`}
                  >
                    <div className="aspect-[2/3] w-full">
                      <video
                        ref={(el) => {
                          videoRefsRef.current[i] = el;
                        }}
                        src={src}
                        muted
                        playsInline
                        loop
                        autoPlay
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
