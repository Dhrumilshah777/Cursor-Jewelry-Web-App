'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, refreshUserSession } from '@/lib/api';

type Address = {
  name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export default function AddressesPage() {
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await refreshUserSession().catch(() => false);
      if (!ok) {
        if (!cancelled) {
          setAddresses([]);
          setLoading(false);
        }
        return;
      }
      try {
        const me = await apiGet<{ user?: { addresses?: Address[] } }>('/api/auth/me', { user: true });
        if (!cancelled) setAddresses(Array.isArray(me?.user?.addresses) ? me.user.addresses : []);
      } catch {
        if (!cancelled) setAddresses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-h-[60vh] bg-white px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/login" className="text-sm text-charcoal underline underline-offset-2 hover:no-underline">
          ← Back
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-charcoal">Address Book</h1>

        {loading ? (
          <p className="mt-4 text-sm text-stone-500">Loading…</p>
        ) : addresses.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">No saved addresses yet.</p>
        ) : (
          <div className="mt-6 space-y-3">
            {addresses.map((a, idx) => (
              <div key={idx} className="rounded-xl border border-stone-200 bg-white p-4">
                <p className="text-sm font-semibold text-charcoal">{a.name || 'Address'}</p>
                <p className="mt-1 text-sm text-stone-600">
                  {[a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')}
                </p>
                {a.phone ? <p className="mt-2 text-xs text-stone-500">{a.phone}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

