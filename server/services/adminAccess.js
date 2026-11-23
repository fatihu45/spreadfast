function isAdmin(user, env = process.env) {
  if (!user) return false;
  return user.role === 'admin' || !!(env.ADMIN_EMAIL && typeof user.email === 'string' && user.email.trim().toLowerCase() === env.ADMIN_EMAIL.trim().toLowerCase());
}
module.exports = { isAdmin };
