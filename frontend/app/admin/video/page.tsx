'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

export default function AdminVideoPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const data = await apiGet<{ homeVideoUrl: string }>('/api/admin/video', true);
      setUrl(data?.homeVideoUrl ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load video URL');
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
      const { url: uploadedUrl } = await uploadFile(file);
      setUrl(uploadedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiPut('/api/admin/video', { homeVideoUrl: url }, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading…</p>;

  const videoSrc = url ? (url.startsWith('http') ? url : assetUrl(url)) : '';

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Home Page Video</h1>
      <p className="mt-1 text-stone-600">Set the full-width video shown on the home page.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-stone-700">Video URL or upload</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="https://… or /uploads/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="min-w-[200px] flex-1 rounded border border-stone-300 px-3 py-2"
            />
            <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
              Upload video
              <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        </div>
        {videoSrc && (
          <div className="mt-4">
            <p className="text-sm text-stone-600">Preview:</p>
            <video src={videoSrc} controls className="mt-2 max-h-48 w-full rounded border border-stone-200 object-contain" />
          </div>
        )}
        <button type="submit" disabled={saving} className="mt-6 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save video'}
        </button>
      </form>
    </div>
  );
}
