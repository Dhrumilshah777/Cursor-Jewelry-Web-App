'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getUserToken, apiGet, assetUrl } from '@/lib/api';

type OrderItem = { productId: string; name: string; price: string; image?: string; quantity: number };
type Address = { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
type Order = {
  _id: string;
  items: OrderItem[];
  shippingAddress: Address;
  subtotal: number;
  status: string;
  tracking?: string;
  createdAt: string;
};

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const token = getUserToken();
    if (!token) {
      router.replace('/login?returnTo=/orders/' + id);
      return;
    }
    apiGet<Order>(`/api/orders/${id}`, { user: true })
      .then(setOrder)
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <p className="text-stone-500">Loading order…</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-[50vh] px-4 py-12">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="font-sans text-2xl font-semibold text-charcoal">Order not found</h1>
          <Link href="/orders" className="mt-4 inline-block text-charcoal underline hover:no-underline">
            ← My orders
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[50vh] px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-sans text-2xl font-semibold uppercase tracking-wide text-charcoal">
          Order #{order._id.slice(-8).toUpperCase()}
        </h1>
        <p className="mt-1 text-sm text-stone-500">
          Placed on {new Date(order.createdAt).toLocaleString()}
        </p>
        <span
          className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-medium ${
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
        {order.tracking && (
          <p className="mt-2 text-sm text-stone-600">Tracking: {order.tracking}</p>
        )}

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="font-medium text-charcoal">Items</h2>
            <ul className="mt-4 space-y-3">
              {order.items.map((item, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  {item.image && (
                    <img src={imageSrc(item.image)} alt="" className="h-14 w-14 rounded object-cover" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-charcoal">{item.name}</p>
                    <p className="text-stone-500">{item.quantity} × ₹{item.price}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-semibold text-charcoal">Subtotal: ₹{Number(order.subtotal).toFixed(2)}</p>
          </div>
          <div>
            <h2 className="font-medium text-charcoal">Shipping address</h2>
            <address className="mt-4 text-sm text-stone-600 not-italic">
              {order.shippingAddress.name}<br />
              {order.shippingAddress.phone}<br />
              {order.shippingAddress.line1}<br />
              {order.shippingAddress.line2 && <>{order.shippingAddress.line2}<br /></>}
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            </address>
          </div>
        </div>

        <p className="mt-8">
          <Link href="/orders" className="text-sm text-charcoal underline hover:no-underline">
            ← My orders
          </Link>
        </p>
      </div>
    </main>
  );
}
