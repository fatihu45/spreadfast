const jwt = require('jsonwebtoken');

const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({success: false, message: 'Access token required'});
  let claims;
  try { claims = jwt.verify(token, process.env.JWT_SECRET); }
  catch { return res.status(401).json({success: false, message: 'Invalid or expired token'}); }
  try {
    const user = await req.app.locals.db.User.findOne({id: claims.id});
    if (!user || (claims.tokenVersion || 0) !== (user.tokenVersion || 0)) return res.status(401).json({success: false, message: 'Please log in again.'});
    if (user.status && user.status !== 'active') return res.status(403).json({success: false, message: 'This account is not active.'});
    req.user = {id: user.id, email: user.email, role: user.role};
    next();
  } catch (error) { res.status(503).json({success: false, message: 'Account verification temporarily unavailable. Please retry.'}); }
};
module.exports = {authenticateToken};
