'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const GAP_PX = 12; // gap-3
const AUTOPLAY_INTERVAL_MS = 2000;

type NavCategory = { id: string; name: string; image: string; slug: string };

export default function NavCategoryStrip() {
  const [categories, setCategories] = useState<NavCategory[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    apiGet<{ _id?: string; name: string; image: string; slug: string }[]>('/api/site/view-by-categories')
      .then((list) => {
        const mapped: NavCategory[] = (Array.isArray(list) ? list : []).map((c, i) => ({
          id: c._id ?? String(i),
          name: c.name || 'Category',
          image: c.image || '',
          slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || 'category',
        }));
        setCategories(mapped);
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (categories.length <= 1) return;
    const el = scrollRef.current;
    const first = firstItemRef.current;
    if (!el || !first) return;

    const tick = () => {
      const slideWidth = first.offsetWidth + GAP_PX;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) return;
      const next = el.scrollLeft + slideWidth;
      if (next >= maxScroll - 2) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: slideWidth, behavior: 'smooth' });
      }
    };

    const id = setInterval(tick, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [categories.length]);

  if (categories.length === 0) return null;

  return (
    <div className="border-b border-stone-100 bg-white pl-4 sm:pl-6 lg:hidden">
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 overflow-x-auto pr-3 py-3 sm:pr-4"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((cat, index) => {
          const imgSrc = cat.image.startsWith('http') ? cat.image : cat.image.startsWith('/uploads/') ? assetUrl(cat.image) : cat.image || '';
          return (
            <Link
              key={cat.id}
              ref={index === 0 ? firstItemRef : undefined}
              href={`/products?category=${cat.slug}`}
              className="group flex flex-shrink-0 flex-col items-center scroll-smooth"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-stone-100 shadow-md transition-shadow group-hover:shadow-lg sm:h-24 sm:w-24">
                {imgSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc} alt={cat.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-400">
                    <span className="text-xs font-medium uppercase">{cat.name.slice(0, 1)}</span>
                  </div>
                )}
              </div>
              <span className="mt-1.5 text-center font-sans text-xs font-medium uppercase tracking-wide text-stone-800">
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
