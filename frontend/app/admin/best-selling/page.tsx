'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

type BestSellingResponse = { productIds: string[] };

export default function AdminBestSellingPage() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addId, setAddId] = useState('');

  const load = async () => {
    try {
      setError('');
      const [idsRes, productsRes] = await Promise.all([
        apiGet<BestSellingResponse>('/api/admin/best-selling', true),
        apiGet<Product[]>('/api/admin/products', true),
      ]);
      setProductIds(Array.isArray(idsRes?.productIds) ? idsRes.productIds : []);
      setAllProducts(Array.isArray(productsRes) ? productsRes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedProducts = productIds
    .map((id) => allProducts.find((p) => p._id === id))
    .filter(Boolean) as Product[];
  const availableToAdd = allProducts.filter((p) => !productIds.includes(p._id));

  const addProduct = (id: string) => {
    if (!id || productIds.includes(id)) return;
    setProductIds((prev) => [...prev, id]);
    setAddId('');
  };
  const handleAddSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v) addProduct(v);
  };

  const removeAt = (index: number) => {
    setProductIds((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setProductIds((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= productIds.length - 1) return;
    setProductIds((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPut('/api/admin/best-selling', { productIds }, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Best Selling Jewelery</h1>
      <p className="mt-1 text-stone-600">
        Choose and order the products shown in the &quot;Our Best Selling Jewelery&quot; carousel on the home page. Desktop shows 4 per row; mobile shows 2 columns × 2 rows per slide.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Add product</label>
            <select
              value={addId}
              onChange={handleAddSelect}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            >
              <option value="">Select a product…</option>
              {availableToAdd.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — ₹{p.price}
                </option>
              ))}
            </select>
          </div>
          {availableToAdd.length === 0 && productIds.length > 0 && (
            <p className="text-sm text-stone-500">All products are already in the list.</p>
          )}
        </div>

        <ul className="mt-8 space-y-4">
          {selectedProducts.map((product, i) => (
            <li
              key={product._id}
              className="flex flex-col gap-3 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                <img
                  src={product.image?.startsWith('http') ? product.image : assetUrl(product.image)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-charcoal">{product.name}</p>
                <p className="text-sm text-stone-500">{product.category} — ₹{product.price}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === selectedProducts.length - 1}
                  className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>

        {productIds.length === 0 && (
          <p className="mt-6 text-sm text-stone-500">
            No products selected. Add products above; they will appear in the Best Selling Jewelery carousel on the home page.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-8 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
