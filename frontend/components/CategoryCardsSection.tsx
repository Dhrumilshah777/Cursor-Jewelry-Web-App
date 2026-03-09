'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type CategoryCard = {
  image: string;
  title: string;
  description: string;
  link: string;
};

function imageSrc(src: string) {
  if (!src) return '';
  if (src.startsWith('http')) return src;
  return src.startsWith('/uploads/') ? assetUrl(src) : src;
}

function Card({ card }: { card: CategoryCard }) {
  const [imageError, setImageError] = useState(false);
  const src = imageSrc(card.image);

  return (
    <Link href={card.link || '/products'} className="group block h-full min-h-[320px] overflow-hidden rounded-lg sm:min-h-[380px]">
      <div className="relative h-full w-full overflow-hidden rounded-lg bg-stone-200">
        {src && !imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 bg-stone-300" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
          <h2 className="font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
            {card.title || 'Collection'}
          </h2>
          {card.description && (
            <p className="mt-2 max-w-md font-sans text-sm text-white/95 sm:text-base">
              {card.description}
            </p>
          )}
          <span className="mt-4 inline-block font-sans text-sm font-medium underline underline-offset-2 transition-opacity group-hover:opacity-90">
            Discover More
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function CategoryCardsSection() {
  const [cards, setCards] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<CategoryCard[]>('/api/site/category-cards')
      .then((data) => setCards(Array.isArray(data) ? data.slice(0, 2) : []))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading || cards.length === 0) return null;

  return (
    <section className="mt-10 py-8 sm:mt-12 sm:py-10" aria-label="Featured collections">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          {cards.map((card, index) => (
            <Card key={index} card={card} />
          ))}
        </div>
      </div>
    </section>
  );
}
