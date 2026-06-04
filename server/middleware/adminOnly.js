module.exports = function adminOnly(req, res, next) {
  // your existing auth.js sets req.user — check role here
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admins only' });
  }
  next();
};