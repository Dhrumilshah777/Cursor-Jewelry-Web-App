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
      const data = await apiGet<{ videos?: string[] }>('/api/admin/beauty-in-motion', true);
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

  const addVideo = (url: string) => {
    const u = url.trim();
    if (!u) return;
    setVideos((prev) => [...prev, u]);
    setNewUrl('');
    setError('');
  };

  const removeAt = (index: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    setVideos((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (index >= videos.length - 1) return;
    setVideos((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      addVideo(url);
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
      <h1 className="text-2xl font-semibold text-charcoal">Beauty in Motion</h1>
      <p className="mt-1 text-stone-600">
        Add videos for the Beauty in Motion carousel on the home page. Same layout as Shop by Style, but each slide plays a video. Order is the carousel order.
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={save} className="mt-8 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-sm font-medium text-stone-700">Video URL</label>
            <input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://… or /uploads/…"
              className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
            />
          </div>
          <button type="button" onClick={() => addVideo(newUrl)} className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800">
            Add video
          </button>
          <label className="cursor-pointer rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
            Upload video
            <input type="file" accept="video/*" onChange={handleUpload} className="hidden" />
          </label>
        </div>

        <ul className="mt-8 space-y-4">
          {videos.map((url, i) => (
            <li key={i} className="flex flex-col gap-3 rounded border border-stone-200 p-4 sm:flex-row sm:items-center sm:gap-4">
              <div className="h-24 w-40 flex-shrink-0 overflow-hidden rounded bg-stone-100">
                <video
                  src={url.startsWith('http') ? url : assetUrl(url)}
                  className="h-full w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-stone-600">{url}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50">↑</button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === videos.length - 1} className="rounded border border-stone-300 px-3 py-2 text-sm disabled:opacity-50 hover:bg-stone-50">↓</button>
                <button type="button" onClick={() => removeAt(i)} className="rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">Remove</button>
              </div>
            </li>
          ))}
        </ul>

        {videos.length === 0 && (
          <p className="mt-6 text-sm text-stone-500">No videos yet. Add a video URL or upload above.</p>
        )}

        <button type="submit" disabled={saving} className="mt-8 rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
