'use client';

import { useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const DEFAULT_VIDEO_SRC = '/home-page-video.mp4';

export default function HomePageVideoSection() {
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO_SRC);

  useEffect(() => {
    apiGet<{ homeVideoUrl?: string }>('/api/site/video')
      .then((data) => {
        const url = data?.homeVideoUrl?.trim();
        if (url) setVideoSrc(url.startsWith('http') ? url : url.startsWith('/uploads/') ? assetUrl(url) : url);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative mt-10 mb-2 w-full overflow-hidden bg-charcoal">
      {/* Height: min 220px (mobile), 260px (sm), 280px (md); PC: taller — max 720px */}
      <div className="relative aspect-[2.4/1] w-full min-h-[220px] max-h-[520px] sm:min-h-[260px] md:min-h-[360px] md:max-h-[720px] lg:min-h-[420px] lg:max-h-[800px]">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          muted
          loop
          playsInline
          autoPlay
        />
      </div>
    </section>
  );
}
