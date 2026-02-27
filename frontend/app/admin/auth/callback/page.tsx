'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAdminKey, apiGet } from '@/lib/api';

export default function AdminAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    setAdminKey(token);
    apiGet('/api/admin/products', true)
      .then(() => {
        setStatus('ok');
        router.replace('/admin');
        router.refresh();
      })
      .catch(() => setStatus('error'));
  }, [searchParams, router]);

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
