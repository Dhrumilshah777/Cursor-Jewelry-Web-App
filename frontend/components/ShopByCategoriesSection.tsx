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

function ShopCategoryTile({ category }: { category: Category }) {
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
      className="group relative block overflow-hidden"
    >
      <div className="aspect-[3/4] w-full">
        {imgSrc && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={category.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-stone-200 text-stone-500">
            <span className="font-sans text-sm uppercase">{category.name}</span>
          </div>
        )}
      </div>
      {/* Overlay: category name + SHOP HERE, bottom-left, white */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pt-12 pb-4 pl-4 pr-4">
        <p className="font-serif text-xl font-medium text-white sm:text-2xl">
          {category.name}
        </p>
        <p className="mt-1 font-sans text-xs font-medium uppercase tracking-widest text-white/95">
          SHOP HERE
        </p>
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

  if (categories.length === 0) return null;

  return (
    <section className="w-full" aria-label="Shop by categories">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h2 className="text-center font-serif text-2xl font-light text-charcoal sm:text-3xl">
          Shop by categories
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-0 sm:grid-cols-3">
          {categories.slice(0, 6).map((cat) => (
            <ShopCategoryTile key={cat.id} category={cat} />
          ))}
        </div>
      </div>
    </section>
  );
}
