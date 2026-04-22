'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, refreshUserSession } from '@/lib/api';

type OrderItem = { productId: string; name: string; price: string; quantity: number };
type Order = {
  _id: string;
  items: OrderItem[];
  subtotal: number;
  totalAmount?: number;
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
};

type ReturnReq = {
  _id: string;
  order: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  createdAt: string;
};

function daysSince(date: string | null | undefined): number {
  if (!date) return Number.POSITIVE_INFINITY;
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function latestReturnForOrder(returns: ReturnReq[], orderId: string): ReturnReq | null {
  const r = returns.find((x) => x.order === orderId);
  return r || null;
}

export default function MyOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [returns, setReturns] = useState<ReturnReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [okMsg, setOkMsg] = useState<string>('');

  useEffect(() => {
    (async () => {
      const ok = await refreshUserSession();
      if (!ok) {
        router.replace('/login?returnTo=/orders');
        return;
      }
      try {
        const [orderList, returnList] = await Promise.all([
          apiGet<Order[]>('/api/orders', { user: true }),
          apiGet<ReturnReq[]>('/api/returns', { user: true }),
        ]);
        setOrders(Array.isArray(orderList) ? orderList : []);
        // API returns newest first already; keep it that way.
        setReturns(Array.isArray(returnList) ? returnList : []);
      } catch {
        setOrders([]);
        setReturns([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function requestReturn(orderId: string) {
    setError('');
    setOkMsg('');
    setSubmitting(orderId);
    try {
      await apiPost('/api/returns', { orderId, reason: 'Requested from orders page' }, { user: true });
      setOkMsg('Return request submitted.');
      const returnList = await apiGet<ReturnReq[]>('/api/returns', { user: true });
      setReturns(Array.isArray(returnList) ? returnList : []);
    } catch (e) {
      setError((e as Error)?.message || 'Failed to request return');
    } finally {
      setSubmitting(null);
    }
  }

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
        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {okMsg}
          </div>
        )}

        {orders.length === 0 ? (
          <div className="mt-8 rounded border border-stone-200 bg-stone-50 p-8 text-center">
            <p className="text-stone-600">You haven&apos;t placed any orders yet.</p>
            <Link href="/products" className="mt-4 inline-block text-charcoal underline hover:no-underline">
              Browse products
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((order) => {
              const ret = latestReturnForOrder(returns, order._id);
              const isDelivered = order.status === 'delivered';
              const withinWindow = isDelivered && daysSince(order.deliveredAt || null) <= 7;
              const canRequest = withinWindow && (!ret || ret.status === 'rejected');
              return (
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
                        : order.status === 'payment_cancelled'
                        ? 'bg-stone-200 text-stone-800'
                        : order.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-stone-100 text-stone-700'
                    }`}
                  >
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {new Date(order.createdAt).toLocaleDateString()} · ₹{Number(order.totalAmount ?? order.subtotal).toFixed(2)}
                </p>
                {order.status === 'pending_payment' && (
                  <p className="mt-1 text-xs text-amber-800">Payment not completed — open details to pay.</p>
                )}
                {order.status === 'payment_cancelled' && (
                  <p className="mt-1 text-xs text-stone-600">Checkout expired — place a new order from cart.</p>
                )}
                <Link
                  href={`/orders/${order._id}`}
                  className="mt-2 inline-block text-sm font-medium text-charcoal underline hover:no-underline"
                >
                  View details
                </Link>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {ret && (
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        ret.status === 'approved'
                          ? 'bg-blue-100 text-blue-800'
                          : ret.status === 'requested'
                          ? 'bg-amber-100 text-amber-800'
                          : ret.status === 'refunded'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}
                    >
                      Return: {ret.status}
                    </span>
                  )}
                  {canRequest && (
                    <button
                      onClick={() => void requestReturn(order._id)}
                      disabled={submitting === order._id}
                      className="rounded border border-charcoal px-3 py-1.5 text-xs font-semibold text-charcoal hover:bg-stone-50 disabled:opacity-60"
                    >
                      {submitting === order._id ? 'Requesting…' : 'Request return'}
                    </button>
                  )}
                  {isDelivered && !withinWindow && (
                    <span className="text-xs text-stone-500">Return window closed</span>
                  )}
                </div>
              </li>
            )})}
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
