'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const CARD_GAP = 20;
const PEEK_PX = 56;
const SLIDE_INTERVAL_MS = 5000;
const MIN_CARD_WIDTH = 220;
const MAX_CARD_WIDTH = 380;

function resolveVideoSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url.startsWith('/') ? url : `/${url}`;
}

export default function BeautyInMotionSection() {
  const [videos, setVideos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ videos: string[] }>('/api/site/beauty-in-motion')
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos : []))
      .catch(() => setVideos([]));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.getBoundingClientRect().width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const cardWidth = containerWidth > 0
    ? Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, containerWidth - PEEK_PX * 2))
    : MIN_CARD_WIDTH;

  const maxIndex = Math.max(0, videos.length - 1);
  const hasWrapped = videos.length >= 2;
  const displayVideos = hasWrapped
    ? [videos[videos.length - 1], ...videos, videos[0]]
    : videos;
  const centerDisplayIndex = hasWrapped ? currentIndex + 1 : 0;

  useEffect(() => {
    if (videos.length <= 1 || maxIndex === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, SLIDE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [videos.length, maxIndex]);

  const translateX = containerWidth > 0
    ? containerWidth / 2 - cardWidth / 2 - centerDisplayIndex * (cardWidth + CARD_GAP)
    : 0;

  if (videos.length === 0) return null;

  return (
    <section className="bg-stone-100 py-16 overflow-hidden">
      <h2 className="text-center text-3xl font-thin uppercase tracking-wide text-charcoal mb-12">
        Beauty in Motion
      </h2>

      <div ref={containerRef} className="overflow-hidden w-full max-w-7xl mx-auto px-2 sm:px-6">
        <div
          className="flex transition-transform duration-700 ease-out will-change-transform"
          style={{
            gap: CARD_GAP,
            transform: `translateX(${translateX}px)`,
          }}
        >
          {displayVideos.map((url, i) => {
            const src = resolveVideoSrc(url);
            if (!src) return null;
            const distance = Math.abs(i - centerDisplayIndex);
            const isCenter = distance === 0;
            const scale = isCenter ? 1 : distance === 1 ? 0.88 : 0.78;
            const opacity = isCenter ? 1 : distance === 1 ? 0.78 : 0.5;
            return (
              <div
                key={hasWrapped ? `disp-${i}-${url}` : `${i}-${url}`}
                className="flex-shrink-0 overflow-hidden rounded-xl bg-stone-200 shadow-lg transition-[transform,opacity] duration-700 ease-out"
                style={{
                  width: cardWidth,
                  aspectRatio: '9 / 16',
                  transform: `scale(${scale})`,
                  opacity,
                  transformOrigin: 'center center',
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
