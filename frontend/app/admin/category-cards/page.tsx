'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

type CategoryCard = {
  image: string;
  title: string;
  description: string;
  link: string;
};

const defaultCard: CategoryCard = {
  image: '',
  title: '',
  description: '',
  link: '/products',
};

export default function AdminCategoryCardsPage() {
  const [cards, setCards] = useState<CategoryCard[]>([{ ...defaultCard }, { ...defaultCard }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<CategoryCard[]>('/api/admin/category-cards', true);
      const arr = Array.isArray(list) ? list : [];
      setCards([arr[0] || { ...defaultCard }, arr[1] || { ...defaultCard }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load category cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateCard = (index: number, updates: Partial<CategoryCard>) => {
    setCards((s) => {
      const next = [...s];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError('');
      const { url } = await uploadFile(file);
      updateCard(index, { image: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await apiPut('/api/admin/category-cards', cards, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading category cards…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Category Cards</h1>
      <p className="mt-1 text-stone-600">
        Edit the two featured cards that appear below the hero (images, titles, descriptions, and &quot;Discover More&quot; links).
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {cards.map((card, index) => (
          <div key={index} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-medium text-charcoal">Card {index + 1}</h2>

            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700">Background image</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(index, e)}
                  className="text-sm"
                />
                <input
                  type="url"
                  placeholder="Or paste image URL"
                  value={card.image || ''}
                  onChange={(e) => updateCard(index, { image: e.target.value })}
                  className="min-w-0 flex-1 rounded border border-stone-300 px-3 py-2 text-sm"
                />
              </div>
              {card.image && (
                <img
                  src={card.image.startsWith('http') ? card.image : assetUrl(card.image)}
                  alt=""
                  className="mt-2 h-32 w-full max-w-xs rounded object-cover"
                />
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700">Title</label>
              <input
                value={card.title || ''}
                onChange={(e) => updateCard(index, { title: e.target.value })}
                placeholder="e.g. Moissanite"
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-stone-700">Description</label>
              <textarea
                value={card.description || ''}
                onChange={(e) => updateCard(index, { description: e.target.value })}
                placeholder="e.g. Browse our best collection of brilliant and durable moissanite jewelry."
                rows={3}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-stone-700">Discover More link</label>
              <input
                value={card.link || ''}
                onChange={(e) => updateCard(index, { link: e.target.value })}
                placeholder="/products"
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save category cards'}
        </button>
      </div>
    </div>
  );
}
