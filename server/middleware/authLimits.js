const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const schema = new mongoose.Schema({ _id: String, count: Number, expiresAt: Date });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Counter = mongoose.models.AuthRateCounter || mongoose.model('AuthRateCounter', schema);
const local = new Map();
async function consume(key, expiresAt) {
  if (mongoose.connection.readyState === 1) {
    const row = await Counter.findOneAndUpdate({ _id: key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } }, { upsert: true, new: true });
    return row.count;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('Rate limiter unavailable');
  const now = Date.now();
  for (const [id, row] of local) if (row.expiresAt <= now) local.delete(id);
  const row = local.get(key) || { count: 0, expiresAt: expiresAt.getTime() };
  row.count++; local.set(key, row); return row.count;
}
function authLimit({ name, max = 30, windowMs = 15 * 60 * 1000, store = consume, now = Date.now } = {}) {
  return async (req, res, next) => {
    try {
      const time = now(), slot = Math.floor(time / windowMs);
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
      const identities = [`ip:${req.ip}`];
      if (email) identities.push(`email:${email}`);
      for (const identity of identities) {
        const key = createHash('sha256').update(`${name}:${slot}:${identity}`).digest('hex');
        if (await store(key, new Date((slot + 1) * windowMs)) > max) {
          res.set('Retry-After', String(Math.ceil(((slot + 1) * windowMs - time) / 1000)));
          return res.status(429).json({ success: false, message: 'Too many attempts. Please wait before trying again.' });
        }
      }
      next();
    } catch { res.status(503).json({ success: false, message: 'Account service temporarily unavailable. Please retry.' }); }
  };
}
module.exports = { authLimit };
