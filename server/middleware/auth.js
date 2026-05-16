const jwt = require('jsonwebtoken');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`[AUTH] ${req.method} ${req.path} - Authorization header:`, authHeader ? 'Present' : 'MISSING');

  if (!token) {
    console.log(`[AUTH] ${req.path} - NO TOKEN FOUND - Returning 401`);
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.log(`[AUTH] ${req.path} - TOKEN VERIFICATION FAILED:`, err.message);
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    console.log(`[AUTH] ${req.path} - TOKEN VERIFIED for user:`, user.id);
    req.user = user;
    next();
  });
};

module.exports = { authenticateToken };
