'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

export default function AdminHomePageImagePage() {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const data = await apiGet<{ image?: string }>('/api/admin/home-page-image', true);
      setImageUrl((data?.image ?? '').trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      setImageUrl(url);
      setError('');
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
      await apiPut('/api/admin/home-page-image', { image: imageUrl }, true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading…</p>;

  const previewSrc = imageUrl ? (imageUrl.startsWith('http') ? imageUrl : assetUrl(imageUrl)) : '';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Home Page Image Section</h1>
      <p className="mt-1 text-stone-600">Set the full-width image shown in the image-only section on the home page. If empty, the section is hidden.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-main p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-stone-700">Image URL or upload</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="https://… or /uploads/…"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="min-w-[200px] flex-1 rounded border border-stone-300 px-3 py-2"
            />
            <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
              Upload image
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
        {previewSrc && (
          <div className="mt-4">
            <p className="text-sm text-stone-600">Preview:</p>
            <img src={previewSrc} alt="" className="mt-2 max-h-64 w-full rounded border border-stone-200 object-contain" />
          </div>
        )}
        <button type="submit" disabled={saving} className="mt-6 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream hover:bg-accent/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save image'}
        </button>
      </form>
    </div>
  );
}
