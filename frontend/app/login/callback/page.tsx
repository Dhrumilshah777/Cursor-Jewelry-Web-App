'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setUserToken, clearAdminKey } from '@/lib/api';

export default function LoginCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    clearAdminKey(); // Customer login must not grant admin access
    setUserToken(token);
    setStatus('ok');
    router.replace('/');
    router.refresh();
  }, [searchParams, router]);

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
