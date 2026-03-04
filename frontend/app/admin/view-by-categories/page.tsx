'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

type CategoryItem = { _id?: string; name: string; image: string; slug: string; order?: number };

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '') || 'category';
}

export default function AdminViewByCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newImage, setNewImage] = useState('');

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<CategoryItem[]>('/api/admin/view-by-categories', true);
      setCategories(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addCategory = () => {
    const name = newName.trim() || 'Category';
    const image = newImage.trim();
    if (!image) {
      setError('Image URL or upload is required.');
      return;
    }
    setCategories((prev) => [
      ...prev,
      { name, image, slug: slugFromName(name) },
    ]);
    setNewName('');
    setNewImage('');
    setError('');
  };

  const updateAt = (index: number, field: 'name' | 'image' | 'slug', value: string) => {
    setCategories((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'name') next[index].slug = slugFromName(value);
      return next;
    });
  };

  const removeAt = (index: number) => {
    setCategories((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      if (index !== undefined) updateAt(index, 'image', url);
      else setNewImage(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPut(
        '/api/admin/view-by-categories',
        { categories: categories.map((c, i) => ({ name: c.name, image: c.image, slug: c.slug || slugFromName(c.name), order: i })) },
        true
      );
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
      <h1 className="text-2xl font-semibold text-charcoal">View by Categories</h1>
      <p className="mt-1 text-stone-600">Manage the categories shown in the &quot;View by categories&quot; section on the home page. Each category has a name and image; the link goes to products filtered by that category.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Earrings"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="min-w-[180px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Image URL</label>
            <input
              type="url"
              value={newImage}
              onChange={(e) => setNewImage(e.target.value)}
              placeholder="/uploads/… or https://…"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Upload image
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e)} className="hidden" />
          </label>
          <button type="button" onClick={addCategory} className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            Add category
          </button>
        </div>

        <ul className="mt-8 space-y-4">
          {categories.map((cat, i) => (
            <li key={cat._id || i} className="flex flex-col gap-3 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                <img
                  src={cat.image.startsWith('http') ? cat.image : assetUrl(cat.image)}
                  alt={cat.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => updateAt(i, 'name', e.target.value)}
                  placeholder="Category name"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="url"
                  value={cat.image}
                  onChange={(e) => updateAt(i, 'image', e.target.value)}
                  placeholder="Image URL"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-stone-500">Link: /products?category={cat.slug || slugFromName(cat.name)}</p>
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
                  Change image
                  <input type="file" accept="image/*" onChange={(e) => handleUpload(e, i)} className="hidden" />
                </label>
                <button type="button" onClick={() => removeAt(i)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
        {categories.length === 0 && <p className="mt-6 text-sm text-stone-500">No categories yet. Add one above; they will appear in the &quot;View by categories&quot; section.</p>}

        <button type="submit" disabled={saving} className="mt-8 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
