'use client';

import { useEffect, useState } from 'react';
import { apiGet, apiPut, uploadFile, assetUrl } from '@/lib/api';

type GiftCard = {
  title: string;
  href: string;
  image: string;
  imageAlt: string;
};

const defaultCard: GiftCard = {
  title: '',
  href: '/products',
  image: '',
  imageAlt: '',
};

export default function AdminGiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([{ ...defaultCard }, { ...defaultCard }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const list = await apiGet<GiftCard[]>('/api/admin/gift-cards', true);
      const arr = Array.isArray(list) ? list : [];
      setCards([arr[0] || { ...defaultCard }, arr[1] || { ...defaultCard }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gift cards');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateCard = (index: number, updates: Partial<GiftCard>) => {
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
      await apiPut('/api/admin/gift-cards', cards, true);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-stone-500">Loading gift cards…</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-charcoal">Gift Cards (Commitment Section)</h1>
      <p className="mt-1 text-stone-600">
        Edit the two cards below &quot;Our Commitment to Excellence&quot;: Gifts For Her and Gifts For Him (image, title, link).
      </p>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {cards.map((card, index) => (
          <div key={index} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="font-medium text-charcoal">Card {index + 1} — {index === 0 ? 'Gifts For Her' : 'Gifts For Him'}</h2>

            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700">Image</label>
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
                  className="mt-2 h-40 w-full max-w-xs rounded object-cover"
                />
              )}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700">Title (e.g. Gifts For Her)</label>
              <input
                value={card.title || ''}
                onChange={(e) => updateCard(index, { title: e.target.value })}
                placeholder={index === 0 ? 'Gifts For Her' : 'Gifts For Him'}
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-stone-700">Link URL</label>
              <input
                value={card.href || ''}
                onChange={(e) => updateCard(index, { href: e.target.value })}
                placeholder="/products?category=gifts-for-her"
                className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <label className="block text-sm font-medium text-stone-700">Image alt text (accessibility)</label>
              <input
                value={card.imageAlt || ''}
                onChange={(e) => updateCard(index, { imageAlt: e.target.value })}
                placeholder="Elegant jewelry for her"
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
          {saving ? 'Saving…' : 'Save gift cards'}
        </button>
      </div>
    </div>
  );
}
