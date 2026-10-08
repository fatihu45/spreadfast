// Default home after authentication; explicit return links take precedence in Login.
export function getAuthDestination(user) {
  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
  if (user?.email === adminEmail) return '/admin-portal';
  if (user?.role === 'company') return '/company/quick-ads';
  if (user?.role === 'promoter') return '/promoter/quick-ads';
  return '/';
}
