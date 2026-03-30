'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isUserLoggedIn, apiGet, refreshUserSession } from '@/lib/api';

type OrderItem = { productId: string; name: string; price: string; quantity: number };
type Order = {
  _id: string;
  items: OrderItem[];
  subtotal: number;
  status: string;
  createdAt: string;
};

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const ok = await refreshUserSession();
      if (!ok) {
        router.replace('/login?returnTo=/orders');
        return;
      }
      apiGet<Order[]>('/api/orders', { user: true })
        .then((list) => setOrders(Array.isArray(list) ? list : []))
        .catch(() => setOrders([]))
        .finally(() => setLoading(false));
    })();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading orders…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          My orders
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          {orders.length === 0 ? 'No orders yet.' : `${orders.length} order(s).`}
        </p>

        {orders.length === 0 ? (
          <div className="mt-8 rounded border border-stone-200 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">You haven&apos;t placed any orders yet.</p>
            <Link href="/products" className="mt-4 inline-block text-charcoal underline hover:no-underline">
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((order) => (
              <li key={order._id} className="rounded-lg border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-charcoal">
                    Order #{order._id.slice(-8).toUpperCase()}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      order.status === 'delivered'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'out_for_delivery'
                        ? 'bg-blue-100 text-blue-800'
                        : order.status === 'shipped' || order.status === 'packed'
                        ? 'bg-indigo-100 text-indigo-800'
                        : order.status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : order.status === 'pending_payment'
                        ? 'bg-amber-100 text-amber-800'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {new Date(order.createdAt).toLocaleDateString()} · ₹{Number(order.subtotal).toFixed(2)}
                </p>
                <Link
                  href={`/orders/${order._id}`}
                  className="mt-2 inline-block text-sm font-medium text-charcoal underline hover:no-underline"
                >
                  View details
                </Link>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8">
          <Link href="/" className="text-sm text-charcoal underline hover:no-underline">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
