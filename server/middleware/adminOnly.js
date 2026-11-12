const { isAdmin } = require('../services/adminAccess');
module.exports = (req, res, next) => isAdmin(req.user) ? next() : res.status(403).json({ success: false, message: 'Admins only' });
