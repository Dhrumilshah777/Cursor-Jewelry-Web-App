'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  clearAdminLoggedIn,
  getCart,
  setCart,
  mergeCartApi,
  apiGet,
  getApiBase,
  refreshUserSession,
  clearUserLoggedIn,
  getLocalGuestWishlist,
  mergeWishlistApi,
  clearGuestWishlistStorage,
  storeUserAuthTokenFallback,
  readOAuthTokenFromUrlHash,
} from '@/lib/api';

function LoginCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    clearAdminLoggedIn();
    (async () => {
      const tokenFromUrl = searchParams.get('token') || readOAuthTokenFromUrlHash();
      if (typeof window !== 'undefined' && window.location.hash) {
        const { pathname, search } = window.location;
        window.history.replaceState(null, '', pathname + search);
      }
      if (tokenFromUrl) storeUserAuthTokenFallback(tokenFromUrl);
      let cookieOk = false;
      try {
        await apiGet<{ user: unknown }>('/api/auth/me', { user: true });
        cookieOk = true;
      } catch {
        if (tokenFromUrl) {
          const res = await fetch(`${getApiBase()}/api/auth/set-cookie`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFromUrl}` },
          });
          cookieOk = res.ok;
        }
      }
      if (!cookieOk) {
        clearUserLoggedIn();
        setStatus('error');
        return;
      }
      await refreshUserSession();
      const guestCart = getCart();
      if (guestCart.length > 0) {
        try {
          await mergeCartApi(guestCart);
          setCart([]);
        } catch (_) {}
      }
      const guestWishlist = getLocalGuestWishlist();
      if (guestWishlist.length > 0) {
        try {
          await mergeWishlistApi(guestWishlist);
          clearGuestWishlistStorage();
        } catch (_) {}
      }
      const returnTo = typeof window !== 'undefined' ? localStorage.getItem('login-return-to') : null;
      if (typeof window !== 'undefined') localStorage.removeItem('login-return-to');
      setStatus('ok');
      router.replace(returnTo || '/');
      router.refresh();
    })();
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-text-muted">Sign-in failed or link expired.</p>
          <a href="/login" className="mt-4 inline-block text-text underline hover:no-underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <p className="text-text-muted">Signing you in…</p>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p className="text-text-muted">Signing you in…</p>
        </div>
      }
    >
      <LoginCallbackContent />
    </Suspense>
  );
}
