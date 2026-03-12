'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

type PromoCard = {
  title: string;
  subtitle: string;
  ctaText: string;
  link: string;
  image: string;
  backgroundColor: string;
  centered: boolean;
};

const DEFAULT_CARDS: PromoCard[] = [
  { title: 'Elsa Paretty Jewelry', subtitle: 'Lorem ipsum estibulum blandi', ctaText: 'Shop now', link: '/products', image: 'https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=800', backgroundColor: '#b87333', centered: false },
  { title: 'Euphoria', subtitle: '', ctaText: 'Shop more', link: '/products', image: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800', backgroundColor: '#f5f0e8', centered: true },
];

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

export default function PromoCardsSection() {
  const [cards, setCards] = useState<PromoCard[]>(DEFAULT_CARDS);

  useEffect(() => {
    apiGet<PromoCard[]>('/api/site/promo-cards')
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        if (arr.length >= 2) {
          setCards(arr.slice(0, 2).map((c, i) => ({
            title: c.title || DEFAULT_CARDS[i]?.title || '',
            subtitle: c.subtitle ?? '',
            ctaText: c.ctaText || DEFAULT_CARDS[i]?.ctaText || 'Shop now',
            link: c.link || '/products',
            image: c.image || '',
            backgroundColor: c.backgroundColor || DEFAULT_CARDS[i]?.backgroundColor || '',
            centered: Boolean(c.centered),
          })));
        }
      })
      .catch(() => {});
  }, []);

  const displayCards = cards.map((c, i) => ({
    ...c,
    title: c.title || DEFAULT_CARDS[i]?.title || '',
    subtitle: c.subtitle ?? '',
    ctaText: c.ctaText || DEFAULT_CARDS[i]?.ctaText || 'Shop now',
    link: c.link || '/products',
    image: resolveImageUrl(c.image || DEFAULT_CARDS[i]?.image || ''),
    backgroundColor: c.backgroundColor || DEFAULT_CARDS[i]?.backgroundColor || (i === 0 ? '#b87333' : '#f5f0e8'),
    centered: Boolean(c.centered),
  }));

  return (
    <section className="bg-cream py-8 sm:py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4 md:gap-6">
          {displayCards.map((card, index) => (
            <Link
              key={index}
              href={card.link}
              className="group relative flex min-h-[200px] flex-col overflow-hidden rounded-lg p-4 sm:min-h-[320px] sm:rounded-xl sm:p-6 md:min-h-[380px] md:p-8"
              style={{ backgroundColor: card.backgroundColor }}
            >
              {card.image && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity group-hover:opacity-40"
                  style={{ backgroundImage: `url(${card.image})` }}
                />
              )}
              {card.centered ? (
                <>
                  <div className="relative z-10 flex flex-1 flex-col items-center justify-center text-center">
                    <h3 className="font-serif text-2xl font-light tracking-wide text-white drop-shadow-md sm:text-4xl md:text-5xl lg:text-6xl">
                      {card.title}
                    </h3>
                    <span className="mt-3 inline-flex items-center gap-2 font-sans text-xs font-medium uppercase tracking-wide text-white underline underline-offset-2 sm:mt-4 sm:text-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-stone-700" aria-hidden />
                      {card.ctaText}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="relative z-10">
                    <h3 className="font-sans text-lg font-semibold uppercase tracking-wide text-white sm:text-2xl md:text-3xl">
                      {card.title}
                    </h3>
                    {card.subtitle && (
                      <p className="mt-1 font-sans text-xs text-white/90 sm:mt-2 sm:text-sm md:text-base">
                        {card.subtitle}
                      </p>
                    )}
                  </div>
                  <div className="relative z-10 mt-3 sm:mt-4">
                    <span className="inline-block rounded-md bg-white px-4 py-2 font-sans text-xs font-semibold uppercase tracking-wide text-black transition-colors group-hover:bg-stone-100 sm:px-5 sm:py-2.5 sm:text-sm">
                      {card.ctaText}
                    </span>
                  </div>
                </>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
