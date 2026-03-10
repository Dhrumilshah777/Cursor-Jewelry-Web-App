'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type Category = { id: string; name: string; image: string; slug: string };
type ApiCategory = { _id?: string; name: string; image: string; slug: string };

function CategoryImage({ category, className }: { category: Category; className: string }) {
  const [error, setError] = useState(false);
  const src =
    category.image.startsWith('http')
      ? category.image
      : category.image.startsWith('/uploads/')
        ? assetUrl(category.image)
        : category.image;

  return (
    <Link href={`/products?category=${category.slug}`} className={className}>
      <div className="relative h-full w-full overflow-hidden">
        {!error && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={category.name}
            className="h-full w-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-500">
            <span className="text-sm font-medium uppercase">{category.name}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
        <div className="pointer-events-none absolute bottom-3 left-4 right-4">
          <p className="font-sans text-base font-medium text-white sm:text-lg">
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
    apiGet<ApiCategory[]>('/api/site/view-by-categories')
      .then((list) => {
        const mapped: Category[] = (Array.isArray(list) ? list : []).map((c, i) => ({
          id: c._id ?? String(i),
          name: c.name || 'Category',
          image: c.image || '',
          slug: c.slug || c.name?.toLowerCase().replace(/\s+/g, '-') || 'category',
        }));
        setCategories(mapped);
      })
      .catch(() => setCategories([]));
  }, []);

  if (categories.length === 0) return null;

  const main = categories[0];
  const b = categories[1];
  const c = categories[2];
  const d = categories[3];

  return (
    <section className="bg-cream py-10 sm:py-12">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-left font-serif text-2xl font-light text-charcoal sm:text-3xl">
          Shop by category
        </h2>

        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
          {/* Left: large image (full height of grid) */}
          <div className="aspect-[4/3] w-full md:aspect-auto md:h-full">
            {main && (
              <CategoryImage
                category={main}
                className="block h-full w-full"
              />
            )}
          </div>

          {/* Right: grid – top full-width, bottom two columns */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="col-span-2 aspect-[8/3] w-full">
              {b && (
                <CategoryImage
                  category={b}
                  className="block h-full w-full"
                />
              )}
            </div>
            <div className="aspect-[4/3] w-full">
              {c && (
                <CategoryImage
                  category={c}
                  className="block h-full w-full"
                />
              )}
            </div>
            <div className="aspect-[4/3] w-full">
              {d && (
                <CategoryImage
                  category={d}
                  className="block h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

