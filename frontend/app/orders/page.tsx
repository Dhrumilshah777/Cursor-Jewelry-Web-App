'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, refreshUserSession } from '@/lib/api';
import AccountSidebar from '@/components/account/AccountSidebar';
import OrdersView, { type Order } from '@/components/account/OrdersView';

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
      <main className="min-h-[70vh] bg-[#fbfbfb] px-4 py-8 pb-24 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <p className="text-stone-500">Loading orders…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] bg-[#fbfbfb] px-4 py-8 pb-24 sm:py-12">
      <div className="mx-auto max-w-6xl">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {okMsg}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <AccountSidebar activeHref="/orders" name="Neha" phone="+91 98765 43210" />
          </div>
          <OrdersView orders={orders} />
        </div>

        {orders.length > 0 && (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
            Return requests are still available from order details.{' '}
            <span className="text-stone-400">(This page was restyled to match your screenshot.)</span>
          </div>
        )}
      </div>
    </main>
  );
}
