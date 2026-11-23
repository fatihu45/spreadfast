function normalizeEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function validPassword(value) {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72;
}
async function findEmailUser(User, email) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = await User.find({ email: { $regex: `^\\s*${escaped}\\s*$`, $options: 'i' } });
  if (matches.length > 1) throw Object.assign(new Error('This email needs account support.'), { statusCode: 409 });
  return matches[0] || null;
}
module.exports = { normalizeEmail, validPassword, findEmailUser };
