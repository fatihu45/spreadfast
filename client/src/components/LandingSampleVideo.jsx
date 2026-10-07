import React, { useEffect, useRef, useState } from 'react';

// Public marketing copies, independent of private generation history.
export default function LandingSampleVideo({ name, label, autoPlay = false }) {
  const ref = useRef(null);
  const inView = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (loaded && autoPlay && inView.current && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData) {
      ref.current.play().catch(() => {});
    }
  }, [loaded, autoPlay]);
  useEffect(() => {
    const video = ref.current;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection?.saveData;
    if (!window.IntersectionObserver) { setLoaded(true); return undefined; }
    const observer = new IntersectionObserver(entries => {
      const visible = entries[0].isIntersecting;
      inView.current = visible;
      if (visible) {
        setLoaded(true);
        if (autoPlay && !reducedMotion && !saveData) video.play().catch(() => {});
      } else if (!video.paused) video.pause();
    }, { threshold: 0.35 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [autoPlay]);
  return <div className="landing-sample-media">
    <video ref={ref} src={loaded ? `/quick-ad-samples/${name}.mp4` : undefined}
      poster={`/quick-ad-samples/${name}.jpg`} aria-label={label}
      muted playsInline controls loop preload="none"
      onError={() => setFailed(true)} onPlay={event => {
        document.querySelectorAll('.landing-sample-media video').forEach(video => {
          if (video !== event.currentTarget && !video.paused) video.pause();
        });
      }} />
    {failed && <a className="landing-sample-fallback" href={`/quick-ad-samples/${name}.mp4`}>Open video</a>}
  </div>;
}
