'use client';

import { useState, useEffect } from 'react';

const LOGO_DURATION_MS = 1200;
const SLIDE_DURATION_MS = 800;

export default function PageLoader() {
  const [phase, setPhase] = useState<'visible' | 'sliding' | 'gone'>('visible');

  useEffect(() => {
    const startSlide = setTimeout(() => {
      setPhase('sliding');
    }, LOGO_DURATION_MS);

    return () => clearTimeout(startSlide);
  }, []);

  useEffect(() => {
    if (phase !== 'sliding') return;
    const remove = setTimeout(() => {
      setPhase('gone');
    }, SLIDE_DURATION_MS);
    return () => clearTimeout(remove);
  }, [phase]);

  if (phase === 'gone') return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-white transition-transform duration-[800ms] ease-in-out"
      style={{
        transform: phase === 'sliding' ? 'translateY(100%)' : 'translateY(0)',
      }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center">
        <span className="animate-loader-logo font-serif text-4xl font-medium tracking-[0.05em] text-charcoal sm:text-5xl md:text-6xl">
          BLURE
        </span>
        <span className="mt-1.5 font-sans text-xs font-light uppercase tracking-[0.35em] text-stone-500 sm:text-sm">
          THE MAISON BLURE
        </span>
        <span className="mt-2 block h-px w-16 bg-charcoal/30 sm:w-20" aria-hidden />
      </div>
    </div>
  );
}
