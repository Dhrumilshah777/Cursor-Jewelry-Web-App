'use client';

import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

function resolveImageUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url;
}

export default function HomePageImageSection() {
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ image?: string }>('/api/site/home-page-image')
      .then((data) => setImageUrl((data?.image || '').trim()))
      .catch(() => setImageUrl(''))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !imageUrl) return null;

  const src = resolveImageUrl(imageUrl);
  if (!src) return null;

  return (
    <section className="relative mt-10 mb-12 w-full overflow-hidden bg-stone-100">
      {/* Same height as video: aspect 2.4:1, min/max heights */}
      <div className="relative aspect-[2.4/1] w-full min-h-[220px] max-h-[520px] sm:min-h-[260px] md:min-h-[280px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>
    </section>
  );
}
