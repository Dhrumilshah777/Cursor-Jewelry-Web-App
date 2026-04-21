'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete, uploadFile, assetUrl } from '@/lib/api';

const CATEGORY_OPTIONS = ['Earrings', 'Necklaces', 'Bracelets', 'Rings', 'Accessories', 'Accessories / Beauty bracelets'];
const GOLD_TYPE_OPTIONS = ['Yellow Gold', 'Rose Gold', 'White Gold'] as const;
const CARAT_OPTIONS = ['14kt', '18kt', '22kt', '24kt'];
const HOME_SECTION_OPTIONS = [
  { key: 'latestBeauty', label: 'Latest Beauty section' },
  { key: 'bestSelling', label: 'Best Selling carousel' },
  { key: 'viewByCategories', label: 'View by Categories' },
  { key: 'shopByStyle', label: 'Shop by Style' },
];

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
  subImages?: string[];
  weight?: string;
  carat?: string;
  colors?: string[];
  order?: number;
  active?: boolean;
  stock?: number;
  purchaseQuantity?: number;
  goldPurity?: string;
  netWeight?: number | null;
  makingChargeType?: 'percentage' | 'fixed';
  makingChargeValue?: number;
  description?: string;
  ringSize?: string;
  sku?: string;
  homeSections?: string[];
  goldType?: string;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<Partial<Product>>({
    name: '',
    category: 'Accessories',
    image: '',
    subImages: [],
    weight: '',
    carat: '',
    colors: [],
    active: true,
    stock: 1,
    purchaseQuantity: 1,
    goldPurity: '',
    netWeight: undefined,
    makingChargeType: 'percentage',
    makingChargeValue: 0,
    description: '',
    ringSize: '',
    sku: '',
    homeSections: [],
    goldType: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [subImageUrlInput, setSubImageUrlInput] = useState('');

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<{ products?: Product[] } | Product[]>('/api/admin/products', true);
      setProducts(Array.isArray(list) ? list : (list && 'products' in list ? list.products ?? [] : []));
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

  const handleSubImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadFile(file);
      setForm((f) => ({ ...f, subImages: [...(f.subImages || []), url] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
    e.target.value = '';
  };

  const addSubImageUrl = (url: string) => {
    const trimmed = url?.trim();
    if (!trimmed) return;
    setForm((f) => ({ ...f, subImages: [...(f.subImages || []), trimmed] }));
  };

  const removeSubImage = (index: number) => {
    setForm((f) => ({ ...f, subImages: (f.subImages || []).filter((_, i) => i !== index) }));
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const hasGold = ['14K', '18K', '22K', '24K'].includes((form.goldPurity || '').trim().toUpperCase()) && Number(form.netWeight) > 0;
    if (!form.name?.trim() || !form.image?.trim()) {
      setError('Name and image are required.');
      return;
    }
    if (!hasGold) {
      setError('Gold-based pricing is required. Select gold purity (14K, 18K, 22K, or 24K) and enter net weight in grams.');
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
      setForm({
        name: '',
        category: 'Accessories',
        image: '',
        subImages: [],
        weight: '',
        carat: '',
        colors: [],
        active: true,
        stock: 1,
        purchaseQuantity: 1,
        goldPurity: '',
        netWeight: undefined,
        makingChargeType: 'percentage',
        makingChargeValue: 0,
        description: '',
        ringSize: '',
        sku: '',
        homeSections: [],
        goldType: '',
      });
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-charcoal">Latest Beauty Products</h1>
          <p className="mt-1 text-stone-600">Add or edit products shown in the Latest Beauty section.</p>
        </div>
        <Link
          href="/admin/products/bulk"
          className="rounded border border-stone-300 px-3 py-2 text-sm font-medium text-charcoal hover:bg-stone-50"
        >
          Bulk upload →
        </Link>
      </div>

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
            <label className="block text-sm font-medium text-stone-700">Stock</label>
            <input
              type="number"
              min={0}
              value={form.stock ?? 1}
              onChange={(e) => setForm((f) => ({ ...f, stock: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
            <p className="mt-0.5 text-xs text-stone-500">At 0, product is out of stock until you increase it.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Purchase quantity (fixed)</label>
            <input
              type="number"
              min={1}
              value={form.purchaseQuantity ?? 1}
              onChange={(e) => setForm((f) => ({ ...f, purchaseQuantity: Math.max(1, parseInt(e.target.value, 10) || 1) }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            />
            <p className="mt-0.5 text-xs text-stone-500">Customers cannot change quantity; Add to cart always adds this amount.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Gold type</label>
            <select
              value={form.goldType || ''}
              onChange={(e) => setForm((f) => ({ ...f, goldType: e.target.value }))}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
            >
              <option value="">Select gold type</option>
              {GOLD_TYPE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {form.category === 'Rings' && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-stone-700">Ring size</label>
              <input
                type="text"
                value={form.ringSize ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, ringSize: e.target.value }))}
                placeholder="e.g. 8, 9, 10"
                className="mt-1 w-full max-w-md rounded border border-stone-300 px-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-stone-700">Homepage sections for this product image</p>
            <p className="mt-0.5 text-xs text-stone-500">
              Choose where this product&apos;s image can be used on the home page (e.g. Latest Beauty, Best Selling, Shop by Style).
            </p>
            <div className="mt-2 flex flex-wrap gap-4">
              {HOME_SECTION_OPTIONS.map((opt) => {
                const selected = (form.homeSections || []).includes(opt.key);
                return (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-stone-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-stone-300"
                      checked={selected}
                      onChange={(e) => {
                        const next = new Set(form.homeSections || []);
                        if (e.target.checked) next.add(opt.key);
                        else next.delete(opt.key);
                        setForm((f) => ({ ...f, homeSections: Array.from(next) }));
                      }}
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
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
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Sub images (extra gallery images)</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                type="url"
                placeholder="Paste image URL"
                value={subImageUrlInput}
                onChange={(e) => setSubImageUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubImageUrl(subImageUrlInput); setSubImageUrlInput(''); } }}
                className="rounded border border-stone-300 px-3 py-2 text-sm w-48"
              />
              <button type="button" onClick={() => { addSubImageUrl(subImageUrlInput); setSubImageUrlInput(''); }} className="rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
                Add URL
              </button>
              <label className="rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50 cursor-pointer">
                Upload image
                <input type="file" accept="image/*" onChange={handleSubImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            {(form.subImages && form.subImages.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {form.subImages.map((src, i) => (
                  <span key={i} className="relative inline-block">
                    <img src={src.startsWith('http') ? src : assetUrl(src)} alt="" className="h-16 w-16 rounded object-cover border border-stone-200" />
                    <button type="button" onClick={() => removeSubImage(i)} className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs leading-none hover:bg-red-600" aria-label="Remove">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-stone-700">Product details (description)</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Product description for the detail page"
              rows={4}
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Gross weight (optional)</label>
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
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="active"
              checked={form.active !== false}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-4 w-4 rounded border-stone-300"
            />
            <label htmlFor="active" className="text-sm font-medium text-stone-700">Active (visible and available to customers)</label>
          </div>
        </div>
        <div className="mt-6 border-t border-stone-200 pt-6">
          <h3 className="font-medium text-charcoal">Gold-based pricing</h3>
          <p className="mt-1 text-sm text-stone-500">Price is calculated from gold rates (14K, 18K, 22K, 24K). Gold value + making charge (incl. American diamond/CZ) → 3% GST.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-stone-700">Gold purity <span className="text-red-600">*</span></label>
              <select
                value={form.goldPurity || ''}
                onChange={(e) => setForm((f) => ({ ...f, goldPurity: e.target.value }))}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
                required
              >
                <option value="">Select purity</option>
                <option value="14K">14K (14 KT)</option>
                <option value="18K">18K</option>
                <option value="22K">22K</option>
                <option value="24K">24K</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Net weight (grams) <span className="text-red-600">*</span></label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.netWeight ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, netWeight: e.target.value === '' ? undefined : parseFloat(e.target.value) }))}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="e.g. 8.5"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Making charge type</label>
              <select
                value={form.makingChargeType || 'percentage'}
                onChange={(e) => setForm((f) => ({ ...f, makingChargeType: e.target.value as 'percentage' | 'fixed' }))}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700">Making charge value (% of gold value or ₹ fixed)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.makingChargeValue ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, makingChargeValue: parseFloat(e.target.value) || 0 }))}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <p className="mt-0.5 text-xs text-stone-500">American diamond (CZ) cost is included in making charge.</p>
            </div>
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
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({
                  name: '',
                  category: 'Accessories',
                  image: '',
                  subImages: [],
                  weight: '',
                  carat: '',
                  colors: [],
                  active: true,
                  stock: 1,
                  purchaseQuantity: 1,
                  goldPurity: '',
                  netWeight: undefined,
                  makingChargeType: 'percentage',
                  makingChargeValue: 0,
                  description: '',
                  ringSize: '',
                  sku: '',
                  homeSections: [],
                  goldType: '',
                });
                setSubImageUrlInput('');
              }}
              className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50"
            >
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
              <p className="text-sm text-stone-500">
                {p.category}
                {(p as Product).goldType ? ` · ${(p as Product).goldType}` : ''}
                {' · '}
                {p.price ? `₹${p.price}` : 'Gold-based'}
                {p.weight ? ` · ${p.weight}` : ''}
                {p.carat ? ` · ${p.carat}` : ''} · Stock: {p.stock ?? 0}
                {p.active === false ? ' · Inactive' : ''}
              </p>
              {Array.isArray((p as Product).homeSections) && (p as Product).homeSections!.length > 0 && (
                <p className="mt-1 text-xs text-stone-500">
                  Home: {(p as Product).homeSections!.map((key) => {
                    const opt = HOME_SECTION_OPTIONS.find((o) => o.key === key);
                    return opt ? opt.label : key;
                  }).join(', ')}
                </p>
              )}
              {(p.stock ?? 0) === 0 && (
                <span className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Out of stock</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm({
                    ...p,
                    subImages: p.subImages || [],
                    stock: p.stock ?? 1,
                    purchaseQuantity: (p as Product).purchaseQuantity ?? 1,
                    active: p.active !== false,
                    goldPurity: (p as Product).goldPurity ?? '',
                    netWeight: (p as Product).netWeight ?? undefined,
                    makingChargeType: (p as Product).makingChargeType ?? 'percentage',
                    makingChargeValue: (p as Product).makingChargeValue ?? 0,
                    description: (p as Product).description ?? '',
                    ringSize: (p as Product).ringSize ?? '',
                    sku: (p as Product).sku ?? '',
                    homeSections: (p as Product).homeSections ?? [],
                    goldType: (p as Product).goldType ?? '',
                  });
                  setEditingId(p._id);
                  setError('');
                  setSubImageUrlInput('');
                }}
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
