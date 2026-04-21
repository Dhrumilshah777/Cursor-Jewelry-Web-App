'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const verifying = searchParams.get('verifying') === '1';

  const [status, setStatus] = useState<string>('');
  const [checking, setChecking] = useState<boolean>(Boolean(orderId));
  const [error, setError] = useState<string>('');

  const canPoll = useMemo(() => Boolean(orderId), [orderId]);

  useEffect(() => {
    if (!canPoll || !orderId) return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 40; // ~2 minutes @ 3s

    const tick = async () => {
      attempts += 1;
      try {
        const o = await apiGet<{ status?: string }>(`/api/orders/${orderId}`, { user: true });
        if (cancelled) return;
        const s = String(o?.status || '');
        if (s) setStatus(s);
        setError('');
        // Stop polling once we're in a terminal/safe state.
        if (['paid', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'stock_failed', 'refunded'].includes(s)) {
          setChecking(false);
          return;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not check order status');
      }
      if (cancelled) return;
      if (attempts >= maxAttempts) {
        setChecking(false);
        return;
      }
      window.setTimeout(tick, 3000);
    };

    setChecking(true);
    tick();
    return () => {
      cancelled = true;
    };
  }, [canPoll, orderId]);

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          {status === 'paid' || status === 'processing' || status === 'packed' || status === 'shipped' || status === 'out_for_delivery' || status === 'delivered'
            ? 'Thank you'
            : verifying || checking
              ? 'Verifying payment…'
              : 'Order received'}
        </h1>
        <p className="mt-4 text-stone-600">
          {status === 'paid' || status === 'processing' || status === 'packed' || status === 'shipped' || status === 'out_for_delivery' || status === 'delivered'
            ? 'Your payment is confirmed and your order is being processed.'
            : status === 'payment_cancelled'
              ? 'Payment was cancelled. If you completed the payment, please wait a moment — we are verifying it.'
              : verifying || checking
                ? 'Please wait while we confirm your payment. This can take up to a minute.'
                : 'Your order has been created. If payment is pending, we are still verifying it.'}
          {orderId && (
            <span className="block mt-2 font-medium text-charcoal">Order ID: {orderId}</span>
          )}
          {status && (
            <span className="block mt-2 text-sm text-stone-500">Status: {status.replace(/_/g, ' ')}</span>
          )}
          {error && (
            <span className="block mt-2 text-sm text-red-600">{error}</span>
          )}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <Link
            href={orderId ? `/orders/${orderId}` : '/orders'}
            className="rounded bg-charcoal px-6 py-3 text-sm font-medium text-white hover:bg-stone-800"
          >
            View order
          </Link>
          <Link
            href="/products"
            className="rounded border border-stone-300 px-6 py-3 text-sm font-medium text-charcoal hover:bg-stone-50"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-lg text-center">
          <p className="text-stone-500">Loading…</p>
        </div>
      </main>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
