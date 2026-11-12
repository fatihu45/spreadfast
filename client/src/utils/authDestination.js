// Default home after authentication; explicit return links take precedence in Login.
export function getAuthDestination(user) {
  const adminEmail = process.env.REACT_APP_ADMIN_EMAIL || 'admin@spreadfast.com';
  if (user?.isAdmin || user?.role === 'admin' || user?.email === adminEmail) return '/admin-portal';
  if (user?.role === 'company') return '/ai-commercials';
  if (user?.role === 'promoter') return '/ai-commercials';
  return '/';
}
