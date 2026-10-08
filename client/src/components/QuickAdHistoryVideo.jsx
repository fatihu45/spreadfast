import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import UiIcon from './ui/UiIcon';
import { quickAdsUrl, quickAdsAuth, generationVideoUrl } from '../utils/quickAdsApi';

export default function QuickAdHistoryVideo({ item, token }) {
  const host = useRef(null);
  const player = useRef(null);
  const [started, setStarted] = useState(false);
  const [aspectRatio, setAspectRatio] = useState('16 / 9');
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
    setError(false); setSrc(''); setStarted(false);
    axios.get(quickAdsUrl(`/generations/${encodeURIComponent(item.generationId)}`), {
      headers: quickAdsAuth(token), signal: controller.signal, timeout: 20000,
    }).then(({ data }) => {
      // A tiny seek displays an actual video frame on mobile Safari.
      if (!controller.signal.aborted) setSrc(generationVideoUrl(data) + '#t=0.001');
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [visible, item.generationId, item.status, item.downloadable, token, attempt]);
  return <div className="quick-ad-history-media" ref={host} style={{ aspectRatio }}>
    {src && !error ? <video ref={player} src={src} controls={started} playsInline preload="metadata"
      onLoadedMetadata={event => {
        const video = event.currentTarget;
        if (video.videoWidth && video.videoHeight) setAspectRatio(video.videoWidth + ' / ' + video.videoHeight);
      }}
      aria-label="Quick Ad video" controlsList={!item.downloadable ? 'nodownload' : undefined}
      onError={() => setError(true)} onPlay={event => {
        setStarted(true);
        host.current?.closest('.quick-ad-history-grid')?.querySelectorAll('video').forEach(video => {
          if (video !== event.currentTarget) video.pause();
        });
      }} /> : <div className="quick-ad-history-media-message" role="status">
      {item.status === 'pending' ? 'Your video is processing' : item.status !== 'completed' ? 'Video unavailable' : error ? 'Unable to load video' : 'Loading video...'}
      {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry video</button>}
    </div>}
    {src && !error && !started && <button type="button" className="quick-ad-history-play" aria-label="Play video" title="Play video"
      onClick={() => {
        setStarted(true);
        const playback = player.current?.play();
        playback?.catch(() => setStarted(false));
      }}><span><UiIcon name="play" /></span></button>}
  </div>;
}
