const { v4: uuidv4 } = require('uuid');

class User {
  static create(name, email, password, role = 'promoter', socialMedia = {}) {
    return {
      id: uuidv4(),
      name,
      email,
      password, // Will be hashed
      role, // 'company' or 'promoter' or 'admin'
      walletBalance: 0,
      bankDetails: null,
      // Social media handles for promoters
      socialMedia: {
        tiktok: socialMedia.tiktok || '',
        instagram: socialMedia.instagram || '',
        twitter: socialMedia.twitter || '',
        facebook: socialMedia.facebook || '',
        youtube: socialMedia.youtube || ''
      },
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = User;

const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }

    req.user = user;
    next();
  });
}

module.exports = { authenticateToken };