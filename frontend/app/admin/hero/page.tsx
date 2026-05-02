'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

type HeroSlide = {
  _id?: string;
  image?: string;
  video?: string;
  title?: string[];
  subtitle?: string;
  cta?: string;
  ctaHref?: string;
  order?: number;
};

const defaultSlide: HeroSlide = {
  image: '',
  video: '',
  order: 0,
};

export default function AdminHeroPage() {
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<HeroSlide[]>('/api/admin/hero', true);
      setSlides(Array.isArray(list) ? list : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hero slides');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateSlide = (index: number, updates: Partial<HeroSlide>) => {
    setSlides((s) => {
      const next = [...s];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const addSlide = () => {
    setSlides((s) => [...s, { ...defaultSlide, order: s.length }]);
  };

  const removeSlide = async (index: number) => {
    if (!confirm('Remove this slide?')) return;
    const nextSlides = slides.filter((_, i) => i !== index);
    setSlides(nextSlides);
    setSaving(true);
    setError('');
    try {
      const payload = nextSlides.map((s, i) => ({
        image: s.image || '',
        video: s.video || '',
        order: i,
      }));
      await apiPut('/api/admin/hero', payload, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove slide');
      setSlides(slides);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (slideIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      updateSlide(slideIndex, { image: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const handleVideoUpload = async (slideIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { url } = await uploadFile(file);
      updateSlide(slideIndex, { video: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = slides.map((s, i) => ({
        image: s.image || '',
        video: s.video || '',
        order: i,
      }));
      await apiPut('/api/admin/hero', payload, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading hero slides…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Hero Sliders</h1>
      <p className="mt-1 text-stone-600">Manage the hero section slides (images and optional video only).</p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 space-y-8">
        {slides.map((slide, index) => (
          <div key={index} className="rounded-lg border border-stone-200 bg-main p-6 shadow-sm">
            <h2 className="font-medium text-charcoal">Slide {index + 1}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-stone-700">Background image (or poster for video)</label>
                <div className="mt-1 flex gap-2">
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(index, e)} className="text-sm" />
                  <input
                    type="url"
                    placeholder="Or URL"
                    value={slide.image || ''}
                    onChange={(e) => updateSlide(index, { image: e.target.value })}
                    className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
                {slide.image && (
                  <img src={slide.image.startsWith('http') ? slide.image : assetUrl(slide.image)} alt="" className="mt-2 h-24 w-40 rounded object-cover" />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700">Video (optional)</label>
                <div className="mt-1 flex gap-2">
                  <input type="file" accept="video/*" onChange={(e) => handleVideoUpload(index, e)} className="text-sm" />
                  <input
                    type="url"
                    placeholder="Or URL"
                    value={slide.video || ''}
                    onChange={(e) => updateSlide(index, { video: e.target.value })}
                    className="flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeSlide(index)}
              className="mt-4 text-sm text-red-600 hover:underline"
            >
              Remove slide
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <button type="button" onClick={addSlide} className="rounded border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50">
          + Add slide
        </button>
        <button type="button" onClick={save} disabled={saving} className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-cream hover:bg-accent/90 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save all slides'}
        </button>
      </div>
    </div>
  );
}
