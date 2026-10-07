import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { quickAdsUrl, quickAdsAuth, generationVideoUrl } from '../utils/quickAdsApi';

export default function QuickAdHistoryVideo({ item, token }) {
  const host = useRef(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!window.IntersectionObserver) { setVisible(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '150px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || item.status !== 'completed') return undefined;
    const controller = new AbortController();
    setError(false); setSrc('');
    axios.get(quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`), {
      headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000,
    }).then(({ data }) => {
      // A tiny seek displays an actual video frame on mobile Safari.
      if (!controller.signal.aborted) setSrc(generationVideoUrl(data) + '#t=0.001');
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [visible, item.generationId, item.status, token, attempt]);
  return <div className="quick-ad-history-media" ref={host}>
    {src && !error ? <video src={src} controls playsInline preload="metadata"
      aria-label="Quick Ad video" controlsList={item.freePreview ? 'nodownload' : undefined}
      onError={() => setError(true)} onPlay={event => {
        host.current?.closest('.quick-ad-history-grid')?.querySelectorAll('video').forEach(video => {
          if (video !== event.currentTarget) video.pause();
        });
      }} /> : <div className="quick-ad-history-media-message" role="status">
      {item.status === 'pending' ? 'Your video is processing' : item.status !== 'completed' ? 'Video unavailable' : error ? 'Unable to load video' : 'Loading video...'}
      {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry video</button>}
    </div>}
  </div>;
}
