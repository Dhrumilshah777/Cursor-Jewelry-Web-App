'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPatch, assetUrl } from '@/lib/api';

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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null);

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
      const updated = await apiPatch<Order>(`/api/admin/orders/${id}`, { status, tracking }, true);
      setOrder(updated);
      setStatus(updated.status);
      setTracking(updated.tracking || '');
    } catch (err) {
      const ex = err as Error & { responseBody?: string };
      let msg = ex instanceof Error ? ex.message : 'Failed to save';
      setSaveError(msg);
      if (ex.responseBody) setSaveErrorDetail(ex.responseBody);
    }
    setSaving(false);
  };

  if (loading) return <p className="text-stone-500">Loading order…</p>;
  if (!order) return <p className="text-stone-500">Order not found.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Order #{order._id.slice(-8).toUpperCase()}</h1>
      <p className="mt-1 text-sm text-stone-500">
        {new Date(order.createdAt).toLocaleString()} · {order.user?.email || order.user?.name || '—'}
      </p>

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
              <option value="paid">Paid</option>
              <option value="processing">Processing (create Shiprocket shipment)</option>
              <option value="packed">Packed</option>
              <option value="shipped">Shipped</option>
              <option value="out_for_delivery">Out for delivery</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium text-stone-700">Tracking</label>
            <input
              type="text"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="Tracking number"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
            {order.courier && (
              <p className="mt-1 text-sm text-stone-500">Courier: {order.courier}</p>
            )}
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
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
