import React from 'react';

const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  campaign: <><path d="M3 10v4h4l11 5V5L7 10H3Z" /><path d="m7 14 2 6h3l-2-5M21 9v6" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
};

// Decorative only; the surrounding control supplies its accessible name.
export default function UiIcon({ name = 'campaign', className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {paths[name] || paths.campaign}
    </svg>
  );
}
