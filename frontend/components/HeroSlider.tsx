'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type Slide = {
  image?: string;
  video?: string;
  title?: string[];
  subtitle?: string;
  cta?: string;
  ctaHref?: string;
};

const DEFAULT_SLIDES: Slide[] = [
  { image: '/hero-1.png', title: ['INSPIRED BY HEAVENLY', 'WONDERS'], subtitle: 'The creations suffuse each sign with unique character', cta: 'Discover the collection', ctaHref: '/products' },
  { video: '/hero-2.mp4', image: '/hero-2.jpg', title: ['TIMELESS ELEGANCE', 'REDEFINED'], subtitle: 'Crafted for those who appreciate the extraordinary', cta: 'Explore the collection', ctaHref: '/products' },
  { image: '/hero-3.jpg', title: ['EVERY PIECE', 'TELLS A STORY'], subtitle: 'Where artistry meets precision in every detail', cta: 'Discover the collection', ctaHref: '/products' },
];

const AUTOPLAY_MS = 6000;

function slideMediaUrl(url: string): string {
  return url.startsWith('http') ? url : url.startsWith('/uploads/') ? assetUrl(url) : url;
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
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{
            opacity: index === current ? 1 : 0,
            pointerEvents: index === current ? 'auto' : 'none',
          }}
        >
          {'video' in slide && slide.video ? (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={slideMediaUrl(slide.video)}
              autoPlay
              muted
              loop
              playsInline
              poster={slide.image ? slideMediaUrl(slide.image) : undefined}
            />
          ) : (
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat bg-stone-800"
              style={{ backgroundImage: `url(${slide.image ? slideMediaUrl(slide.image) : ''})` }}
            />
          )}
          <div
            className="absolute inset-0 bg-gradient-to-br from-amber-900/70 via-stone-800/80 to-stone-900/90"
            aria-hidden
          />
          <div className="absolute inset-0 bg-black/20" aria-hidden />

          <div
            key={`slide-text-${index}-${current}`}
            className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 pt-32 text-center font-poppins font-extralight sm:pt-40 md:pt-44"
          >
            <h1 className="text-4xl leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="animate-hero-text inline-block">{slide.title?.[0] ?? ''}</span>
              <br />
              <span className="animate-hero-text animate-hero-text-delay-1 inline-block">{slide.title?.[1] ?? ''}</span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-relaxed text-white/95 sm:text-base">
              <span className="animate-hero-text animate-hero-text-delay-2 inline-block">{slide.subtitle ?? ''}</span>
            </p>
            <span className="inline-block">
              <Link
                href={slide.ctaHref ?? '/products'}
                className="mt-10 inline-block border border-white px-8 py-3.5 text-xs uppercase tracking-[0.2em] text-white transition-colors hover:bg-white hover:text-charcoal animate-hero-text animate-hero-text-delay-4"
              >
                {slide.cta ?? 'Discover the collection'}
              </Link>
            </span>
          </div>
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
