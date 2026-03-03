'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';

type GoldRateRow = { purity: string; pricePerGram: number; updatedAt: string | null };

export default function AdminGoldRatesPage() {
  const [rates, setRates] = useState<GoldRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({ '18K': '', '22K': '', '24K': '' });

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<GoldRateRow[]>('/api/admin/gold-rates', true);
      setRates(Array.isArray(list) ? list : []);
      const next: Record<string, string> = { '18K': '', '22K': '', '24K': '' };
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
    try {
      await apiPut(
        '/api/admin/gold-rates',
        {
          rates: [
            { purity: '18K', pricePerGram: parseFloat(inputs['18K']) || 0 },
            { purity: '22K', pricePerGram: parseFloat(inputs['22K']) || 0 },
            { purity: '24K', pricePerGram: parseFloat(inputs['24K']) || 0 },
          ],
        },
        true
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading gold rates…</p>;

  const purityLabels: Record<string, string> = {
    '18K': '18 Karat',
    '22K': '22 Karat',
    '24K': '24 Karat (24 KT)',
  };

  const handleNumberInput = (purity: '18K' | '22K' | '24K', value: string) => {
    const filtered = value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setInputs((prev) => ({ ...prev, [purity]: filtered }));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Gold Rates</h1>
      <p className="mt-1 text-stone-600">Set price per gram for 24 KT, 22K, and 18K. Used to calculate product prices when Gold-based pricing is enabled. Update when market rates change.</p>

      <div className="mt-8 max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-medium text-stone-500">Price per gram (₹/gm) — 24 KT, 22K, 18K</h2>
        {(['18K', '22K', '24K'] as const).map((purity) => (
          <div key={purity} className="flex flex-col gap-1 py-3 border-b border-stone-100 last:border-0 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <span className="w-12 font-medium text-charcoal">{purity}</span>
              <span className="text-xs text-stone-500">({purityLabels[purity]})</span>
            </div>
            <div className="flex flex-1 items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={inputs[purity] ?? ''}
                onChange={(e) => handleNumberInput(purity, e.target.value)}
                placeholder={purity === '24K' ? 'Add 24 KT price…' : `₹ per gram`}
                className="flex-1 rounded border border-stone-300 px-3 py-2"
                aria-label={`${purity} gold price per gram`}
              />
              <span className="text-stone-500 text-sm whitespace-nowrap">₹/gm</span>
            </div>
          </div>
        ))}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="mt-6 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save rates'}
        </button>
      </div>

      <p className="mt-6 text-sm text-stone-500">
        Product final price = (net weight × rate) + wastage % + making charges, then + 3% GST. Ensure rates are set before adding gold-priced products.
      </p>
    </div>
  );
}
