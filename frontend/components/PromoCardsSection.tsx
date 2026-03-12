'use client';

import Link from 'next/link';

export default function PromoCardsSection() {
  return (
    <section className="bg-cream py-8 sm:py-10">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          {/* Card 1: Warm brown-orange, jewelry, SHOP NOW */}
          <Link
            href="/products"
            className="group relative flex min-h-[320px] flex-col justify-between overflow-hidden rounded-xl bg-[#b87333] p-6 sm:min-h-[380px] sm:p-8"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-30 transition-opacity group-hover:opacity-40"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1611652022419-a9419f74343a?w=800)',
              }}
            />
            <div className="relative z-10">
              <h3 className="font-sans text-2xl font-semibold uppercase tracking-wide text-white sm:text-3xl">
                Elsa Paretty Jewelry
              </h3>
              <p className="mt-2 font-sans text-sm text-white/90 sm:text-base">
                Lorem ipsum estibulum blandi
              </p>
            </div>
            <div className="relative z-10 mt-4">
              <span className="inline-block rounded-md bg-white px-5 py-2.5 font-sans text-sm font-semibold uppercase tracking-wide text-black transition-colors group-hover:bg-stone-100">
                Shop now
              </span>
            </div>
          </Link>

          {/* Card 2: Light cream, Euphoria, SHOP MORE */}
          <Link
            href="/products"
            className="group relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-xl bg-[#f5f0e8] p-6 sm:min-h-[380px] sm:p-8"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-50 transition-opacity group-hover:opacity-60"
              style={{
                backgroundImage: 'url(https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800)',
              }}
            />
            <div className="relative z-10 flex flex-col items-center text-center">
              <h3 className="font-serif text-4xl font-light tracking-wide text-white drop-shadow-md sm:text-5xl md:text-6xl">
                Euphoria
              </h3>
              <span className="mt-4 inline-flex items-center gap-2 font-sans text-sm font-medium uppercase tracking-wide text-white underline underline-offset-2">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-700" aria-hidden />
                Shop more
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
