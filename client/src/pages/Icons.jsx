import React from 'react';

/*
  Brand-colored icon set for SpreadFast.
  Usage: <MegaphoneIcon /> or <MegaphoneIcon size={40} color="#5CB87A" />
  Default color is your forest green (#1e4d2b) to match existing Tailwind green-700.
  Swap `color` per-instance for mint (#5CB87A) or gold (#C8A96E) accents where relevant.
*/

const base = (size) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  xmlns: 'http://www.w3.org/2000/svg',
});

// Step 1: Request Advert
export const MegaphoneIcon = ({ size = 32, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <path d="M3 10v4a1 1 0 0 0 1 1h2l1 5h2l-1-5h1l9 4V6l-9 4H4a1 1 0 0 0-1 1v-1z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={color} fillOpacity="0.12"/>
    <path d="M19 9a3 3 0 0 1 0 6" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// Step 2: People Post It (share/network)
export const ShareIcon = ({ size = 32, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <circle cx="18" cy="6" r="2.5" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <circle cx="18" cy="18" r="2.5" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// Step 3: Get Customers (growth)
export const GrowthIcon = ({ size = 32, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <path d="M4 18l5-5 4 4 7-8" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 9h5v5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Feature: Real People
export const PeopleIcon = ({ size = 28, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <circle cx="17" cy="9" r="2.4" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M14.5 14.5c2.4.2 4 1.9 4 4.5" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// Feature: Transparent (shield/check)
export const ShieldCheckIcon = ({ size = 28, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.1" strokeLinejoin="round"/>
    <path d="M9 12l2 2 4-4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Feature: Multi-Platform (globe)
export const GlobeIcon = ({ size = 28, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.08"/>
    <path d="M3.5 12h17M12 3.5c2.5 2.3 3.8 5.3 3.8 8.5s-1.3 6.2-3.8 8.5c-2.5-2.3-3.8-5.3-3.8-8.5S9.5 5.8 12 3.5z" stroke={color} strokeWidth="1.4"/>
  </svg>
);

// Feature: Quick Setup (bolt)
export const BoltIcon = ({ size = 28, color = '#1e4d2b' }) => (
  <svg {...base(size)}>
    <path d="M13 2L4.5 13.5H11L10.5 22 19.5 10H13l0.5-8z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={color} fillOpacity="0.14"/>
  </svg>
);

// Promoter earn: Campaign Pool (money)
export const PoolIcon = ({ size = 32, color = '#C8A96E' }) => (
  <svg {...base(size)}>
    <ellipse cx="12" cy="7" rx="7" ry="3" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.12"/>
    <path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7" stroke={color} strokeWidth="1.6"/>
    <path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" stroke={color} strokeWidth="1.6"/>
  </svg>
);

// Promoter earn: Your Share (pie/percentage)
export const ShareChartIcon = ({ size = 32, color = '#C8A96E' }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.08"/>
    <path d="M12 3.5A8.5 8.5 0 0 1 20.5 12H12V3.5z" fill={color} fillOpacity="0.35"/>
  </svg>
);

// Promoter earn: Payout (bank)
export const BankIcon = ({ size = 32, color = '#C8A96E' }) => (
  <svg {...base(size)}>
    <path d="M4 9l8-5 8 5" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="M4 9h16v2H4z" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.2"/>
    <path d="M5.5 11v7M9.5 11v7M14.5 11v7M18.5 11v7" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    <path d="M4 20h16" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// Trust strip: lock (secure payments)
export const LockIcon = ({ size = 28, color = '#F0EBE1' }) => (
  <svg {...base(size)}>
    <rect x="5" y="10" width="14" height="10" rx="2" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.1"/>
    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="1.6"/>
    <circle cx="12" cy="15" r="1.4" fill={color}/>
  </svg>
);

// Trust strip: map pin (built for Nigeria)
export const PinIcon = ({ size = 28, color = '#F0EBE1' }) => (
  <svg {...base(size)}>
    <path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21z" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.1" strokeLinejoin="round"/>
    <circle cx="12" cy="9.5" r="2.3" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.2"/>
  </svg>
);

// Trust strip: verified checkmark
export const VerifiedIcon = ({ size = 28, color = '#F0EBE1' }) => (
  <svg {...base(size)}>
    <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6" fill={color} fillOpacity="0.1"/>
    <path d="M8 12.5l2.5 2.5 5.5-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
