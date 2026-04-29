'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const LOGO_DURATION_MS = 1200;
const SLIDE_DURATION_MS = 800;
/** Always hide even if intermediate timers were cleared (e.g. Strict Mode / tab throttling). */
const SAFETY_HIDE_MS = LOGO_DURATION_MS + SLIDE_DURATION_MS + 1500;

export default function PageLoader() {
  const pathname = usePathname();
  // On catalog pages we want the in-page skeleton grid to be visible.
  if (pathname && pathname.startsWith('/products')) return null;

  const [phase, setPhase] = useState<'visible' | 'sliding' | 'gone'>('visible');
  const innerTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const outerTimer = window.setTimeout(() => {
      setPhase('sliding');
      innerTimerRef.current = window.setTimeout(() => {
        innerTimerRef.current = null;
        setPhase('gone');
      }, SLIDE_DURATION_MS);
    }, LOGO_DURATION_MS);

    const safetyTimer = window.setTimeout(() => {
      setPhase('gone');
    }, SAFETY_HIDE_MS);

    return () => {
      window.clearTimeout(outerTimer);
      window.clearTimeout(safetyTimer);
      if (innerTimerRef.current != null) {
        window.clearTimeout(innerTimerRef.current);
        innerTimerRef.current = null;
      }
    };
  }, []);

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
