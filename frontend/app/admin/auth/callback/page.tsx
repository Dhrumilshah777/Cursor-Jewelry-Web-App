'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  setAdminLoggedIn,
  apiGet,
  getApiBase,
  storeAdminAuthTokenFallback,
  readOAuthTokenFromUrlHash,
} from '@/lib/api';

function AdminAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const tokenFromUrl = searchParams.get('token') || readOAuthTokenFromUrlHash();
    if (typeof window !== 'undefined' && window.location.hash) {
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', pathname + search);
    }
    if (tokenFromUrl) storeAdminAuthTokenFallback(tokenFromUrl);
    (async () => {
      let ok = false;
      try {
        await apiGet('/api/admin/me', { admin: true });
        ok = true;
      } catch {
        if (tokenFromUrl) {
          const res = await fetch(`${getApiBase()}/api/auth/set-admin-cookie`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFromUrl}` },
          });
          ok = res.ok;
        }
      }
      if (!ok) {
        setStatus('error');
        return;
      }
      setAdminLoggedIn();
      setStatus('ok');
      router.replace('/admin');
      router.refresh();
    })();
  }, [router, searchParams]);

  if (status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
        <div className="text-center">
          <p className="text-stone-600">Sign-in failed or session expired.</p>
          <a href="/admin/login" className="mt-4 inline-block text-charcoal underline hover:no-underline">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
      <p className="text-stone-500">Signing you in…</p>
    </div>
  );
}

export default function AdminAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-100 p-4">
          <p className="text-stone-500">Signing you in…</p>
        </div>
      }
    >
      <AdminAuthCallbackContent />
    </Suspense>
  );
}
