export const SITE_URL = 'https://tryspreadfast.com';
export const HOME_TITLE = 'AI Video Ads from Product Images | SpreadFast';
export const HOME_DESCRIPTION = 'Turn product photos into commercial video ads with SpreadFast Quick Ads and Fashion Studio. Connect with content creators to promote your business in Nigeria.';
export const SOCIAL_IMAGE = `${SITE_URL}/icon-512.png`;

// All application routes are excluded from search. Authentication still protects data.
export const APP_PATHS = [
  '/login', '/register', '/forgot-password', '/reset-password', '/payment-callback',
  '/dashboard', '/company', '/wallet', '/company/quick-ads', '/promoter/quick-ads',
  '/quick-ad', '/quickads', '/quickads/credits', '/promoter-dashboard',
  '/available-campaigns', '/submit-proof', '/admin-portal', '/campaigns',
];
export function metadataForPath(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' ? {
    title: HOME_TITLE, description: HOME_DESCRIPTION,
    canonical: `${SITE_URL}/`, robots: 'index, follow, max-image-preview:large',
  } : {
    title: APP_PATHS.includes(path) ? 'Your Account | SpreadFast' : 'Page Not Found | SpreadFast',
    description: 'Manage your SpreadFast account, video ads and creator campaigns.',
    canonical: null, robots: 'noindex, nofollow',
  };
}
