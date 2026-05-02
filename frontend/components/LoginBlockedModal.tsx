'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'show-login-blocked-popup';

export function triggerLoginBlockedPopup() {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch (_) {}
}

export default function LoginBlockedModal() {
  const [open, setOpen] = useState(false);

  const hasImage = useMemo(() => {
    // We can't reliably check file existence without fetching; render <img> and fall back on error.
    return true;
  }, []);

  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v) {
        sessionStorage.removeItem(STORAGE_KEY);
        setOpen(true);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 px-4 pb-6 pt-10 sm:items-center sm:pb-0">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-main shadow-xl">
        <div className="relative">
          {hasImage && imgOk ? (
            <img
              src="/login-block-popup.png"
              alt="Login required"
              className="h-auto w-full"
              onError={() => setImgOk(false)}
            />
          ) : (
            <div className="px-6 py-8 text-center">
              <p className="text-base font-semibold text-charcoal">Login required</p>
              <p className="mt-2 text-sm text-stone-600">Please login to continue.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-main/90 text-charcoal shadow hover:bg-main"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="border-t border-stone-100 px-4 py-3">
          <Link
            href="/"
            className="block w-full rounded-xl bg-accent py-3 text-center text-sm font-semibold uppercase tracking-wide text-white hover:bg-accent-hover"
            onClick={() => setOpen(false)}
          >
            OK
          </Link>
        </div>
      </div>
    </div>
  );
}

