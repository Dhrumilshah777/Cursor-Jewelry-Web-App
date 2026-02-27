'use client';

import { useState } from 'react';

const testimonials = [
  {
    id: '1',
    quote:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.',
    name: 'Sarah M.',
    location: 'Los Angeles, 3 years ago',
  },
  {
    id: '2',
    quote:
      'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
    name: 'Emma L.',
    location: 'New York, 2 years ago',
  },
  {
    id: '3',
    quote:
      'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore.',
    name: 'Olivia R.',
    location: 'Chicago, 1 year ago',
  },
];

function StarIcon() {
  return (
    <svg className="h-4 w-4 text-charcoal" fill="currentColor" viewBox="0 0 20 20">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

export default function KindWordsSection() {
  const [current, setCurrent] = useState(0);
  const total = testimonials.length;

  const goPrev = () => setCurrent((c) => (c - 1 + total) % total);
  const goNext = () => setCurrent((c) => (c + 1) % total);

  return (
    <section className="relative w-full overflow-hidden py-16 sm:py-20">
      {/* Background: soft blurred image; use kind-words-bg.jpg in public for custom image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/kind-words-bg.jpg)' }}
      />
      <div className="absolute inset-0 bg-stone-300/40 backdrop-blur-sm" aria-hidden />
      <div className="absolute inset-0 bg-cream/60" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-sans text-3xl font-medium uppercase tracking-wide text-charcoal sm:text-4xl">
          Kind Words
        </h2>

        <div className="relative mt-12 flex items-stretch justify-center gap-6">
          {/* Left arrow — visible on all screens */}
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-charcoal shadow-md transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/30 md:left-4"
            aria-label="Previous testimonial"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Desktop: 3 cards in a row. Mobile: 1 card at a time (carousel) */}
          <div className="flex w-full max-w-5xl flex-1 items-stretch justify-center gap-6 overflow-hidden px-12 md:px-14">
            {testimonials.map((t, index) => (
              <div
                key={t.id}
                className={`flex w-full flex-shrink-0 flex-col rounded-lg bg-white p-6 shadow-md md:max-w-[calc(33.333%-1rem)] ${
                  index === current ? 'block' : 'hidden md:block'
                }`}
              >
                <div className="mb-4 flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <StarIcon key={i} />
                  ))}
                </div>
                <blockquote className="mb-6 flex-1 font-sans text-sm leading-relaxed text-charcoal sm:text-base">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <footer>
                  <p className="font-sans font-semibold text-charcoal">{t.name}</p>
                  <p className="mt-0.5 font-sans text-xs text-stone-500">{t.location}</p>
                </footer>
              </div>
            ))}
          </div>

          {/* Right arrow */}
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-charcoal shadow-md transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-charcoal/30 md:right-4"
            aria-label="Next testimonial"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Dots indicator for mobile */}
        <div className="mt-8 flex justify-center gap-2 md:hidden">
          {testimonials.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all ${
                i === current ? 'w-6 bg-charcoal' : 'w-2 bg-charcoal/30'
              }`}
              aria-label={`Go to testimonial ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
