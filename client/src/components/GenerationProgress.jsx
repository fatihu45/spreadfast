import React, { useEffect, useState } from 'react';
import { jobStatus, jobProgress } from '../utils/studioJobs';
import './StudioControls.css';

export default function GenerationProgress({ job, compact = false }) {
  const target = jobProgress(job);
  const [progress, setProgress] = useState(target);
  useEffect(() => { setProgress(jobProgress(job)); }, [job?.generationId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setProgress(target); return undefined; }
    const timer = setInterval(() => setProgress(current => current >= target ? current : Math.min(target, current + 2)), 120);
    return () => clearInterval(timer);
  }, [target]);
  return <div className={`sf-generation-progress${compact ? ' is-compact' : ''}`} aria-live="polite">
    <div><strong>{jobStatus(job)}</strong><span>{Math.min(progress, job?.status === 'completed' ? 100 : 96)}%</span></div>
    <progress value={progress} max="100" aria-label="Estimated generation progress" />
    {!compact && <p>Estimated progress. Your ad is saved in My Ads.</p>}
  </div>;
}
