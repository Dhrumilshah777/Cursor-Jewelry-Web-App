'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';

type GoldRateRow = { purity: string; pricePerGram: number; updatedAt: string | null };

export default function AdminGoldRatesPage() {
  const [rates, setRates] = useState<GoldRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({ '14K': '', '18K': '', '22K': '', '24K': '' });

  const load = async () => {
    try {
      setError('');
      setSuccess('');
      const list = await apiGet<GoldRateRow[]>('/api/admin/gold-rates', true);
      setRates(Array.isArray(list) ? list : []);
      const next: Record<string, string> = { '14K': '', '18K': '', '22K': '', '24K': '' };
      for (const r of list || []) {
        next[r.purity] = r.pricePerGram > 0 ? String(r.pricePerGram) : '';
      }
      setInputs(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gold rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiPut(
        '/api/admin/gold-rates',
        {
          rates: [
            { purity: '14K', pricePerGram: parseFloat(inputs['14K']) || 0 },
            { purity: '18K', pricePerGram: parseFloat(inputs['18K']) || 0 },
            { purity: '22K', pricePerGram: parseFloat(inputs['22K']) || 0 },
            { purity: '24K', pricePerGram: parseFloat(inputs['24K']) || 0 },
          ],
        },
        true
      );
      await load();
      setSuccess('Saved successfully.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading gold rates…</p>;

  const purityLabels: Record<string, string> = {
    '14K': '14 Karat (14 KT)',
    '18K': '18 Karat',
    '22K': '22 Karat',
    '24K': '24 Karat (24 KT)',
  };

  const handleNumberInput = (purity: '14K' | '18K' | '22K' | '24K', value: string) => {
    const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setInputs((prev) => ({ ...prev, [purity]: filtered }));
  };

  const updatedAtByPurity = rates.reduce<Record<string, string | null>>((acc, r) => {
    acc[r.purity] = r.updatedAt ?? null;
    return acc;
  }, {});

  const formatUpdatedAt = (iso: string | null | undefined) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-charcoal">Gold Rates</h1>
          <p className="mt-1 text-sm leading-relaxed text-stone-600">
            Set price per gram for 14 KT, 18K, 22K, and 24K. Used to calculate product prices when Gold-based pricing is enabled.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading || saving}
            className="rounded border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-charcoal shadow-sm transition hover:bg-stone-50 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-lg border border-amber-100 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-stone-600">Price per gram (₹/gm)</h2>
            <p className="text-xs text-stone-500">Keep this updated with market changes.</p>
          </div>

          <div className="mt-4">
            {(['14K', '18K', '22K', '24K'] as const).map((purity) => (
              <div
                key={purity}
                className="grid gap-2 py-4 border-b border-stone-100 last:border-0 sm:grid-cols-[140px_1fr] sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-12 font-medium text-charcoal">{purity}</span>
                    <span className="text-xs text-stone-500">{purityLabels[purity]}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">Last updated: {formatUpdatedAt(updatedAtByPurity[purity])}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={inputs[purity] ?? ''}
                    onChange={(e) => handleNumberInput(purity, e.target.value)}
                    placeholder="₹ per gram"
                    className="flex-1 rounded border border-stone-300 bg-white px-3 py-2 text-charcoal placeholder:text-stone-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                    aria-label={`${purity} gold price per gram`}
                  />
                  <span className="text-stone-500 text-sm whitespace-nowrap">₹/gm</span>
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {success}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-sm font-medium text-charcoal">Pricing formula</h3>
          <p className="mt-2 text-sm text-stone-600">
            Gold value (net weight × rate) + Making charge (incl. American diamond/CZ) = Subtotal; 3% GST on subtotal; Final = Subtotal + GST.
          </p>
          <p className="mt-3 text-sm text-stone-600">No wastage.</p>
        </aside>
      </div>
    </div>
  );
}
