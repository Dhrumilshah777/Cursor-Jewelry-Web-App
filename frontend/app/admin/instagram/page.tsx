'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, uploadFiles, assetUrl } from '@/lib/api';

type InstagramImage = { src: string; alt?: string };

export default function AdminInstagramPage() {
  const [images, setImages] = useState<InstagramImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<InstagramImage[]>('/api/admin/instagram', true);
      setImages(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load Instagram images');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateImage = (index: number, updates: Partial<InstagramImage>) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const remove = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const addUrl = () => {
    setImages((prev) => [...prev, { src: '', alt: 'Instagram' }]);
  };

  const handleSingleUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      updateImage(index, { src: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    try {
      const { urls } = await uploadFiles(Array.from(files));
      setImages((prev) => [...prev, ...urls.map((src) => ({ src, alt: 'Instagram' }))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = images.map((img) => ({ src: img.src, alt: img.alt || 'Instagram' })).filter((img) => img.src.trim());
      await apiPut('/api/admin/instagram', payload, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading Instagram images…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Instagram Section</h1>
      <p className="mt-1 text-stone-600">Manage images shown in the Instagram section on the home page.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-6 flex flex-wrap gap-4">
        <button type="button" onClick={addUrl} className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
          + Add by URL
        </button>
        <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
          Upload multiple images
          <input type="file" accept="image/*" multiple onChange={handleMultipleUpload} className="hidden" />
        </label>
        <button type="button" onClick={save} disabled={saving} className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save order & images'}
        </button>
      </div>

      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, index) => (
          <li key={index} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded bg-stone-100">
              {img.src ? (
                <img
                  src={img.src.startsWith('http') ? img.src : assetUrl(img.src)}
                  alt={img.alt || ''}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-stone-400">No image</div>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="url"
                placeholder="Image URL"
                value={img.src}
                onChange={(e) => updateImage(index, { src: e.target.value })}
                className="min-w-0 flex-1 rounded border border-stone-300 px-2 py-1 text-sm"
              />
              <label className="cursor-pointer rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-50">
                Upload
                <input type="file" accept="image/*" onChange={(e) => handleSingleUpload(index, e)} className="hidden" />
              </label>
              <button type="button" onClick={() => remove(index)} className="text-red-600 hover:underline">
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
      {images.length === 0 && !loading && <p className="mt-4 text-stone-500">No images. Add by URL or upload.</p>}
    </div>
  );
}
