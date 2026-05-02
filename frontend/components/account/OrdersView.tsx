'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { assetUrl } from '@/lib/api';

type OrderItem = {
  productId: string;
  name: string;
  price: string;
  quantity: number;
  image?: string;
  pricing?: { goldPurity?: string };
};
export type Order = {
  _id: string;
  items: OrderItem[];
  subtotal: number;
  totalAmount?: number;
  status: string;
  createdAt: string;
  deliveredAt?: string | null;
};

type TabKey = 'all' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

function formatINR(amount: number) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusPill(status: string): { label: string; cls: string } {
  const s = String(status || '').toLowerCase();
  if (s === 'delivered') return { label: 'Delivered', cls: 'bg-emerald-100 text-emerald-700' };
  if (s === 'paid') return { label: 'Paid', cls: 'bg-emerald-100 text-emerald-700' };
  if (s === 'shipped' || s === 'packed') return { label: 'Shipped', cls: 'bg-indigo-100 text-indigo-700' };
  if (s === 'out_for_delivery') return { label: 'Out for Delivery', cls: 'bg-sky-100 text-sky-700' };
  if (s === 'cancelled') return { label: 'Cancelled', cls: 'bg-stone-200 text-stone-700' };
  if (s === 'pending_payment') return { label: 'Pending', cls: 'bg-amber-100 text-amber-700' };
  if (s === 'payment_cancelled') return { label: 'Expired', cls: 'bg-stone-200 text-stone-700' };
  return { label: status.replace(/_/g, ' '), cls: 'bg-stone-100 text-stone-600' };
}

function matchesTab(orderStatus: string, tab: TabKey): boolean {
  const s = String(orderStatus || '').toLowerCase();
  if (tab === 'all') return true;
  if (tab === 'paid') return s === 'paid';
  if (tab === 'shipped') return s === 'shipped' || s === 'packed' || s === 'out_for_delivery';
  if (tab === 'delivered') return s === 'delivered';
  if (tab === 'cancelled') return s === 'cancelled' || s === 'payment_cancelled';
  return true;
}

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

function PrimaryImage({ seed, image, alt }: { seed: string; image?: string; alt?: string }) {
  const src = image ? imageSrc(image) : '';
  const n = Array.from(seed).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hues = [28, 40, 210, 260];
  const hue = hues[n % hues.length];
  return (
    <div
      className="h-24 w-24 overflow-hidden rounded-xl border border-stone-200 bg-main sm:h-28 sm:w-28"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt || ''} className="h-full w-full object-cover" />
      ) : (
        <div
          className="h-full w-full"
          aria-hidden
          style={{
            background:
              `radial-gradient(120px 80px at 30% 25%, rgba(255,255,255,0.95), rgba(255,255,255,0.65) 40%, rgba(0,0,0,0) 70%), ` +
              `linear-gradient(135deg, hsla(${hue}, 60%, 92%, 1), hsla(${hue + 20}, 60%, 85%, 1))`,
          }}
        />
      )}
    </div>
  );
}

