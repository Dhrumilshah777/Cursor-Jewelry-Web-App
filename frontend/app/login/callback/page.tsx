'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setUserLoggedIn, clearAdminLoggedIn, getCart, setCart, mergeCartApi, apiGet } from '@/lib/api';

function LoginCallbackContent() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    clearAdminLoggedIn();
    (async () => {
      try {
        await apiGet<{ user: unknown }>('/api/auth/me', { user: true });
      } catch {
        setStatus('error');
        return;
      }
      setUserLoggedIn();
      const guestCart = getCart();
      if (guestCart.length > 0) {
        try {
          await mergeCartApi(guestCart);
          setCart([]);
        } catch (_) {}
      }
      const returnTo = typeof window !== 'undefined' ? localStorage.getItem('login-return-to') : null;
      if (typeof window !== 'undefined') localStorage.removeItem('login-return-to');
      setStatus('ok');
      router.replace(returnTo || '/');
      router.refresh();
    })();
  }, [router]);

  if (status === 'error') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center">
          <p className="text-stone-600">Sign-in failed or link expired.</p>
          <a href="/login" className="mt-4 inline-block text-charcoal underline hover:no-underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <p className="text-stone-500">Signing you in…</p>
    </div>
  );
}

export default function LoginCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p className="text-stone-500">Signing you in…</p>
        </div>
      }
    >
      <LoginCallbackContent />
    </Suspense>
  );
}
