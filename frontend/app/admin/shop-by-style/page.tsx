'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

type Slide = { image: string; label: string; link: string };

export default function AdminShopByStylePage() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newLink, setNewLink] = useState('/products');

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<Slide[]>('/api/admin/shop-by-style', true);
      setSlides(Array.isArray(list) ? list.map((s) => ({ image: s.image || '', label: s.label || '', link: s.link || '/products' })) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addSlide = () => {
    const image = newImage.trim();
    if (!image) {
      setError('Image is required.');
      return;
    }
    setSlides((prev) => [...prev, { image, label: newLabel.trim() || 'Style', link: newLink.trim() || '/products' }]);
    setNewImage('');
    setNewLabel('');
    setNewLink('/products');
    setError('');
  };

  const updateAt = (index: number, field: 'image' | 'label' | 'link', value: string) => {
    setSlides((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeAt = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= slides.length - 1) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
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
        '/api/admin/shop-by-style',
        { slides: slides.map((s) => ({ image: s.image, label: s.label, link: s.link || '/products' })) },
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
      <h1 className="text-2xl font-semibold text-charcoal">Shop by Style</h1>
      <p className="mt-1 text-stone-600">
        Manage the &quot;Shop by Style&quot; carousel on the home page. Each slide has an image, a label (e.g. OFFICE WEAR, DAILY WEAR), and an optional link.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[140px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. DAILY WEAR"
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
          <div className="min-w-[140px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Link</label>
            <input
              type="text"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="/products"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Upload image
            <input type="file" accept="image/*" onChange={(e) => handleUpload(e)} className="hidden" />
          </label>
          <button type="button" onClick={addSlide} className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream hover:bg-accent/90">
            Add slide
          </button>
        </div>

        <ul className="mt-8 space-y-4">
          {slides.map((slide, i) => (
            <li key={i} className="flex flex-col gap-3 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-24 w-32 flex-shrink-0 overflow-hidden rounded-lg bg-stone-100">
                <img
                  src={slide.image.startsWith('http') ? slide.image : assetUrl(slide.image)}
                  alt={slide.label}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <input
                  type="text"
                  value={slide.label}
                  onChange={(e) => updateAt(i, 'label', e.target.value)}
                  placeholder="Label (e.g. OFFICE WEAR)"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={slide.link}
                  onChange={(e) => updateAt(i, 'link', e.target.value)}
                  placeholder="Link"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="url"
                  value={slide.image}
                  onChange={(e) => updateAt(i, 'image', e.target.value)}
                  placeholder="Image URL"
                  className="w-full rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded border border-stone-300 px-3 py-2 text-sm hover:bg-stone-50">
                  Change image
                  <input type="file" accept="image/*" onChange={(e) => handleUpload(e, i)} className="hidden" />
                </label>
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50">↑</button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === slides.length - 1} className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50">↓</button>
                <button type="button" onClick={() => removeAt(i)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Remove</button>
              </div>
            </li>
          ))}
        </ul>

        {slides.length === 0 && (
          <p className="mt-6 text-sm text-stone-500">No slides yet. Add one above; they will appear in the Shop by Style carousel.</p>
        )}

        <button type="submit" disabled={saving} className="mt-8 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream hover:bg-accent/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
