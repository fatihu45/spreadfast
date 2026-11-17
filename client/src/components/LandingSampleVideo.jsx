import React, { useEffect, useRef, useState } from 'react';

// Public marketing copies, independent of private generation history.
export default function LandingSampleVideo({ name, label, autoPlay = true, directory = '/quick-ad-samples' }) {
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
    if (!window.IntersectionObserver) { inView.current = true; setLoaded(true); return undefined; }
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
    <video ref={ref} src={loaded ? `${directory}/${name}.mp4` : undefined}
      poster={`${directory}/${name}.jpg`} aria-label={label}
      muted playsInline controls loop preload="none"
      onError={() => setFailed(true)} />
    {failed && <a className="landing-sample-fallback" href={`${directory}/${name}.mp4`}>Open video</a>}
  </div>;
}
