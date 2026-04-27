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

type ReturnReq = {
  _id: string;
  order: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  reason?: string;
  createdAt: string;
};

const LOG_PREFIX = '[order-detail]';

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
  const [ret, setRet] = useState<ReturnReq | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnReason, setReturnReason] = useState('');
  const [returnBusy, setReturnBusy] = useState(false);
  const [returnMsg, setReturnMsg] = useState<string>('');
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
        try {
          const r = await apiGet<ReturnReq | null>(`/api/returns/order/${encodeURIComponent(id)}`, { user: true });
          if (!cancelled) setRet(r || null);
        } catch {
          if (!cancelled) setRet(null);
        }
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
  const daysSinceDelivery = deliveredAtDate ? (Date.now() - deliveredAtDate.getTime()) / (1000 * 60 * 60 * 24) : Number.POSITIVE_INFINITY;
  const withinReturnWindow = isDelivered && deliveredAtDate && daysSinceDelivery <= 7;
  const canRequestReturn = Boolean(withinReturnWindow && (!ret || ret.status === 'rejected'));

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

  async function submitReturn() {
    // Defensive: should never happen because the UI only renders the button when order is loaded.
    if (!order) return;
    setReturnMsg('');
    setReturnBusy(true);
    try {
      await apiPost('/api/returns', { orderId: order._id, reason: returnReason.trim() }, { user: true });
      setReturnReason('');
      setReturnMsg('Return request submitted.');
      const r = await apiGet<ReturnReq | null>(`/api/returns/order/${encodeURIComponent(order._id)}`, { user: true });
      setRet(r || null);
    } catch (e) {
      setReturnMsg((e as Error)?.message || 'Failed to request return');
    } finally {
      setReturnBusy(false);
    }
  }

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
              Delivered on {formatDateShort(deliveredAtDate || orderDate)}
            </p>
          )}
          {order.status === 'pending_payment' && (
            <p className="mt-1 text-sm text-amber-700">Complete payment to confirm your order.</p>
          )}
        </div>

        {order.status === 'pending_payment' && order.canRetryPayment && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/90 p-4">
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
                className="rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-cream hover:bg-accent/90 disabled:opacity-50"
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
          <div className="mb-6 rounded-lg border border-stone-300 bg-stone-50 p-4">
            <p className="font-medium text-charcoal">Payment expired</p>
            <p className="mt-1 text-sm text-stone-600">
              This checkout is no longer valid. Add items to your cart and place a new order.
            </p>
            <Link
              href="/checkout"
              className="mt-3 inline-block rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-cream hover:bg-accent/90"
            >
              Place order again
            </Link>
          </div>
        )}

        {/* Returns */}
        <div className="mb-6 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-medium text-charcoal mb-2">Returns</h2>
          {ret ? (
            <p className="text-sm text-stone-700">
              Status: <span className="font-semibold">{ret.status}</span>
            </p>
          ) : (
            <p className="text-sm text-stone-600">No return requested for this order.</p>
          )}
          {isDelivered && !deliveredAtDate && (
            <p className="mt-2 text-sm text-amber-700">
              Delivery date is missing for this order. Please contact support — admin can use “Mark delivered (override)” if the carrier webhook did not record it.
            </p>
          )}
          {isDelivered && deliveredAtDate && !withinReturnWindow && (
            <p className="mt-2 text-sm text-stone-500">Return window closed (7 days from delivery).</p>
          )}
          {canRequestReturn && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-charcoal">Reason (optional)</label>
              <textarea
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm outline-none focus:border-charcoal"
                placeholder="Eg: Size issue / Changed mind / Defect"
              />
              <button
                onClick={() => void submitReturn()}
                disabled={returnBusy}
                className="mt-3 rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-cream hover:opacity-95 disabled:opacity-60"
              >
                {returnBusy ? 'Submitting…' : 'Request return'}
              </button>
              {returnMsg && <p className="mt-2 text-sm text-stone-600">{returnMsg}</p>}
            </div>
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

        {/* Delivery address */}
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-medium text-charcoal mb-2">Delivery address</h2>
          <address className="text-sm text-stone-600 not-italic">
            {order.shippingAddress.name}<br />
            {order.shippingAddress.phone}
            {order.tracking && String(order.tracking).trim() && (
              <>
                <br />
                <span className="font-medium text-charcoal">AWB:</span> {order.tracking}
                <br />
                <span className="font-medium text-charcoal">Courier:</span>{' '}
                {order.courier && String(order.courier).trim() ? order.courier : '—'}
              </>
            )}
            {!order.tracking?.trim() && order.courier && String(order.courier).trim() && (
              <>
                <br />
                <span className="font-medium text-charcoal">Courier:</span> {order.courier}
              </>
            )}
            <br />
            {order.shippingAddress.line1}
            {order.shippingAddress.line2 && <>, {order.shippingAddress.line2}</>}<br />
            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.pincode}
          </address>
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

        <p className="mt-8">
          <Link href="/orders" className="text-sm font-medium text-charcoal underline hover:no-underline">
            ← My orders
          </Link>
        </p>
      </div>
    </main>
  );
}
