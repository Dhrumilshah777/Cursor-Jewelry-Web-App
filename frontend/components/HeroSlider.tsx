'use client';

import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type Slide = {
  image?: string;
  video?: string;
};

const DEFAULT_SLIDES: Slide[] = [
  { image: '/hero-1.png' },
  { video: '/hero-2.mp4', image: '/hero-2.jpg' },
  { image: '/hero-3.jpg' },
];

const AUTOPLAY_MS = 6000;

function slideMediaUrl(url: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  // Full URL (http/https) — use as-is (e.g. ImageKit.io)
  if (u.startsWith('http://') || u.startsWith('https://')) return u;
  // Protocol-relative URL (//ik.imagekit.io/...)
  if (u.startsWith('//')) return `https:${u}`;
  // Backend upload path
  if (u.startsWith('/uploads/')) return assetUrl(u);
  // Domain-like URL pasted without protocol (e.g. ik.imagekit.io/...)
  if (u.includes('imagekit.io') || /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\//i.test(u)) return `https://${u}`;
  return u;
}

export default function HeroSlider() {
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    apiGet<Slide[]>('/api/site/hero')
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setSlides(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <section className="relative min-h-screen w-full overflow-hidden">
      {slides.map((slide, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity duration-700 ease-in-out bg-stone-800"
          style={{
            opacity: index === current ? 1 : 0,
            pointerEvents: index === current ? 'auto' : 'none',
          }}
        >
          {'video' in slide && slide.video ? (
            <video
              className="absolute inset-0 h-full w-full object-contain"
              src={slideMediaUrl(slide.video)}
              autoPlay
              muted
              loop
              playsInline
              poster={slide.image ? slideMediaUrl(slide.image) : undefined}
            />
          ) : slide.image ? (
            <img
              src={slideMediaUrl(slide.image)}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-stone-800" />
          )}
        </div>
      ))}

      {/* Dots — elongated bar (active) / bar (inactive), no border radius */}
      <div className="absolute bottom-8 left-0 right-0 z-20 flex items-center justify-center gap-1">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => setCurrent(index)}
            className="h-1.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/40"
            style={{
              width: index === current ? '4rem' : '4.25rem',
              backgroundColor: index === current ? 'rgba(248,246,243,0.95)' : 'rgba(255,255,255,0.35)',
              boxShadow: index === current ? '0 0 14px rgba(248,246,243,0.5)' : 'none',
            }}
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === current ? 'true' : undefined}
          />
        ))}
      </div>
    </section>
  );
}
