'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Thank you
        </h1>
        <p className="mt-4 text-stone-600">
          Your order has been placed successfully.
          {orderId && (
            <span className="block mt-2 font-medium text-charcoal">Order ID: {orderId}</span>
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
