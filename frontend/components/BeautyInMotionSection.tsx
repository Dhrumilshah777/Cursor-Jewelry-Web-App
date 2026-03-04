'use client';

import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const CARD_WIDTH = 300;
const CARD_GAP = 16;

function resolveVideoSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  if (url.startsWith('/uploads/')) return assetUrl(url);
  return url.startsWith('/') ? url : `/${url}`;
}

export default function BeautyInMotionSection() {
  const [videos, setVideos] = useState<string[]>([]);

  useEffect(() => {
    apiGet<{ videos: string[] }>('/api/site/beauty-in-motion')
      .then((data) => setVideos(Array.isArray(data?.videos) ? data.videos : []))
      .catch(() => setVideos([]));
  }, []);

  if (videos.length === 0) return null;

  return (
    <section className="bg-stone-100 py-16">
      <h2 className="text-center text-3xl font-thin uppercase tracking-wide text-charcoal mb-12">
        Beauty in Motion
      </h2>

      <div className="overflow-x-auto overflow-y-hidden scroll-smooth">
        <div
          className="flex justify-center min-w-max gap-4 px-4 py-2"
          style={{ gap: CARD_GAP }}
        >
          {videos.map((url, i) => {
            const src = resolveVideoSrc(url);
            if (!src) return null;
            return (
              <div
                key={`${i}-${url}`}
                className="flex-shrink-0 overflow-hidden rounded-sm bg-stone-200 shadow-md"
                style={{
                  width: CARD_WIDTH,
                  aspectRatio: '3 / 4',
                }}
              >
                <video
                  src={src}
                  className="h-full w-full object-cover"
                  muted
                  loop
                  playsInline
                  autoPlay
                  aria-label={`Beauty in motion video ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
