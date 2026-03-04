'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

export default function AdminBeautyInMotionPage() {
  const [videos, setVideos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  const load = async () => {
    try {
      setError('');
      const data = await apiGet<{ videos: string[] }>('/api/admin/beauty-in-motion', true);
      setVideos(Array.isArray(data?.videos) ? data.videos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addUrl = () => {
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    setVideos((prev) => [...prev, trimmed]);
    setNewUrl('');
  };

  const changeUrlAt = (index: number, value: string) => {
    setVideos((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const removeAt = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      setVideos((prev) => [...prev, url]);
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
      await apiPut('/api/admin/beauty-in-motion', { videos }, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Beauty in Motion</h1>
      <p className="mt-1 text-stone-600">Videos shown in the horizontal strip (autoplay, loop). Use ImageKit.io video URLs or your own. You can add, change, and delete videos below.</p>
      <p className="mt-2 text-sm text-stone-500">Paste the video URL from ImageKit.io (Media Library → copy URL) or any direct video link. Order = left to right on the site.</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium text-stone-700">Add video:</label>
          <input
            type="url"
            placeholder="ImageKit.io URL or https://…"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUrl())}
            className="min-w-[240px] flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
          />
          <button type="button" onClick={addUrl} className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Add video
          </button>
          <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Upload video
            <input type="file" accept="video/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <ul className="mt-8 space-y-4">
          {videos.map((url, i) => (
            <li key={`video-${i}`} className="flex flex-col gap-2 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-medium text-stone-500 w-8">#{i + 1}</span>
              <div className="h-20 w-28 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                <video
                  src={url.startsWith('http') ? url : assetUrl(url)}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => changeUrlAt(i, e.target.value)}
                placeholder="ImageKit or video URL"
                className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
              />
              <button type="button" onClick={() => removeAt(i)} className="self-start rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 sm:self-center">
                Delete
              </button>
            </li>
          ))}
        </ul>
        {videos.length === 0 && <p className="mt-6 text-sm text-stone-500">No videos yet. Add an ImageKit.io video URL above (or upload), then click Save.</p>}

        <button type="submit" disabled={saving} className="mt-8 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
