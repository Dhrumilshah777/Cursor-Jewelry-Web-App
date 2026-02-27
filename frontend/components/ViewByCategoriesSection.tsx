'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { assetUrl } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  image: string;
  slug: string;
};

const CATEGORIES: Category[] = [
  { id: '1', name: 'knots', image: '/instagram-1.jpg', slug: 'knots' },
  { id: '2', name: 'pearl', image: '/instagram-2.jpg', slug: 'pearl' },
  { id: '3', name: 'sea cut', image: '/instagram-3.jpg', slug: 'sea-cut' },
  { id: '4', name: 'mystic', image: '/instagram-4.jpg', slug: 'mystic' },
  { id: '5', name: 'undersea', image: '/instagram-5.jpg', slug: 'undersea' },
];

const AUTOPLAY_MS = 5000;
const MOBILE_GRID_BREAKPOINT = 768;
const ITEMS_PER_PAGE_MOBILE = 4;
const VISIBLE_DESKTOP = 4;

function CategoryCard({ category }: { category: Category }) {
  const [imageError, setImageError] = useState(false);
  const imgSrc =
    category.image.startsWith('http')
      ? category.image
      : category.image.startsWith('/uploads/')
        ? assetUrl(category.image)
        : category.image;

  return (
    <Link
      href={`/products?category=${category.slug}`}
      className="group block"
    >
      {/* Portrait-oriented card with subtle shadow (no play/pause icon) */}
      <div className="relative w-full overflow-hidden rounded-sm bg-stone-100 shadow-md transition-shadow duration-300 group-hover:shadow-lg">
        <div className="aspect-[3/4] w-full">
          {!imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={category.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-400">
              <span className="font-sans text-sm uppercase">{category.name}</span>
            </div>
          )}
        </div>
      </div>
      <p className="mt-3 text-center font-sans text-sm uppercase tracking-wide text-charcoal">
        {category.name}
      </p>
    </Link>
  );
}

export default function ViewByCategoriesSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isMobileGrid, setIsMobileGrid] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      setContainerWidth(w);
      setIsMobileGrid(w < MOBILE_GRID_BREAKPOINT);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mobile: page-based (4 per page, 2x2). Desktop: item-based (5 visible in a row). Before measure, assume mobile.
  const isMobile = containerWidth === 0 ? true : isMobileGrid;
  const pageCountMobile = Math.ceil(CATEGORIES.length / ITEMS_PER_PAGE_MOBILE);
  const maxIndexMobile = Math.max(0, pageCountMobile - 1);
  const maxIndexDesktop = Math.max(0, CATEGORIES.length - VISIBLE_DESKTOP);
  const maxIndex = isMobile ? maxIndexMobile : maxIndexDesktop;

  useEffect(() => {
    setCurrentIndex((prev) => Math.min(prev, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    if (maxIndex <= 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [maxIndex]);

  const goTo = (index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, maxIndex)));
  };

  if (containerWidth === 0 && CATEGORIES.length === 0) return null;

  return (
    <section className="w-full overflow-hidden bg-cream py-16 sm:py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center font-sans text-xs uppercase tracking-[0.2em] text-charcoal/80">
          Best for you
        </p>
        <h2 className="mt-1 text-center font-sans text-3xl font-thin uppercase tracking-wide text-charcoal sm:text-3xl">
          View by categories
        </h2>

        <div
          ref={containerRef}
          className="relative mt-10 w-full overflow-hidden"
          style={{ minHeight: 280 }}
        > 
        {isMobile ? (
          /* Mobile: each slide is a 2x2 grid of 4 categories */
          <div
            className="flex flex-nowrap transition-transform duration-500 ease-out"
            style={{
              width: pageCountMobile * (containerWidth || 400),
              transform: `translateX(-${currentIndex * (containerWidth || 400)}px)`,
            }}
          >
            {Array.from({ length: pageCountMobile }, (_, page) => {
              const start = page * ITEMS_PER_PAGE_MOBILE;
              const items = CATEGORIES.slice(start, start + ITEMS_PER_PAGE_MOBILE);
              const slideW = containerWidth || 400;
              return (
                <div
                  key={page}
                  className="grid grid-cols-2 gap-2 px-2 sm:gap-3 sm:px-4"
                  style={{
                    width: slideW,
                    minWidth: slideW,
                    boxSizing: 'border-box',
                  }}
                >
                  {items.map((cat) => (
                    <CategoryCard key={cat.id} category={cat} />
                  ))}
                </div>
              );
            })}
          </div>
        ) : (
          /* Desktop: single row, portrait cards, minimal gap (no play/pause icon) */
          (() => {
            const gapPx = 8;
            const itemWidthPx =
              containerWidth > 0
                ? (containerWidth - (VISIBLE_DESKTOP - 1) * gapPx) / VISIBLE_DESKTOP
                : 0;
            const itemWidthVw = 100 / VISIBLE_DESKTOP;
            const usePx = containerWidth > 0;
            const trackWidth = usePx
              ? CATEGORIES.length * itemWidthPx + (CATEGORIES.length - 1) * gapPx
              : (100 / VISIBLE_DESKTOP) * CATEGORIES.length;
            const step = usePx ? itemWidthPx + gapPx : itemWidthVw;
            return (
              <div
                className="flex flex-nowrap gap-2 transition-transform duration-500 ease-out"
                style={{
                  width: usePx ? trackWidth : `${trackWidth}vw`,
                  transform: usePx
                    ? `translateX(-${currentIndex * step}px)`
                    : `translateX(-${currentIndex * step}vw)`,
                }}
              >
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex-shrink-0 overflow-visible"
                    style={{
                      width: usePx ? itemWidthPx : `${itemWidthVw}vw`,
                      minWidth: usePx ? itemWidthPx : `${itemWidthVw}vw`,
                    }}
                  >
                    <CategoryCard category={cat} />
                  </div>
                ))}
              </div>
            );
          })()
        )}

        {/* Dots */}
        {maxIndex > 0 && (
          <div className="mt-14 flex items-center justify-center gap-2">
            {Array.from({ length: maxIndex + 1 }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => goTo(index)}
                className="h-1.5 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-charcoal/30"
                style={{
                  width: index === currentIndex ? '2rem' : '1.5rem',
                  backgroundColor:
                    index === currentIndex ? 'rgb(41 37 36)' : 'rgb(214 211 209)',
                }}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentIndex ? 'true' : undefined}
              />
            ))}
          </div>
        )}
        </div>
      </div>
    </section>
  );
}
