'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, uploadFile, assetUrl } from '@/lib/api';

const CATEGORY_OPTIONS = ['Earrings', 'Necklaces', 'Bracelets', 'Rings', 'Accessories', 'Accessories / Beauty bracelets'];
const CARAT_OPTIONS = ['14kt', '18kt', '22kt', '24kt'];

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  weight?: string;
  carat?: string;
  colors?: string[];
  order?: number;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<Product>>({ name: '', category: 'Accessories', price: '', image: '', weight: '', carat: '', colors: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<Product[]>('/api/admin/products', true);
      setProducts(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.price?.trim() || !form.image?.trim()) {
      setError('Name, price, and image are required.');
      return;
    }
    setError('');
    try {
      if (editingId) {
        await apiPut(`/api/admin/products/${editingId}`, form, true);
        setEditingId(null);
      } else {
        await apiPost('/api/admin/products', form, true);
      }
      setForm({ name: '', category: 'Accessories', price: '', image: '', weight: '', carat: '', colors: [] });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this product?')) return;
    try {
      await apiDelete(`/api/admin/products/${id}`, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const addColor = () => {
    setForm((f) => ({ ...f, colors: [...(f.colors || []), '#D4AF37'] }));
  };
  const removeColor = (i: number) => {
    setForm((f) => ({ ...f, colors: (f.colors || []).filter((_, j) => j !== i) }));
  };
  const changeColor = (i: number, v: string) => {
    setForm((f) => {
      const c = [...(f.colors || [])];
      c[i] = v;
      return { ...f, colors: c };
    });
  };

  if (loading) return <p className="text-stone-500">Loading products…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Latest Beauty Products</h1>
      <p className="mt-1 text-stone-600">Add or edit products shown in the Latest Beauty section.</p>

      <form onSubmit={saveProduct} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-medium text-charcoal">{editingId ? 'Edit product' : 'Add product'}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700">Name</label>
            <input
              value={form.name || ''}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Category</label>
            <select
              value={form.category || 'Accessories'}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Price (e.g. 52.00)</label>
            <input
              value={form.price || ''}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Image</label>
            <div className="mt-1 flex gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="text-sm text-stone-600"
                disabled={uploading}
              />
              <input
                type="url"
                placeholder="Or paste URL"
                value={form.image || ''}
                onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
            {form.image && (
              <img src={form.image.startsWith('http') ? form.image : assetUrl(form.image)} alt="" className="mt-2 h-20 w-20 rounded object-cover" />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Weight</label>
            <input
              value={form.weight || ''}
              onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
              placeholder="e.g. 2.5 g"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Carat</label>
            <select
              value={form.carat || ''}
              onChange={(e) => setForm((f) => ({ ...f, carat: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              <option value="">Select carat</option>
              {CARAT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-stone-700">Colors (hex)</span>
            <button type="button" onClick={addColor} className="text-sm text-stone-500 hover:text-charcoal">
              + Add
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(form.colors || []).map((color, i) => (
              <span key={i} className="flex items-center gap-1">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => changeColor(i, e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded border border-stone-300"
                />
                <button type="button" onClick={() => removeColor(i)} className="text-stone-400 hover:text-red-600">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="submit" className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            {editingId ? 'Update' : 'Add'} product
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', category: 'Accessories', price: '', image: '', weight: '', carat: '', colors: [] }); }} className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="mt-8 space-y-4">
        {products.map((p) => (
          <li key={p._id} className="flex items-center gap-4 rounded-lg border border-stone-200 bg-white p-4">
            <img src={p.image.startsWith('http') ? p.image : assetUrl(p.image)} alt="" className="h-16 w-16 rounded object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-charcoal">{p.name}</p>
              <p className="text-sm text-stone-500">{p.category} · {p.price}${p.weight ? ` · ${p.weight}` : ''}{p.carat ? ` · ${p.carat}` : ''}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setForm({ ...p }); setEditingId(p._id); setError(''); }}
                className="rounded border border-stone-300 px-3 py-1 text-sm hover:bg-stone-50"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => remove(p._id)}
                className="rounded border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {products.length === 0 && !loading && <p className="mt-4 text-stone-500">No products yet. Add one above.</p>}
    </div>
  );
}
