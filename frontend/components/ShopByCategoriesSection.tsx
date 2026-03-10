'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { assetUrl, apiGet } from '@/lib/api';

type Category = {
  id: string;
  name: string;
  image: string;
  slug: string;
};

type ApiCategory = { _id?: string; name: string; image: string; slug: string };

function BigCard({ category }: { category: Category }) {
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
      className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden rounded-lg bg-stone-800 p-6 sm:min-h-[520px] md:p-8"
    >
      {imgSrc && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={category.name}
          className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-50"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-stone-700" />
      )}
      <div className="relative">
        <p className="font-serif text-2xl font-medium text-white sm:text-3xl">
          {category.name}
        </p>
        <span className="mt-2 inline-block font-sans text-sm font-medium uppercase tracking-wider text-amber-400 transition-colors group-hover:text-amber-300">
          Shop now
        </span>
      </div>
    </Link>
  );
}

function SmallCard({ category }: { category: Category }) {
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
      className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-lg bg-stone-800 p-4 sm:min-h-[260px]"
    >
      {imgSrc && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imgSrc}
          alt={category.name}
          className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity duration-300 group-hover:opacity-50"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="absolute inset-0 bg-stone-700" />
      )}
      <div className="relative">
        <p className="font-sans text-lg font-medium text-white sm:text-xl">
          {category.name}
        </p>
        <span className="mt-1 inline-block font-sans text-xs font-medium uppercase tracking-wider text-amber-400 transition-colors group-hover:text-amber-300">
          View more
        </span>
      </div>
    </Link>
  );
}

export default function ShopByCategoriesSection() {
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

  const main = categories[0];
  const gridItems = categories.slice(1, 5);
  const hasGrid = gridItems.length > 0;

  if (categories.length === 0) return null;

  return (
    <section className="w-full" aria-label="Shop by categories">
      <div className="mx-auto max-w-[1600px] px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center font-serif text-2xl font-light text-charcoal sm:text-3xl">
          Shop by categories
        </h2>
        <div className={`grid grid-cols-1 gap-4 ${hasGrid ? 'md:grid-cols-5 md:gap-5' : ''}`}>
          <div className={hasGrid ? 'md:col-span-2' : ''}>
            {main && <BigCard category={main} />}
          </div>
          {hasGrid && (
            <div className="grid grid-cols-2 gap-4 md:col-span-3 md:gap-5">
              {gridItems.map((cat) => (
                <SmallCard key={cat.id} category={cat} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