function Timeline({ status, createdAt, deliveredAt }: { status: string; createdAt: string; deliveredAt?: string | null }) {
  const s = String(status || '').toLowerCase();
  const steps = useMemo(() => {
    if (s === 'cancelled' || s === 'payment_cancelled') {
      return [
        { label: 'Order Placed', done: true, date: formatDate(new Date(createdAt)) },
        { label: 'Order Cancelled', done: true, date: formatDate(new Date(createdAt)) },
      ];
    }
    const deliveredDone = s === 'delivered';
    const shippedDone = ['shipped', 'packed', 'out_for_delivery', 'delivered'].includes(s);
    const paidDone = ['paid', 'packed', 'shipped', 'out_for_delivery', 'delivered'].includes(s);
    return [
      { label: 'Order Placed', done: true, date: formatDate(new Date(createdAt)) },
      { label: 'Shipped', done: shippedDone, date: shippedDone ? formatDate(new Date(createdAt)) : '' },
      { label: 'Delivered', done: deliveredDone, date: deliveredDone ? formatDate(new Date(deliveredAt || createdAt)) : '' },
    ];
  }, [createdAt, deliveredAt, s]);

  return (
    <div className="relative pl-5">
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-stone-200" />
      <div className="space-y-3">
        {steps.map((st, idx) => (
          <div key={idx} className="relative flex items-start gap-2">
            <span
              className={`mt-1.5 inline-flex h-3 w-3 -translate-x-[1px] items-center justify-center rounded-full ${
                st.done ? 'bg-emerald-500' : 'bg-stone-300'
              }`}
              aria-hidden
            />
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${st.done ? 'text-charcoal' : 'text-stone-400'}`}>{st.label}</p>
              {st.date ? <p className="text-[11px] text-stone-500">{st.date}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active ? 'bg-cta text-white shadow-sm' : 'bg-main text-stone-600 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function OrdersView({ orders }: { orders: Order[] }) {
  const [tab, setTab] = useState<TabKey>('all');
  const filtered = useMemo(() => orders.filter((o) => matchesTab(o.status, tab)), [orders, tab]);

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Link href="/" className="hover:text-stone-600">
              Home
            </Link>
            <span aria-hidden>›</span>
            <span>My Account</span>
            <span aria-hidden>›</span>
            <span className="text-stone-600">My Orders</span>
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight text-charcoal">My Orders</h1>
          <p className="mt-1 text-sm text-stone-500">Track, manage and review your purchases</p>
        </div>
        <p className="text-sm text-stone-500">{orders.length} Orders</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <TabButton active={tab === 'all'} label="All Orders" onClick={() => setTab('all')} />
        <TabButton active={tab === 'paid'} label="Paid" onClick={() => setTab('paid')} />
        <TabButton active={tab === 'shipped'} label="Shipped" onClick={() => setTab('shipped')} />
        <TabButton active={tab === 'delivered'} label="Delivered" onClick={() => setTab('delivered')} />
        <TabButton active={tab === 'cancelled'} label="Cancelled" onClick={() => setTab('cancelled')} />
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-stone-200 bg-main p-10 text-center">
          <p className="text-sm text-stone-600">No orders in this section.</p>
          <Link href="/products" className="mt-4 inline-block text-sm font-semibold text-charcoal underline hover:no-underline">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {filtered.map((order) => {
            const first = order.items?.[0];
            const amount = Number(order.totalAmount ?? order.subtotal ?? 0);
            const date = new Date(order.createdAt);
            const pill = statusPill(order.status);
            const itemCount = Array.isArray(order.items) ? order.items.reduce((a, x) => a + (x.quantity || 0), 0) : 0;
            const purity = String(first?.pricing?.goldPurity || '').trim();
            return (
              <div
                key={order._id}
                className="grid gap-4 rounded-2xl border border-stone-200 bg-main p-4 shadow-[0_10px_30px_-18px_rgba(15,23,42,0.18)] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-5"
              >
                <PrimaryImage seed={order._id} image={first?.image} alt={first?.name || 'Order item'} />

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-charcoal">Order #{order._id.slice(-8).toUpperCase()}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${pill.cls}`}>{pill.label}</span>
                  </div>

                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M8 7V3m8 4V3M4 11h16M5 7h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      {formatDate(date)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                        ₹
                      </span>
                      {formatINR(amount)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M6 6h15l-2 9H7L6 6z" strokeLinejoin="round" />
                          <path d="M6 6 5 3H2" strokeLinecap="round" />
                          <circle cx="8" cy="20" r="1.5" />
                          <circle cx="18" cy="20" r="1.5" />
                        </svg>
                      </span>
                      {itemCount || order.items?.length || 0} item
                    </span>
                  </p>

                  <p className="mt-3 truncate text-sm font-semibold text-charcoal">{first?.name || 'Order items'}</p>
                  <p className="mt-1 text-xs text-stone-500">{purity ? purity : (itemCount > 1 ? `${itemCount} items` : '')}</p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/orders/${order._id}`}
                      className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
                    >
                      View Details
                    </Link>
                    <Link
                      href="/products"
                      className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-main px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
                    >
                      Buy Again
                    </Link>
                  </div>
                </div>

                <div className="border-t border-stone-200 pt-4 sm:border-l sm:border-t-0 sm:pt-0 sm:pl-5">
                  <Timeline status={order.status} createdAt={order.createdAt} deliveredAt={order.deliveredAt} />
                </div>
              </div>
            );
          })}

          <div className="flex justify-center pt-4">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-main px-5 py-2.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Load More Orders
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

