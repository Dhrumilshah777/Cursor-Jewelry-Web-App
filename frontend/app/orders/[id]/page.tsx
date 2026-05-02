'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiGet, apiPost, assetUrl, getApiBase, refreshUserSession } from '@/lib/api';

declare global {
  interface Window {
    Razorpay?: new (options: {
      key: string;
      order_id: string;
      prefill?: { name?: string; email?: string; contact?: string };
      modal?: { ondismiss?: () => void };
      handler: (res: { razorpay_payment_id: string; razorpay_signature: string }) => void;
    }) => { open: () => void };
  }
}

type OrderItem = { productId: string; name: string; price: string; image?: string; quantity: number };
type Address = { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
type Order = {
  _id: string;
  items: OrderItem[];
  shippingAddress: Address;
  subtotal: number;
  status: string;
  deliveredAt?: string | null;
  tracking?: string;
  courier?: string;
  shiprocketShipmentId?: string;
  createdAt: string;
  canRetryPayment?: boolean;
  paymentExpiresAt?: string | null;
};

type PaymentStockResponse = {
  ok: boolean;
  stockOk?: boolean;
  canRetry?: boolean;
  status?: string;
  reason?: string;
  outOfStockItems?: Array<{ productId: string; name: string; needed: number; available: number }>;
  paymentExpiresAt?: string;
};

const LOG_PREFIX = '[order-detail]';

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

const TIMELINE_STEPS = [
  { key: 'paid', label: 'Order Placed' },
  { key: 'shipped', label: 'Shipped' },
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

function formatDateTime(d: Date): string {
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCurrencyINR(amount: number): string {
  try {
    return amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
  } catch {
    return `₹${Math.round(amount)}`;
  }
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentBanner, setPaymentBanner] = useState('');
  const [retryBusy, setRetryBusy] = useState(false);
  const [showStockLink, setShowStockLink] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const path = `/api/orders/${id}`;
      const absoluteUrl = `${getApiBase()}${path}`;
      console.info(`${LOG_PREFIX} fetch start`, { orderId: id, path, apiBase: getApiBase(), absoluteUrl });

      const ok = await refreshUserSession();
      if (cancelled) return;
      if (!ok) {
        console.error(`${LOG_PREFIX} refreshUserSession failed — redirecting to login`, { orderId: id });
        router.replace('/login?returnTo=/orders/' + id);
        setLoading(false);
        return;
      }

      try {
        const data = await apiGet<Order>(path, { user: true });
        if (cancelled) return;
        console.info(`${LOG_PREFIX} fetch success`, {
          orderId: id,
          _id: data._id,
          status: data.status,
          tracking: data.tracking?.trim() ? data.tracking : '(empty)',
          courier: data.courier?.trim() ? data.courier : '(empty)',
          shiprocketShipmentId: data.shiprocketShipmentId?.trim() ? data.shiprocketShipmentId : '(empty)',
        });
        const postShip = ['shipped', 'out_for_delivery', 'delivered'].includes(data.status);
        if (postShip && !String(data.tracking || '').trim()) {
          console.warn(`${LOG_PREFIX} status is post-shipment but tracking (AWB) is empty`, {
            orderId: id,
            status: data.status,
            shiprocketShipmentId: data.shiprocketShipmentId || null,
          });
        }
        setOrder(data);
      } catch (err) {
        if (cancelled) return;
        const e = err as Error & { responseBody?: string };
        console.error(`${LOG_PREFIX} fetch failed`, {
          orderId: id,
          absoluteUrl,
          message: e?.message || String(err),
          responseBody: e?.responseBody ?? null,
        });
        setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
  const deliveredAtDate = order.deliveredAt ? new Date(order.deliveredAt) : null;

  const loadRazorpay = (): Promise<void> => {
    if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve();
      script.onerror = () => resolve();
      document.body.appendChild(script);
    });
  };

  async function handleRetryPayment() {
    if (!order) return;
    setPaymentBanner('');
    setShowStockLink(false);
    setRetryBusy(true);
    try {
      const pre = await apiGet<PaymentStockResponse>(
        `/api/orders/payment-stock?orderId=${encodeURIComponent(order._id)}`,
        { user: true }
      );
      if (!pre.ok) {
        setPaymentBanner('Could not verify stock. Please try again.');
        return;
      }
      if (!pre.canRetry) {
        const refreshed = await apiGet<Order>(`/api/orders/${order._id}`, { user: true });
        setOrder(refreshed);
        if (pre.reason === 'payment_expired') {
          setPaymentBanner('This checkout has expired. Please place a new order from your cart.');
        } else {
          setPaymentBanner('This order can no longer be paid online.');
        }
        return;
      }
      if (!pre.stockOk) {
        setShowStockLink(true);
        const names = (pre.outOfStockItems || []).map((x) => x.name).filter(Boolean);
        setPaymentBanner(
          names.length
            ? `These items are now out of stock: ${names.join(', ')}.`
            : 'This item is now out of stock.'
        );
        return;
      }

      const res = await apiPost<{
        razorpayOrderId?: string;
        razorpayKeyId?: string;
        order?: Order;
      }>(`/api/orders/${order._id}/retry-payment`, {}, { user: true });

      const rzOrderId = res.razorpayOrderId;
      const rzKeyId = res.razorpayKeyId;
      if (res.order) setOrder(res.order);

      if (!rzOrderId || !rzKeyId) {
        setPaymentBanner('Payment could not be started. Please try again.');
        return;
      }

      await loadRazorpay();
      const Razorpay = typeof window !== 'undefined' ? window.Razorpay : null;
      if (!Razorpay) {
        setPaymentBanner('Payment gateway could not be loaded.');
        return;
      }

      const phone = String(order.shippingAddress?.phone || '').replace(/\D/g, '').slice(-10);
      const rz = new Razorpay({
        key: rzKeyId,
        order_id: rzOrderId,
        prefill: {
          name: order.shippingAddress?.name?.trim() || undefined,
          contact: phone || undefined,
        },
        modal: {
          ondismiss: () => {
            // If the user closes Razorpay (common when offline), show our verification screen.
            router.replace(`/orders/success?orderId=${order._id}&verifying=1`);
          },
        },
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await apiPost(
              '/api/orders/verify-payment',
              {
                orderId: order._id,
                razorpayOrderId: rzOrderId,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              },
              { user: true }
            );
            if (typeof window !== 'undefined') window.dispatchEvent(new Event('cart-updated'));
            router.replace(`/orders/success?orderId=${order._id}`);
          } catch {
            router.replace(`/orders/success?orderId=${order._id}&verifying=1`);
          }
        },
      });
      rz.open();
    } catch (e) {
      const msg = (e as Error)?.message || 'Could not start payment.';
      setPaymentBanner(msg);
    } finally {
      setRetryBusy(false);
    }
  }

  return (
    <main className="min-h-[50vh] bg-white px-4 pb-28 pt-3">
      <div className="mx-auto max-w-md">
        {/* Top bar */}
        <div className="sticky top-0 z-10 -mx-4 bg-white px-4 pb-2 pt-2">
          <div className="relative flex items-center justify-center">
            <Link
              href="/orders"
              className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal hover:bg-stone-100"
              aria-label="Back"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <h1 className="text-center font-serif text-base font-semibold text-charcoal">Order Details</h1>
            <Link
              href="/contact"
              className="absolute right-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-charcoal hover:bg-stone-100"
              aria-label="Help"
              title="Need help?"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>

        {/* Delivered banner */}
        {isDelivered && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-charcoal">
                  Delivered on {formatDate(deliveredAtDate || orderDate)}
                </p>
                <p className="mt-0.5 text-xs text-stone-500">Your order has been delivered</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending payment notice (kept, but compact) */}
        {order.status === 'pending_payment' && (
          <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Complete payment to confirm your order.
          </div>
        )}

        {order.status === 'pending_payment' && order.canRetryPayment && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4">
            <p className="font-medium text-charcoal">Payment not completed</p>
            {order.paymentExpiresAt && (
              <p className="mt-1 text-xs text-stone-600">
                Pay before{' '}
                {new Date(order.paymentExpiresAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                or this checkout will expire.
              </p>
            )}
            {paymentBanner && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{paymentBanner}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleRetryPayment()}
                disabled={retryBusy}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-cream hover:bg-accent-hover disabled:opacity-50"
              >
                {retryBusy ? 'Please wait…' : 'Retry payment'}
              </button>
              {showStockLink && (
                <Link
                  href="/products"
                  className="text-sm font-medium text-charcoal underline hover:no-underline"
                >
                  Back to products
                </Link>
              )}
            </div>
          </div>
        )}

        {order.status === 'payment_cancelled' && (
          <div className="mt-4 rounded-xl border border-stone-300 bg-stone-50 p-4">
            <p className="font-medium text-charcoal">Payment expired</p>
            <p className="mt-1 text-sm text-stone-600">
              This checkout is no longer valid. Add items to your cart and place a new order.
            </p>
            <Link
              href="/checkout"
              className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-cream hover:bg-accent-hover"
            >
              Place order again
            </Link>
          </div>
        )}

        {/* Order meta */}
        <div className="mt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-charcoal">
                Order #{order._id.slice(-8).toUpperCase()}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">{formatDateTime(orderDate)}</p>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {statusLabel(order.status).replace(/\b\w/g, (m) => m.toUpperCase())}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-stone-500">Payment Method</p>
              <p className="mt-0.5 font-medium text-charcoal">Online</p>
              <p className="mt-1 text-xs text-stone-500">UPI - —</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500">Total Amount</p>
              <p className="mt-0.5 font-semibold text-charcoal">{formatCurrencyINR(Number(order.subtotal) || 0)}</p>
            </div>
          </div>
        </div>

        {/* Order items */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-charcoal">Order Items</h2>
          <div className="mt-3 rounded-xl bg-white">
            {order.items.map((item, i) => {
              const unit = Number(String(item.price || '').replace(/[^0-9.]/g, '')) || 0;
              const line = unit * (item.quantity || 0);
              return (
                <div key={i} className="flex gap-3 border-b border-stone-100 py-3 last:border-b-0">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {item.image ? (
                      <img src={imageSrc(item.image)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-charcoal">{item.name}</p>
                    <p className="mt-0.5 text-xs text-stone-500">18K Yellow Gold</p>
                    <p className="mt-2 text-xs text-stone-600">Qty: {item.quantity}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-charcoal">{formatCurrencyINR(line || unit)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Order tracking */}
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-charcoal">Order Tracking</h2>
          <div className="mt-4 rounded-xl bg-white px-1">
            <div className="relative pl-6">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-emerald-200" aria-hidden />
              {TIMELINE_STEPS.map((step) => {
                const done = isStepDone(order.status, step.key);
                const when =
                  step.key === 'paid'
                    ? formatDateTime(orderDate)
                    : step.key === 'delivered' && deliveredAtDate
                      ? formatDateTime(deliveredAtDate)
                      : done
                        ? '—'
                        : '';
                return (
                  <div key={step.key} className="relative pb-5 last:pb-2">
                    <div className="absolute left-0 top-1.5">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-emerald-600' : 'bg-stone-200'}`}>
                        {done ? (
                          <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden className="text-white">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : null}
                      </div>
                    </div>
                    <div className="pl-2">
                      <p className={`text-sm font-medium ${done ? 'text-charcoal' : 'text-stone-400'}`}>{step.label}</p>
                      {when ? <p className="mt-0.5 text-xs text-stone-500">{when}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action rows */}
        <div className="mt-6 overflow-hidden rounded-xl border border-stone-100 bg-white">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('shipping-address');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex w-full items-center justify-between px-4 py-3 text-sm text-charcoal hover:bg-stone-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-stone-500" aria-hidden>📦</span>
              Shipping Address
            </span>
            <span className="text-stone-400" aria-hidden>›</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/contact')}
            className="flex w-full items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-charcoal hover:bg-stone-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-stone-500" aria-hidden>🧾</span>
              Invoice
            </span>
            <span className="text-stone-400" aria-hidden>›</span>
          </button>
          <Link
            href="/contact"
            className="flex items-center justify-between border-t border-stone-100 px-4 py-3 text-sm text-charcoal hover:bg-stone-50"
          >
            <span className="flex items-center gap-2">
              <span className="text-stone-500" aria-hidden>💬</span>
              Need Help?
            </span>
            <span className="text-stone-400" aria-hidden>›</span>
          </Link>
        </div>

        {/* Shipping address section (target for scroll) */}
        <div id="shipping-address" className="mt-6 rounded-xl bg-stone-50 px-4 py-4">
          <p className="text-sm font-semibold text-charcoal">Shipping Address</p>
          <address className="mt-2 text-sm text-stone-600 not-italic">
            {order.shippingAddress.name}<br />
            {order.shippingAddress.phone}<br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
            {order.tracking && String(order.tracking).trim() ? (
              <>
                <br />
                <span className="font-medium text-charcoal">AWB:</span> {order.tracking}
              </>
            ) : null}
          </address>
          {order.tracking && String(order.tracking).trim() ? (
            <a
              href={`https://track.shiprocket.co/?awb=${encodeURIComponent(order.tracking)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-charcoal underline underline-offset-2 hover:no-underline"
            >
              Track shipment
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : null}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-md gap-3">
          <Link
            href="/products"
            className="flex-1 rounded-xl border border-stone-200 bg-white py-3 text-center text-sm font-semibold text-charcoal hover:bg-stone-50"
          >
            Buy Again
          </Link>
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('shipping-address');
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="flex-1 rounded-xl bg-accent py-3 text-sm font-semibold text-cta hover:bg-accent-hover"
          >
            Track Again
          </button>
        </div>
      </div>
    </main>
  );
}
