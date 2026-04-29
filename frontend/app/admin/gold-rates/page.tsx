'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiGet, apiPut } from '@/lib/api';

type GoldRateRow = { purity: string; pricePerGram: number; updatedAt: string | null };

export default function AdminGoldRatesPage() {
  const [rates, setRates] = useState<GoldRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [inputs, setInputs] = useState<Record<string, string>>({ '14K': '', '18K': '', '22K': '', '24K': '' });
  const [initialInputs, setInitialInputs] = useState<Record<string, string>>({ '14K': '', '18K': '', '22K': '', '24K': '' });
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

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
      setInitialInputs(next);
      setLastLoadedAt(new Date().toISOString());
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

  const isDirty = useMemo(() => {
    const keys = ['14K', '18K', '22K', '24K'] as const;
    return keys.some((k) => String(inputs[k] ?? '') !== String(initialInputs[k] ?? ''));
  }, [initialInputs, inputs]);

  const hasAnyValue = useMemo(() => {
    const keys = ['14K', '18K', '22K', '24K'] as const;
    return keys.some((k) => (parseFloat(String(inputs[k] ?? '')) || 0) > 0);
  }, [inputs]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
            <h1 className="text-2xl font-semibold tracking-tight text-text">Gold Rates</h1>
            <p className="mt-1 text-sm leading-relaxed text-text-muted">
              Update gold price per gram for each purity. These rates are used in price breakup and gold-based pricing.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-muted">
              <span className="rounded-full border border-border bg-body px-2.5 py-1">
                Last refreshed: {lastLoadedAt ? formatUpdatedAt(lastLoadedAt) : '—'}
              </span>
              {isDirty && (
                <span className="rounded-full border border-border bg-body px-2.5 py-1 text-text">
                  Unsaved changes
                </span>
              )}
              {!hasAnyValue && !loading && (
                <span className="rounded-full border border-border bg-body px-2.5 py-1">
                  Tip: enter rates to enable gold pricing
                </span>
              )}
            </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading || saving}
            className="rounded border border-border bg-card px-4 py-2 text-sm font-medium text-text shadow-sm transition hover:bg-body disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !isDirty}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream shadow-sm transition hover:bg-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save rates'}
          </button>
        </div>
      </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-text">Price per gram</h2>
              <p className="mt-0.5 text-xs text-text-muted">₹/gm for each purity</p>
            </div>
            {loading && <span className="text-xs text-text-muted">Loading…</span>}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(['14K', '18K', '22K', '24K'] as const).map((purity) => (
              <div key={purity} className="rounded-lg border border-border bg-body/50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{purity}</p>
                    <p className="mt-0.5 text-sm font-medium text-text">{purityLabels[purity]}</p>
                    <p className="mt-1 text-xs text-text-muted">Last updated: {formatUpdatedAt(updatedAtByPurity[purity])}</p>
                  </div>
                  <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-text-muted">
                    ₹/gm
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center rounded border border-border bg-card px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
                    <span className="mr-2 text-sm text-text-muted">₹</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={inputs[purity] ?? ''}
                      onChange={(e) => handleNumberInput(purity, e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
                      aria-label={`${purity} gold price per gram`}
                    />
                  </div>
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
            <div className="mt-4 rounded border border-border bg-body px-4 py-3 text-sm text-text">
              {success}
            </div>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <h3 className="text-sm font-semibold text-text">How pricing uses these rates</h3>
          <p className="mt-2 text-sm text-text-muted">
            Gold value \(net weight × rate\) + making charge = subtotal. GST is applied on the subtotal. Final price = subtotal + GST.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-body p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Best practice</p>
            <ul className="mt-2 space-y-1 text-sm text-text-muted">
              <li>- Refresh once daily (or when market moves).</li>
              <li>- Keep 24K as the reference; others are derived in many markets.</li>
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputs(initialInputs);
              setSuccess('');
              setError('');
            }}
            disabled={!isDirty || saving}
            className="mt-4 w-full rounded border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-body disabled:opacity-50"
          >
            Reset changes
          </button>
        </aside>
      </div>
    </div>
  );
}
