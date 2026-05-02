'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPatch, apiPost } from '@/lib/api';

type ReturnRow = {
  _id: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  reason?: string;
  createdAt: string;
  shiprocketReturnError?: string;
  shiprocketReturnShipmentId?: string;
  returnAwb?: string;
  returnPickupScheduled?: boolean;
  returnPickupScheduleError?: string;
  returnPickupScheduledAt?: string | null;
  order?: {
    _id: string;
    status?: string;
    subtotal?: number;
    totalAmount?: number;
    deliveredAt?: string | null;
    createdAt?: string;
    isRefunded?: boolean;
    razorpayRefundId?: string;
    refundedAt?: string | null;
  } | null;
  user?: { name?: string; email?: string } | null;
};

function badgeClass(status: string) {
  if (status === 'approved') return 'bg-blue-100 text-blue-800';
  if (status === 'requested') return 'bg-amber-100 text-amber-800';
  if (status === 'refunded') return 'bg-green-100 text-green-800';
  if (status === 'rejected') return 'bg-red-100 text-red-800';
  return 'bg-stone-100 text-stone-700';
}

export default function AdminReturnsPage() {
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickupBusyId, setPickupBusyId] = useState<string | null>(null);
  const [ok, setOk] = useState<string>('');

  async function refresh() {
    setErr('');
    setOk('');
    setLoading(true);
    try {
      const list = await apiGet<ReturnRow[]>('/api/admin/returns', true);
      setReturns(Array.isArray(list) ? list : []);
    } catch (e) {
      setReturns([]);
      setErr((e as Error)?.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return returns;
    return returns.filter((r) => {
      const orderId = r.order?._id || '';
      const email = r.user?.email || '';
      const name = r.user?.name || '';
      const reason = r.reason || '';
      return (
        orderId.toLowerCase().includes(s) ||
        email.toLowerCase().includes(s) ||
        name.toLowerCase().includes(s) ||
        reason.toLowerCase().includes(s) ||
        r.status.toLowerCase().includes(s)
      );
    });
  }, [q, returns]);

  async function setStatus(id: string, status: 'approved' | 'rejected') {
    setErr('');
    setOk('');
    setBusyId(id);
    try {
      await apiPatch(`/api/admin/returns/${encodeURIComponent(id)}`, { status }, true);
      await refresh();
    } catch (e) {
      setErr((e as Error)?.message || 'Failed to update return');
    } finally {
      setBusyId(null);
    }
  }

  async function retryReturnPickup(returnId: string) {
    setErr('');
    setOk('');
    setPickupBusyId(returnId);
    try {
      await apiPost(`/api/admin/returns/${encodeURIComponent(returnId)}/retry-pickup`, {}, true);
      setOk('Return pickup request sent again.');
      await refresh();
    } catch (e) {
      setErr((e as Error)?.message || 'Retry pickup failed');
    } finally {
      setPickupBusyId(null);
    }
  }

  async function refundOrder(returnId: string, orderId: string) {
    setErr('');
    setOk('');
    setBusyId(returnId);
    try {
      await apiPost(`/api/admin/orders/${encodeURIComponent(orderId)}/refund`, undefined, true);
      setOk('Refund triggered successfully.');
      await refresh();
    } catch (e) {
      setErr((e as Error)?.message || 'Refund failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">Returns</h1>
          <p className="mt-1 text-stone-600">Approve or reject return requests.</p>
        </div>
        <Link href="/admin" className="text-sm text-charcoal underline hover:no-underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by order id, email, status, reason…"
          className="w-full max-w-xl rounded border border-stone-300 bg-main px-3 py-2 text-sm outline-none focus:border-charcoal"
        />
        <button
          onClick={() => void refresh()}
          className="rounded border border-stone-300 bg-main px-3 py-2 text-sm font-medium text-charcoal hover:bg-stone-50"
        >
          Refresh
        </button>
      </div>

      {err && (
        <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </div>
      )}
      {ok && (
        <div className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {ok}
        </div>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-stone-500">Loading returns…</p>
      ) : filtered.length === 0 ? (
        <p className="mt-6 text-sm text-stone-500">No returns found.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((r) => (
            <li key={r._id} className="rounded-lg border border-stone-200 bg-main p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-charcoal">
                    Return #{r._id.slice(-8).toUpperCase()}
                    {r.order?._id && (
                      <span className="ml-2 text-sm text-stone-500">
                        for order{' '}
                        <Link
                          className="text-charcoal underline hover:no-underline"
                          href={`/admin/orders/${r.order._id}`}
                        >
                          #{r.order._id.slice(-8).toUpperCase()}
                        </Link>
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-stone-600">
                    {r.user?.email || r.user?.name || '—'} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                  {r.reason && <p className="mt-1 text-sm text-stone-600">Reason: {r.reason}</p>}
                  {r.shiprocketReturnError && (
                    <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
                      Shiprocket return: {r.shiprocketReturnError}
                    </p>
                  )}
                  {r.status === 'approved' && (r.shiprocketReturnShipmentId || r.returnAwb) && (
                    <div
                      className={`mt-2 rounded border px-2 py-1.5 text-xs ${
                        r.returnPickupScheduled && !r.returnPickupScheduleError
                          ? 'border-green-200 bg-green-50 text-green-900'
                          : 'border-amber-200 bg-amber-50 text-amber-900'
                      }`}
                    >
                      <span className="font-medium text-charcoal">
                        Return pickup:{' '}
                        {r.returnPickupScheduled && !r.returnPickupScheduleError
                          ? 'Scheduled ✓'
                          : r.returnPickupScheduleError
                            ? 'Failed ⚠️'
                            : 'Pending'}
                      </span>
                      {r.returnPickupScheduleError && (
                        <span className="mt-1 block break-words text-red-800">{r.returnPickupScheduleError}</span>
                      )}
                      {r.returnPickupScheduledAt && (
                        <span className="mt-1 block text-stone-600">
                          Recorded: {new Date(r.returnPickupScheduledAt).toLocaleString()}
                        </span>
                      )}
                      {r.returnPickupScheduled &&
                        r.returnPickupScheduledAt &&
                        ['approved'].includes(r.status) &&
                        (Date.now() - new Date(r.returnPickupScheduledAt).getTime()) / 3600000 >= 24 && (
                          <span className="mt-1 block font-medium text-amber-900">
                            No movement 24h+ after scheduled pickup — retry or check Shiprocket.
                          </span>
                        )}
                    </div>
                  )}
                </div>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(r.status)}`}>
                  {r.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-stone-500">
                  Order status: {r.order?.status ? r.order.status.replace(/_/g, ' ') : '—'}
                  {typeof r.order?.totalAmount === 'number' && r.order.totalAmount > 0 ? (
                    <span> · ₹{Number(r.order.totalAmount).toFixed(2)}</span>
                  ) : typeof r.order?.subtotal === 'number' ? (
                    <span> · ₹{Number(r.order.subtotal).toFixed(2)}</span>
                  ) : null}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {r.status === 'approved' && r.shiprocketReturnShipmentId && r.returnAwb && (
                    <button
                      onClick={() => void retryReturnPickup(r._id)}
                      disabled={pickupBusyId === r._id}
                      className="rounded border border-stone-400 bg-main px-3 py-1.5 text-xs font-medium text-charcoal hover:bg-stone-50 disabled:opacity-60"
                    >
                      {pickupBusyId === r._id ? '…' : 'Retry return pickup'}
                    </button>
                  )}
                  <button
                    onClick={() => void setStatus(r._id, 'approved')}
                    disabled={busyId === r._id || r.status === 'approved' || r.status === 'refunded'}
                    className="rounded bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => void setStatus(r._id, 'rejected')}
                    disabled={busyId === r._id || r.status === 'rejected' || r.status === 'refunded'}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => r.order?._id && void refundOrder(r._id, r.order._id)}
                    disabled={
                      busyId === r._id ||
                      r.status !== 'approved' ||
                      !r.order?._id ||
                      r.order.isRefunded === true ||
                      r.order.status === 'refunded' ||
                      Boolean(String(r.order.razorpayRefundId || '').trim())
                    }
                    className="rounded bg-accent px-3 py-1.5 text-xs font-semibold text-accent-cream hover:opacity-95 disabled:opacity-60"
                    title={r.status !== 'approved' ? 'Approve return first' : 'Trigger Razorpay refund'}
                  >
                    Refund
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

