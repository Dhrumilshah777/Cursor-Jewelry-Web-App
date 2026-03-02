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
  courier?: string;
  createdAt: string;
};

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

const TIMELINE_STEPS = [
  { key: 'paid', label: 'Confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Dispatched' },
  { key: 'out_for_delivery', label: 'Out for Delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_ORDER = ['pending_payment', 'paid', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'];

function isStepDone(orderStatus: string, stepKey: string): boolean {
  if (orderStatus === 'cancelled') return false;
  const currentIndex = STATUS_ORDER.indexOf(orderStatus);
  const stepIndex = STATUS_ORDER.indexOf(stepKey);
  if (currentIndex < 0 || stepIndex < 0) return false;
  return currentIndex >= stepIndex;
}

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
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
      <main className="min-h-[50vh] px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <p className="text-stone-500">Loading order…</p>
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="min-h-[50vh] px-4 py-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-sans text-xl font-semibold text-charcoal">Order not found</h1>
          <Link href="/orders" className="mt-4 inline-block text-charcoal underline hover:no-underline">
            ← My orders
          </Link>
        </div>
      </main>
    );
  }

  const orderDate = new Date(order.createdAt);
  const isDelivered = order.status === 'delivered';

  return (
    <main className="min-h-[50vh] px-4 py-6 pb-12">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link href="/orders" className="flex items-center gap-1 text-stone-600 hover:text-charcoal">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Orders
          </Link>
        </div>

        {/* Prominent status */}
        <div className="mb-6">
          <h1 className="font-sans text-2xl font-bold capitalize text-charcoal">
            {statusLabel(order.status)}
          </h1>
          {isDelivered && (
            <p className="mt-1 flex items-center gap-2 text-sm text-green-700">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Delivered on {formatDateShort(orderDate)}
            </p>
          )}
          {order.status === 'pending_payment' && (
            <p className="mt-1 text-sm text-amber-700">Complete payment to confirm your order.</p>
          )}
        </div>

        {/* Product card(s) */}
        <div className="rounded-xl bg-stone-50/80 p-4 mb-6">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-200">
                {item.image ? (
                  <img src={imageSrc(item.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-stone-400">
                    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-charcoal">{item.name}</p>
                <p className="text-sm text-stone-500">
                  Qty: {item.quantity} × ₹{item.price}
                </p>
                <p className="mt-1 text-sm font-medium text-charcoal">
                  ₹{(Number(item.price.replace(/[^0-9.]/g, '')) * item.quantity).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
          <div className="mt-4 border-t border-stone-200 pt-3">
            <p className="text-sm font-semibold text-charcoal">
              Subtotal: ₹{Number(order.subtotal).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Delivery timeline */}
        <div className="mb-6">
          <h2 className="font-medium text-charcoal mb-4">Order timeline</h2>
          <div className="relative pl-6">
            <div className="absolute left-[5px] top-0 bottom-0 w-0.5 bg-stone-200" />
            {TIMELINE_STEPS.map((step, index) => {
              const done = isStepDone(order.status, step.key);
              const showDate = step.key === 'paid' ? formatDate(orderDate) : (done ? '—' : '—');
              return (
                <div key={step.key} className="relative flex gap-3 pb-6 last:pb-0">
                  <div
                    className={`absolute left-0 top-1.5 h-3 w-3 -translate-x-[5px] rounded-full ${
                      done ? 'bg-green-500' : 'bg-stone-300'
                    }`}
                  />
                  <div className="flex-1">
                    <p className={`font-medium ${done ? 'text-charcoal' : 'text-stone-400'}`}>
                      {step.label}
                    </p>
                    <p className="text-sm text-stone-500">{showDate}</p>
                  </div>
                  {done && (
                    <span className="text-green-600 shrink-0">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(order.tracking || order.courier) && (
          <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
            <h2 className="font-medium text-charcoal mb-2">Tracking</h2>
            {order.tracking && (
              <p className="text-sm text-stone-600">
                <span className="font-medium">AWB:</span> {order.tracking}
              </p>
            )}
            {order.courier && (
              <p className="text-sm text-stone-600 mt-1">
                <span className="font-medium">Courier:</span> {order.courier}
              </p>
            )}
            {order.tracking && (
              <a
                href={`https://track.shiprocket.co/?awb=${encodeURIComponent(order.tracking)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-charcoal underline hover:no-underline"
              >
                Track here
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        )}

        {/* Delivery address */}
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-medium text-charcoal mb-2">Delivery address</h2>
          <address className="text-sm text-stone-600 not-italic">
            {order.shippingAddress.name}<br />
            {order.shippingAddress.phone}<br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
          </address>
        </div>

        <p className="mt-8">
          <Link href="/orders" className="text-sm font-medium text-charcoal underline hover:no-underline">
            ← My orders
          </Link>
        </p>
      </div>
    </main>
  );
}
