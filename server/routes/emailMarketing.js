const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { STARTER, validateCampaign, renderCampaign, queueTest, checked } = require('../services/emailMarketing');
module.exports = function createEmailMarketingRouter({ models, User, Notification, resend, isConnected, env = process.env }) {
  const router = express.Router();
  const wrap = fn => async (req, res) => {
    try { await fn(req, res); }
    catch (e) { res.status(e.status || 503).json({ success: false, message: e.status ? e.message : 'Email service unavailable. Please retry or check Resend.' }); }
  };
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); if (!isConnected()) return res.status(503).json({ success: false, message: 'Email settings require a connected database.' }); next(); });
  router.use(authenticateToken);
  router.get('/preferences', wrap(async (req, res) => {
    const user = await User.findOne({ id: req.user.id });
    let subscribed = user.marketingSubscribed === true;
    if (subscribed && resend) {
      const result = await resend.contacts.get({ email: user.email.trim().toLowerCase() });
      if (result.data?.unsubscribed) subscribed = false;
    }
    res.json({ success: true, subscribed });
  }));
  router.put('/preferences', wrap(async (req, res) => {
    if (typeof req.body.subscribed !== 'boolean') return res.status(400).json({ success: false, message: 'Choose an email preference.' });
    const user = await User.findOne({ id: req.user.id });
    if (!resend) return res.status(503).json({ success: false, message: 'Email service is not configured.' });
    const subscribed = req.body.subscribed;
    // Opt-out is persisted first; explicit re-subscription only after provider success.
    if (!subscribed) await User.updateOne({ id: user.id }, { $set: { marketingSubscribed: false } });
    const email = user.email.trim().toLowerCase();
    const found = await resend.contacts.get({ email });
    if (found.error && found.error.statusCode !== 404 && found.error.name !== 'not_found') checked(found);
    if (found.data) checked(await resend.contacts.update({ id: found.data.id, unsubscribed: !subscribed }));
    else if (subscribed) checked(await resend.contacts.create({ email, firstName: user.name || '', unsubscribed: false }));
    await User.updateOne({ id: user.id }, { $set: { marketingSubscribed: subscribed, marketingConsentAt: new Date(), marketingConsentSource: 'account-preferences-v1' } });
    res.json({ success: true, subscribed });
  }));
  router.use('/admin', (req, res, next) => {
    if (!env.ADMIN_EMAIL || req.user.email !== env.ADMIN_EMAIL) return res.status(403).json({ success: false, message: 'Admin access required.' });
    next();
  });
  const { EmailMarketingSettings: Settings, EmailCampaign: Campaign } = models;
  router.get('/admin', wrap(async (req, res) => {
    const settings = await Settings.findById('weekly') || { enabled: false, frequency: 3, hour: 8 };
    const campaigns = await Campaign.find({}).sort({ createdAt: -1 }).limit(100).lean();
    const tests = await Notification.find({ kind: 'email_design_test' }).sort({ createdAt: -1 }).limit(5).select('status providerId createdAt sentAt').lean();
    res.json({ success: true, settings, campaigns, tests, configured: !!resend, starter: STARTER });
  }));
  router.put('/admin/settings', wrap(async (req, res) => {
    const { enabled, frequency, hour } = req.body;
    if (typeof enabled !== 'boolean' || ![3,4].includes(frequency) || !Number.isInteger(hour) || hour < 0 || hour > 23) return res.status(400).json({ success: false, message: 'Choose three or four emails weekly and a valid hour.' });
    if (enabled && (!resend || env.NODE_ENV !== 'production' || env.EMAILS_ENABLED === 'false')) return res.status(400).json({ success: false, message: 'Production email delivery must be configured first.' });
    // Pausing affects pending local slots, not a request already accepted by Resend.
    await Settings.findOneAndUpdate({ _id: 'weekly' }, { $set: { enabled, frequency, hour } }, { upsert: true });
    res.json({ success: true });
  }));
  router.post('/admin/preview', wrap(async (req, res) => { const campaign = validateCampaign(req.body); res.json({ success: true, ...renderCampaign(campaign, true) }); }));
  router.post('/admin/test', wrap(async (req, res) => {
    const campaign = validateCampaign(req.body);
    // Stable client request ID makes double clicks/retries one send.
    const nonce = req.get('Idempotency-Key');
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(nonce || '')) return res.status(400).json({ success: false, message: 'A test request ID is required.' });
    if (!resend || env.EMAILS_ENABLED === 'false') return res.status(400).json({ success: false, message: 'Email delivery is not configured.' });
    const row = await queueTest(Notification, campaign, `${req.user.id}:${nonce}`);
    res.json({ success: true, status: row.status, message: 'Test queued for tryspreadfast@gmail.com.' });
  }));
  router.post('/admin/campaigns', wrap(async (req, res) => {
    const campaign = await Campaign.create({ ...validateCampaign(req.body), createdBy: req.user.id, status: 'draft' });
    res.json({ success: true, campaign });
  }));
  router.patch('/admin/campaigns/:id', wrap(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id) || !['draft','ready'].includes(req.body.status)) return res.status(400).json({ success: false, message: 'Invalid campaign or status.' });
    const campaign = await Campaign.findOneAndUpdate({ _id: req.params.id, status: { $in: ['draft','ready'] } }, { $set: { status: req.body.status } }, { new: true });
    if (!campaign) return res.status(409).json({ success: false, message: 'This email is already processing or completed.' });
    res.json({ success: true, campaign });
  }));
  return router;
};
