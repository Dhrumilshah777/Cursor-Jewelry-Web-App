'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/api';

type Order = {
  _id: string;
  user?: { name?: string; email?: string };
  items: { name: string; quantity: number; price: string }[];
  subtotal: number;
  status: string;
  createdAt: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<Order[]>('/api/admin/orders', true)
      .then((list) => setOrders(Array.isArray(list) ? list : []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-stone-500">Loading orders…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Orders</h1>
      <p className="mt-1 text-stone-600">View and update order status.</p>

      {orders.length === 0 ? (
        <p className="mt-8 text-stone-500">No orders yet.</p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order._id} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/orders/${order._id}`} className="font-medium text-charcoal hover:underline">
                  Order #{order._id.slice(-8).toUpperCase()}
                </Link>
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
                      : order.status === 'payment_cancelled'
                      ? 'bg-red-100 text-red-800'
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
                {order.user?.email || order.user?.name || '—'} · {new Date(order.createdAt).toLocaleString()} · ₹{Number(order.subtotal).toFixed(2)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
