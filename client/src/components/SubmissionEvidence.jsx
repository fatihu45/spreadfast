import React from 'react';

function webUrl(value) {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export default function SubmissionEvidence({ submission }) {
  let links;
  try { links = JSON.parse(submission.proofUrl); } catch { links = {Post: submission.proofUrl}; }
  if (!links || typeof links !== 'object' || Array.isArray(links)) links = {Post: submission.proofUrl};
  const validLinks = Object.entries(links).map(([platform, value]) => [platform, webUrl(value)]).filter(([, url]) => url);
  const screenshot = webUrl(submission.screenshot) || (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(submission.screenshot || '') ? submission.screenshot : null);
  return <>
    {validLinks.length ? validLinks.map(([platform, url]) => <div key={platform}><a className="sf-admin-proof sf-text-link" href={url} target="_blank" rel="noopener noreferrer">{platform}: {url}</a></div>) : 'No valid post link provided'}
    {screenshot && <div><a className="sf-text-link" href={screenshot} target="_blank" rel="noopener noreferrer">View proof screenshot</a><img src={screenshot} alt="Submitted proof screenshot" loading="lazy" style={{display: 'block', maxWidth: '100%', maxHeight: 320, objectFit: 'contain'}} /></div>}
  </>;
}
