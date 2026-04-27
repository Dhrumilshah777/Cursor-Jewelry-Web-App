'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiPut, assetUrl } from '@/lib/api';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: string;
  image: string;
};

type ProductsResponse = { products: Product[] };
type BestSellingResponse = { productIds: string[] };

export default function AdminBestSellingPage() {
  const [productIds, setProductIds] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setError('');
      const [idsRes, productsRes] = await Promise.all([
        apiGet<BestSellingResponse>('/api/admin/best-selling', true),
        apiGet<ProductsResponse>('/api/products'),
      ]);
      setProductIds(Array.isArray(idsRes?.productIds) ? idsRes.productIds : []);
      const list = (productsRes as ProductsResponse)?.products;
      setAllProducts(Array.isArray(list) ? list : []);
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
  const unselectedProducts = allProducts.filter((p) => !productIds.includes(p._id));

  const toggleProduct = (id: string, checked: boolean) => {
    if (checked) {
      setProductIds((prev) => [...prev, id]);
    } else {
      setProductIds((prev) => prev.filter((x) => x !== id));
    }
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
        The list below shows the same products that appear on the public <strong>/products</strong> page. Tick the products you want in the &quot;Our Best Selling Jewelery&quot; carousel, then click <strong>Save changes</strong>. Order of ticked items is the carousel order (use ↑ ↓ to reorder).
      </p>
      <p className="mt-2 text-sm text-stone-500">
        To add new products to the site (so they appear here and on /products), go to{' '}
        <Link href="/admin/products" className="font-medium text-charcoal underline hover:no-underline">
          Latest Beauty Products
        </Link>{' '}
        in the sidebar — there you can create, edit, and manage all products.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <ul className="space-y-3">
          {selectedProducts.map((product, i) => (
            <li
              key={product._id}
              className="flex flex-col gap-3 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4"
            >
              <div className="flex flex-1 items-center gap-4">
                <input
                  type="checkbox"
                  checked
                  onChange={(e) => toggleProduct(product._id, e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-charcoal"
                  aria-label={`Remove ${product.name} from best selling`}
                />
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
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => moveUp(i)}
                  disabled={i === 0}
                  className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveDown(i)}
                  disabled={i === selectedProducts.length - 1}
                  className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50"
                  title="Move down"
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
          {unselectedProducts.map((product) => (
            <li
              key={product._id}
              className="flex items-center gap-4 rounded border border-stone-100 p-4"
            >
              <input
                type="checkbox"
                checked={false}
                onChange={(e) => toggleProduct(product._id, e.target.checked)}
                className="h-4 w-4 rounded border-stone-300 text-charcoal"
                aria-label={`Add ${product.name} to best selling`}
              />
              <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded bg-stone-100">
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
            </li>
          ))}
        </ul>

        {allProducts.length === 0 && (
          <p className="mt-6 text-sm text-stone-500">
            No products on the site yet. Add products in{' '}
            <Link href="/admin/products" className="text-charcoal underline hover:no-underline">Latest Beauty Products</Link>{' '}
            first; they will then appear here and on the public /products page.
          </p>
        )}

        <button
          type="submit"
          disabled={saving || allProducts.length === 0}
          className="mt-8 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream hover:bg-accent/90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
