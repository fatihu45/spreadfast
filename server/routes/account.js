const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken } = require('../middleware/auth');
const { authLimit } = require('../middleware/authLimits');
const { validPassword } = require('../services/accountIdentity');
const { passwordChanged } = require('../services/emailNotifications');
function createAccountRouter({ authenticate = authenticateToken, password = bcrypt, limit = authLimit({ name: 'account-password', max: 10 }) } = {}) {
  const router = express.Router();
  router.use(authenticate);
  router.patch('/profile', async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 100 || Object.keys(req.body).some(key => key !== 'name')) return res.status(400).json({ success: false, message: 'Enter a name of 1–100 characters.' });
    try {
      await req.app.locals.db.User.updateOne({ id: req.user.id }, { $set: { name } });
      res.json({ success: true, name });
    } catch { res.status(503).json({ success: false, message: 'Could not save your profile.' }); }
  });
  router.post('/password', limit, async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (typeof currentPassword !== 'string' || Buffer.byteLength(currentPassword) > 4096 || !validPassword(newPassword)) return res.status(400).json({ success: false, message: 'Use a new password of at least 8 characters and at most 72 UTF-8 bytes.' });
    try {
      const DB = req.app.locals.db;
      const user = await DB.User.findOne({ id: req.user.id });
      if (!user || !(await password.compare(currentPassword, user.password))) return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      const hash = await password.hash(newPassword, 10);
      const result = await DB.User.updateOne({ id: user.id, password: user.password }, { $set: { password: hash, resetPasswordTokenHash: null, resetPasswordExpires: null }, $inc: { tokenVersion: 1 } });
      if (!result.matchedCount) return res.status(409).json({ success: false, message: 'Your account changed. Log in and try again.' });
      await passwordChanged(DB, user).catch(() => {});
      res.json({ success: true, message: 'Password changed. Log in again on your devices.' });
    } catch { res.status(503).json({ success: false, message: 'Could not change your password.' }); }
  });
  return router;
}
module.exports = { createAccountRouter };
