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
    <section className="relative w-full overflow-hidden bg-charcoal">
      {/* Height: min 180px (mobile), 220px (sm), 280px (md); max 500px; aspect 2.4:1 */}
      <div className="relative aspect-[2.4/1] w-full min-h-[180px] max-h-[520px] sm:min-h-[220px] md:min-h-[280px]">
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
