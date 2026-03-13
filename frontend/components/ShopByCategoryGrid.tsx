'use client';

import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type Category = { id: string; name: string; image: string; image2?: string; slug: string };
type ApiCategory = { _id?: string; name: string; image: string; image2?: string; slug: string };

const MOBILE_PAGE_SIZE = 4;

/** Mock categories shown on localhost when API returns empty (for development) */
const MOCK_CATEGORIES: Category[] = [
  { id: 'mock-1', name: 'Wedding', image: 'https://images.unsplash.com/photo-1519162808019-7de1683fa2ad?w=600', slug: 'wedding' },
  { id: 'mock-2', name: 'Diamond', image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600', slug: 'diamond' },
  { id: 'mock-3', name: 'Gold', image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=600', slug: 'gold' },
  { id: 'mock-4', name: 'Dailywear', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600', slug: 'dailywear' },
  { id: 'mock-5', name: 'Rings', image: 'https://images.unsplash.com/photo-1603561586110-d6a5dc2d2478?w=600', slug: 'rings' },
];

function ShopByCategorySlider({ categories }: { categories: Category[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const pages = Array.from({ length: Math.ceil(categories.length / MOBILE_PAGE_SIZE) }, (_, i) =>
    categories.slice(i * MOBILE_PAGE_SIZE, (i + 1) * MOBILE_PAGE_SIZE)
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || pages.length <= 1) return;
    const onScroll = () => {
      const width = el.offsetWidth;
      const i = Math.round(el.scrollLeft / width);
      setIndex(Math.min(i, pages.length - 1));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pages.length]);

  return (
    <div>
      <div
        ref={scrollRef}
        className="scrollbar-hide flex overflow-x-auto snap-x snap-mandatory gap-0"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {pages.map((pageCats, pageIndex) => (
          <div
            key={pageIndex}
            className="grid w-full flex-shrink-0 grid-cols-2 gap-3 snap-start px-0.5"
          >
            {pageCats.map((cat) => (
              <div key={cat.id} className="aspect-square w-full">
                <CategoryImage category={cat} className="block h-full w-full" rounded warmOverlay />
              </div>
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div className="mt-5 mb-2 flex justify-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                scrollRef.current?.scrollTo({ left: i * (scrollRef.current?.offsetWidth ?? 0), behavior: 'smooth' });
                setIndex(i);
              }}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-[#1e3a5f]' : 'w-2 bg-[#bfd5f2]'
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ROTATE_INTERVAL_MS = 5000;

/** Placeholder when a category has no image or image fails */
const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=800';

/** Placeholder category to fill empty slots in the 5-cell grid */
const PLACEHOLDER_CATEGORY: Category = {
  id: 'placeholder',
  name: 'More coming soon',
  image: PLACEHOLDER_IMAGE,
  slug: 'products',
};

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

function CategoryImage({
  category,
  className,
  rounded,
  warmOverlay,
}: {
  category: Category;
  className: string;
  rounded?: boolean;
  warmOverlay?: boolean;
}) {
  const [error, setError] = useState(false);
  const primary = resolveImageUrl(category.image) || PLACEHOLDER_IMAGE;
  const images = [primary];
  if (category.image2) images.push(resolveImageUrl(category.image2));
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [images.length]);

  useEffect(() => {
    setError(false);
  }, [currentIndex]);

  const href = category.id.startsWith('placeholder') ? '/products' : `/products?category=${category.slug}`;
  return (
    <Link href={href} className={className}>
      <div
        className={`relative h-full w-full overflow-hidden ${rounded ? 'rounded-2xl' : ''}`}
      >
        {!error ? (
          <>
            {images.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={category.name}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-in-out ${
                  i === currentIndex ? 'opacity-100 z-[1]' : 'opacity-0 z-0'
                }`}
                onError={() => setError(true)}
              />
            ))}
          </>
        ) : (
          <img
            src={PLACEHOLDER_IMAGE}
            alt={category.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div
          className={`pointer-events-none absolute inset-0 z-10 ${
            warmOverlay
              ? 'bg-gradient-to-t from-amber-900/75 via-amber-900/25 to-transparent'
              : 'bg-gradient-to-t from-black/55 via-black/15 to-transparent'
          }`}
        />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 flex items-end justify-center pb-4 pt-8">
          <p className="font-sans text-base font-semibold text-white sm:text-lg">
            {category.name}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default function ShopByCategoryGrid() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const isLocalhost =
      typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    apiGet<ApiCategory[]>('/api/site/view-by-categories')
      .then((list) => {
        const mapped: Category[] = (Array.isArray(list) ? list : []).map((c, i) => ({
          id: c._id ?? String(i),
          name: c.name || 'Category',
          image: c.image || '',
          image2: c.image2 || undefined,
          slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || 'category',
        }));
        setCategories(mapped.length > 0 ? mapped : isLocalhost ? MOCK_CATEGORIES : []);
      })
      .catch(() => {
        setCategories(isLocalhost ? MOCK_CATEGORIES : []);
      });
  }, []);

  if (categories.length === 0) return null;

  // Pad to 5 so the desktop grid never has an empty slot
  const padded = [...categories];
  while (padded.length < 5) {
    padded.push({ ...PLACEHOLDER_CATEGORY, id: `placeholder-${padded.length}` });
  }

  // PC layout: tall left | top + bottom-left | empty + bottom-right | tall right (5 slots)
  const tallLeft = padded[0];
  const middleTop = padded[1];
  const middleBottomLeft = padded[2];
  const middleBottomRight = padded[3];
  const tallRight = padded[4];

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="container mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <h2 className="mt-6 mb-12 text-center text-3xl font-thin uppercase tracking-wide text-[#1e3a5f]">
          Shop by category
        </h2>

        {/* Phone: 2x2 grid or slider when more than 4 */}
        <div className="md:hidden">
          {categories.length <= 4 ? (
            <div className="grid grid-cols-2 gap-3">
              {categories.slice(0, 4).map((cat) => (
                <div key={cat.id} className="aspect-square w-full">
                  <CategoryImage category={cat} className="block h-full w-full" rounded warmOverlay />
                </div>
              ))}
            </div>
          ) : (
            <ShopByCategorySlider categories={categories} />
          )}
        </div>

        {/* Desktop: 4 cols, 2 rows — tall left | top + bottom-left | empty + bottom-right | tall right */}
        <div
          className="hidden md:grid gap-2 sm:gap-4 min-h-[520px]"
          style={{
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr',
          }}
        >
          {tallLeft && (
            <div className="min-h-0 col-start-1 row-start-1 row-span-2">
              <CategoryImage category={tallLeft} className="block h-full w-full min-h-[500px]" />
            </div>
          )}
          {middleTop && (
            <div className="min-h-0 col-start-2 row-start-1">
              <CategoryImage category={middleTop} className="block h-full w-full" />
            </div>
          )}
          {middleBottomLeft && (
            <div className="min-h-0 col-start-2 row-start-2">
              <CategoryImage category={middleBottomLeft} className="block h-full w-full" />
            </div>
          )}
          <div className="min-h-0 col-start-3 row-start-1" aria-hidden />
          {middleBottomRight && (
            <div className="min-h-0 col-start-3 row-start-2">
              <CategoryImage category={middleBottomRight} className="block h-full w-full" />
            </div>
          )}
          {tallRight && (
            <div className="min-h-0 col-start-4 row-start-1 row-span-2">
              <CategoryImage category={tallRight} className="block h-full w-full min-h-[500px]" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

