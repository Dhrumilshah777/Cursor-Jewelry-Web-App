'use client';

import { useState, useEffect, useRef } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type InstagramImage = { src: string; alt?: string };

const DEFAULT_IMAGES: InstagramImage[] = [
  { src: '/instagram-1.jpg', alt: 'Instagram' },
  { src: '/instagram-2.jpg', alt: 'Instagram' },
  { src: '/instagram-3.jpg', alt: 'Instagram' },
  { src: '/instagram-4.jpg', alt: 'Instagram' },
  { src: '/instagram-5.jpg', alt: 'Instagram' },
];

const AUTO_SCROLL_INTERVAL_MS = 3500;

function imageSrc(src: string): string {
  return src.startsWith('http') ? src : src.startsWith('/uploads/') ? assetUrl(src) : src;
}

function ImageCard({ img, index }: { img: InstagramImage; index: number }) {
  return (
    <a
      href="https://instagram.com"
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex aspect-[4/5] w-64 flex-shrink-0 overflow-hidden sm:w-72 md:w-80 snap-start"
      data-instagram-index={index}
    >
      <img
        src={imageSrc(img.src)}
        alt={img.alt ?? 'Instagram'}
        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        onError={(e) => {
          const target = e.currentTarget;
          const src = target.getAttribute('src') || '';
          if (src.endsWith('.jpg')) {
            target.src = src.replace(/\.jpg$/, '.png');
            return;
          }
          target.style.visibility = 'hidden';
          target.style.position = 'absolute';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) fallback.classList.remove('hidden');
        }}
      />
      <div
        className="absolute inset-0 hidden flex items-center justify-center bg-stone-200 text-stone-400"
        aria-hidden
      >
        <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </a>
  );
}

export default function InstagramSection() {
  const [images, setImages] = useState<InstagramImage[]>(DEFAULT_IMAGES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<InstagramImage[]>('/api/site/instagram')
      .then((list) => {
        if (Array.isArray(list) && list.length > 0) setImages(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, AUTO_SCROLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [images.length]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-instagram-index="${currentIndex}"]`) as HTMLElement | null;
    if (el) {
      container.scrollTo({ left: el.offsetLeft, behavior: 'smooth' });
    }
  }, [currentIndex]);

  return (
    <section className="w-full overflow-hidden bg-cream py-16 sm:py-10">
      <h2 className="text-center font-poppins text-4xl font-medium text-charcoal sm:text-5xl md:text-6xl">
        Instagram
      </h2>

      <div
        ref={scrollRef}
        className="scrollbar-hide mt-10 flex w-full flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-2 sm:gap-3 md:gap-3 snap-x snap-mandatory"
      >
        {images.map((img, index) => (
          <ImageCard key={index} img={img} index={index} />
        ))}
      </div>
    </section>
  );
}
