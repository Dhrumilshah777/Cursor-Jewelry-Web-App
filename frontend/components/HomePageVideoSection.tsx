'use client';

import { useRef, useState, useEffect } from 'react';
import { apiGet, assetUrl } from '@/lib/api';

const DEFAULT_VIDEO_SRC = '/home-page-video.mp4';

const OVERLAY_OPACITY_PLAYING = 0.5;

export default function HomePageVideoSection() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO_SRC);

  useEffect(() => {
    apiGet<{ homeVideoUrl?: string }>('/api/site/video')
      .then((data) => {
        const url = data?.homeVideoUrl?.trim();
        if (url) setVideoSrc(url.startsWith('http') ? url : url.startsWith('/uploads/') ? assetUrl(url) : url);
      })
      .catch(() => {});
  }, []);

  const togglePlayPause = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play();
      setIsPlaying(true);
    }
  };

  return (
    <section ref={sectionRef} className="relative w-full overflow-hidden bg-charcoal">
      {/* Height: min 180px (mobile), 220px (sm), 280px (md); max 500px; aspect 2.4:1 */}
      <div className="relative aspect-[2.4/1] w-full min-h-[180px] max-h-[520px] sm:min-h-[220px] md:min-h-[280px]">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          muted
          loop
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Black overlay: visible and stronger when playing; fades out when paused */}
        <div
          className="absolute inset-0 bg-black transition-opacity duration-300 ease-out"
          style={{ opacity: isPlaying ? OVERLAY_OPACITY_PLAYING : 0 }}
          aria-hidden
        />

        {/* Click overlay when playing: click to pause and show play icon again */}
        {isPlaying && (
          <button
            type="button"
            onClick={togglePlayPause}
            className="absolute inset-0 z-10 cursor-pointer"
            aria-label="Pause video"
          />
        )}

        {/* Play icon: visible only when paused; hidden when playing */}
        {!isPlaying && (
          <button
            type="button"
            onClick={togglePlayPause}
            className="absolute left-1/2 top-1/2 z-10 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 sm:h-16 sm:w-16"
            aria-label="Play video"
          >
            <svg className="ml-0.5 h-6 w-6 text-charcoal sm:h-7 sm:w-7" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7L8 5z" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
