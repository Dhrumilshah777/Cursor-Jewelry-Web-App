'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { apiPost } from '@/lib/api';

type BulkFailure = { index: number; sku?: string; error: string };
type BulkResponse<TCreated = unknown> = {
  ok: boolean;
  total: number;
  createdCount: number;
  failedCount: number;
  created: TCreated[];
  failures: BulkFailure[];
};

const EXAMPLE = [
  {
    sku: 'RING-000123',
    name: 'Diamond Ring',
    category: 'Rings',
    image: 'https://ik.imagekit.io/dqel2bwws/Jewelry%20Images/Workwear_new.jpg?updatedAt=1773681593941',
    subImages: [],
    stock: 1,
    active: true,
    goldPurity: '18K',
    netWeight: 3.2,
    makingChargeType: 'percentage',
    makingChargeValue: 10,
    description: 'Optional description',
    ringSize: '8',
    colors: ['#D4AF37'],
    homeSections: ['latestBeauty'],
  },
];

export default function AdminBulkProductsPage() {
  const [text, setText] = useState<string>(JSON.stringify(EXAMPLE, null, 2));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BulkResponse | null>(null);

  const parsed = useMemo(() => {
    try {
      const v = JSON.parse(text);
      if (Array.isArray(v)) return { ok: true as const, value: v };
      if (v && typeof v === 'object' && Array.isArray((v as any).products)) return { ok: true as const, value: (v as any).products };
      return { ok: false as const, error: 'JSON must be an array of products, or { "products": [...] }' };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : 'Invalid JSON' };
    }
  }, [text]);

  const handleFile = async (file: File) => {
    const raw = await file.text();
    setText(raw);
  };

  const submit = async () => {
    setError('');
    setResult(null);

    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.value.length === 0) {
      setError('No products found in JSON.');
      return;
    }

    const count = parsed.value.length;
    const ok = window.confirm(
      `Confirm bulk upload?\n\nYou are about to upload ${count} product${count === 1 ? '' : 's'}.\n\nExisting SKUs will be rejected, and valid rows will still be created.`
    );
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await apiPost<BulkResponse>('/api/admin/products/bulk', { products: parsed.value }, true);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">Bulk upload products</h1>
          <p className="mt-1 text-stone-600">
            Paste a JSON array of products and upload in one go. Existing SKUs will be rejected, and valid rows will still be created.
          </p>
        </div>
        <Link href="/admin/products" className="text-sm font-medium text-charcoal underline hover:no-underline">
          ← Back to products
        </Link>
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium text-charcoal">Products JSON</h2>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
              Upload .json file
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f).catch(() => {});
                  e.target.value = '';
                }}
                disabled={submitting}
              />
            </label>
            <button
              type="button"
              onClick={() => setText(JSON.stringify(EXAMPLE, null, 2))}
              className="rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50"
              disabled={submitting}
            >
              Reset example
            </button>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={18}
          spellCheck={false}
          className="mt-4 w-full rounded border border-stone-300 px-3 py-2 font-mono text-xs text-stone-800"
        />

        {!parsed.ok && (
          <p className="mt-2 text-sm text-amber-700">
            {parsed.error}
          </p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !parsed.ok}
            className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {submitting ? 'Uploading…' : 'Upload products'}
          </button>
          <p className="text-xs text-stone-500">
            Tip: Keep `sku`, `name`, `image`, `goldPurity` (14K/18K/22K/24K) and `netWeight` on every row. Images must be ImageKit URLs.
          </p>
        </div>
      </div>

      {result && (
        <section className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium text-charcoal">Result</h2>
            <p className="text-sm text-stone-600">
              Total: <span className="font-medium text-charcoal">{result.total}</span> · Created:{' '}
              <span className="font-medium text-charcoal">{result.createdCount}</span> · Failed:{' '}
              <span className="font-medium text-charcoal">{result.failedCount}</span>
            </p>
          </div>

          {result.failures?.length > 0 ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-600">
                    <th className="py-2 pr-4 font-medium">Row</th>
                    <th className="py-2 pr-4 font-medium">SKU</th>
                    <th className="py-2 pr-4 font-medium">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failures.map((f, i) => (
                    <tr key={`${f.index}-${i}`} className="border-b border-stone-100 align-top">
                      <td className="py-2 pr-4 text-stone-700">{f.index}</td>
                      <td className="py-2 pr-4 font-mono text-xs text-stone-700">{f.sku || '—'}</td>
                      <td className="py-2 pr-4 text-stone-700">{f.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-stone-500">
                Note: Row index is 0-based (first item is index 0).
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-stone-600">No failures.</p>
          )}
        </section>
      )}
    </div>
  );
}

