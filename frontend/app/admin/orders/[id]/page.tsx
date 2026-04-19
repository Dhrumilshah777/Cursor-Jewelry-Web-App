'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPatch, apiPost, assetUrl } from '@/lib/api';

type OrderItem = { productId: string; name: string; price: string; image?: string; quantity: number };
type Address = { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
type Order = {
  _id: string;
  user?: { name?: string; email?: string };
  items: OrderItem[];
  shippingAddress: Address;
  subtotal: number;
  status: string;
  tracking?: string;
  courier?: string;
  shiprocketShipmentId?: string;
  pickupScheduled?: boolean;
  pickupScheduleError?: string;
  pickupScheduledAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
};

function imageSrc(image: string) {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  if (image.startsWith('/uploads/')) return assetUrl(image);
  return image.startsWith('/') ? image : `/${image}`;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [tracking, setTracking] = useState('');
  const [courier, setCourier] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [pickupRetryBusy, setPickupRetryBusy] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    apiGet<Order>(`/api/admin/orders/${id}`, true)
      .then((o) => {
        setOrder(o);
        setStatus(o.status);
        setTracking(o.tracking || '');
        setCourier(o.courier || '');
      })
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaveError(null);
    setSaveErrorDetail(null);
    setSaving(true);
    try {
      const updated = await apiPatch<Order>(`/api/admin/orders/${id}`, { status, tracking, courier }, true);
      setOrder(updated);
      setStatus(updated.status);
      setTracking(updated.tracking || '');
      setCourier(updated.courier || '');
    } catch (err) {
      const ex = err as Error & { responseBody?: string };
      let msg = ex instanceof Error ? ex.message : 'Failed to save';
      setSaveError(msg);
      if (ex.responseBody) setSaveErrorDetail(ex.responseBody);
    }
    setSaving(false);
  };

  const handleMarkDeliveredOverride = async () => {
    if (!id) return;
    if (!window.confirm('Mark this order as delivered? Use only if Shiprocket webhook failed or for support override.')) return;
    setOverrideBusy(true);
    setSaveError(null);
    try {
      const updated = await apiPatch<Order>(`/api/admin/orders/${id}/deliver`, {}, true);
      setOrder(updated);
      setStatus(updated.status);
      setTracking(updated.tracking || '');
      setCourier(updated.courier || '');
    } catch (err) {
      const ex = err as Error;
      setSaveError(ex instanceof Error ? ex.message : 'Failed to mark delivered');
    }
    setOverrideBusy(false);
  };

  const handleRetryForwardPickup = async () => {
    if (!id) return;
    setPickupRetryBusy(true);
    setSaveError(null);
    try {
      const updated = await apiPost<Order>(`/api/admin/orders/${id}/retry-pickup`, {}, true);
      setOrder(updated);
    } catch (err) {
      const ex = err as Error;
      setSaveError(ex instanceof Error ? ex.message : 'Retry pickup failed');
    }
    setPickupRetryBusy(false);
  };

  const pickupStallHours =
    order?.pickupScheduled && order.pickupScheduledAt
      ? (Date.now() - new Date(order.pickupScheduledAt).getTime()) / 3600000
      : 0;
  const showPickupStallWarning =
    Boolean(order?.pickupScheduled) &&
    Boolean(order?.pickupScheduledAt) &&
    ['shipped', 'out_for_delivery', 'packed', 'processing'].includes(order?.status || '') &&
    pickupStallHours >= 24;

  if (loading) return <p className="text-stone-500">Loading order…</p>;
  if (!order) return <p className="text-stone-500">Order not found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Order #{order._id.slice(-8).toUpperCase()}</h1>
      <p className="mt-1 text-sm text-stone-500">
        {new Date(order.createdAt).toLocaleString()} · {order.user?.email || order.user?.name || '—'}
      </p>

      {order.shiprocketShipmentId && String(order.tracking || '').trim() && (
        <div
          className={`mt-6 rounded-lg border px-4 py-3 text-sm ${
            order.pickupScheduled && !order.pickupScheduleError
              ? 'border-green-200 bg-green-50 text-green-900'
              : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <p className="font-medium text-charcoal">
            Pickup:{' '}
            {order.pickupScheduled && !order.pickupScheduleError
              ? 'Scheduled ✓'
              : order.pickupScheduleError
                ? 'Failed ⚠️'
                : 'Not confirmed'}
          </p>
          {order.pickupScheduledAt && (
            <p className="mt-1 text-xs text-stone-600">
              API recorded: {new Date(order.pickupScheduledAt).toLocaleString()}
            </p>
          )}
          {order.pickupScheduleError ? (
            <p className="mt-2 break-words text-xs text-red-800">{order.pickupScheduleError}</p>
          ) : null}
          {showPickupStallWarning && (
            <p className="mt-2 text-xs font-medium text-amber-900">
              Scheduled over 24h ago but order is not delivered yet — courier may not have picked up. You can retry pickup
              or use Shiprocket’s panel.
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleRetryForwardPickup()}
            disabled={pickupRetryBusy}
            className="mt-3 rounded border border-stone-400 bg-white px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-stone-50 disabled:opacity-50"
          >
            {pickupRetryBusy ? 'Retrying…' : 'Retry pickup'}
          </button>
        </div>
      )}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-medium text-charcoal">Items</h2>
          <ul className="mt-4 space-y-3">
            {order.items.map((item, i) => (
              <li key={i} className="flex gap-3 text-sm">
                {item.image && <img src={imageSrc(item.image)} alt="" className="h-14 w-14 rounded object-cover" />}
                <div>
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

      <form onSubmit={handleSave} className="mt-8 rounded-lg border border-stone-200 bg-white p-6">
        <h2 className="font-medium text-charcoal">Update status</h2>
        {saveError && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <p className="font-medium">{saveError}</p>
            {saveErrorDetail && (
              <pre className="mt-2 overflow-auto rounded bg-red-100/50 p-2 text-xs whitespace-pre-wrap break-all">
                {saveErrorDetail}
              </pre>
            )}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 rounded border border-stone-300 px-3 py-2"
            >
              <option value="pending_payment">Pending payment</option>
              <option value="payment_cancelled">Payment cancelled</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing (create Shiprocket shipment)</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="min-w-[200px] flex-1 max-w-md space-y-3">
            <div>
              <label className="block text-sm font-medium text-stone-700">Tracking (AWB)</label>
              <input
                type="text"
                value={tracking}
                onChange={(e) => setTracking(e.target.value)}
                placeholder="Tracking / AWB number"
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Courier</label>
              <input
                type="text"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="e.g. Delhivery, Blue Dart"
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              />
            </div>
            {order.shiprocketShipmentId && !tracking && (
              <p className="mt-1 text-sm text-amber-600">Order is in Shiprocket. Assign AWB from Shiprocket dashboard (Orders) and paste the tracking number here, then Save.</p>
            )}
            <p className="text-xs text-stone-500">
              Delivered is set when Shiprocket reports delivery to the customer. After AWB, pickup is requested via API
              {order.pickupScheduled ? ' (recorded as scheduled).' : ' (or use Schedule Pickup in Shiprocket if that step failed).'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            {order.status !== 'delivered' && (
              <button
                type="button"
                onClick={handleMarkDeliveredOverride}
                disabled={overrideBusy}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                {overrideBusy ? '…' : 'Mark delivered (override)'}
              </button>
            )}
          </div>
        </div>
      </form>

      <p className="mt-6">
        <Link href="/admin/orders" className="text-sm text-charcoal underline hover:no-underline">
          ← Back to orders
        </Link>
      </p>
    </div>
  );
}
