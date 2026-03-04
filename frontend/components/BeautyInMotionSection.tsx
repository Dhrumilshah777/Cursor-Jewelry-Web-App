'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const CARD_WIDTH = 300;
const CARD_GAP = 16;
const SLIDE_INTERVAL_MS = 5000;

function resolveVideoSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url.startsWith('/') ? url : `/${url}`;
}

function getVisibleCount(containerWidth: number): number {
  if (containerWidth >= 1200) return 4;
  if (containerWidth >= 768) return 3;
  if (containerWidth >= 480) return 2;
  return 1;
}

export default function BeautyInMotionSection() {
  const [videos, setVideos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ videos: string[] }>('/api/site/beauty-in-motion')
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos : []))
      .catch(() => setVideos([]));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      setVisibleCount(getVisibleCount(el.getBoundingClientRect().width));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const maxIndex = Math.max(0, videos.length - visibleCount);

  useEffect(() => {
    if (videos.length <= visibleCount || maxIndex === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [videos.length, visibleCount, maxIndex]);

  const slideOffset = currentIndex * (CARD_WIDTH + CARD_GAP);

  if (videos.length === 0) return null;

  return (
    <section className="bg-stone-100 py-16">
      <h2 className="text-center text-3xl font-thin uppercase tracking-wide text-charcoal mb-12">
        Beauty in Motion
      </h2>

      <div ref={containerRef} className="overflow-hidden max-w-7xl mx-auto px-4">
        <div
          className="flex transition-transform duration-700 ease-in-out"
          style={{
            gap: CARD_GAP,
            transform: `translateX(-${slideOffset}px)`,
          }}
        >
          {videos.map((url, i) => {
            const src = resolveVideoSrc(url);
            if (!src) return null;
            return (
              <div
                key={`${i}-${url}`}
                className="flex-shrink-0 overflow-hidden rounded-sm bg-stone-200 shadow-md"
                style={{
                  width: CARD_WIDTH,
                  aspectRatio: '3 / 4',
                }}
              >
                <video
                  src={src}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                  aria-label={`Beauty in motion video ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
