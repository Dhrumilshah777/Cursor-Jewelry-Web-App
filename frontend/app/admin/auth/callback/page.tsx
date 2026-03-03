'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setAdminLoggedIn, apiGet } from '@/lib/api';

function AdminAuthCallbackContent() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    apiGet('/api/admin/me', true)
      .then(() => {
        setAdminLoggedIn();
        setStatus('ok');
        router.replace('/admin');
        router.refresh();
      })
      .catch(() => setStatus('error'));
  }, [router]);

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
