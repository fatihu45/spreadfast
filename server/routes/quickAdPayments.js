const express = require('express');
const axios = require('axios');
const { randomUUID } = require('node:crypto');
const { authenticateToken } = require('../middleware/auth');
const { findQuickAdPlan } = require('../config/quickAdPlans');
const { fail } = require('../services/quickAdCredits');
const { PURPOSE, verifyQuickAdPayment } = require('../services/quickAdPayments');
const { safeError } = require('./quickAdMedia');
const { canUseQuickAds, quickAdAccountOnly } = require('../services/quickAdAccess');

function createQuickAdPaymentsRouter({ paystackConfig, authenticate = authenticateToken, http = axios } = {}) {
  const router = express.Router();
  router.use(authenticate, quickAdAccountOnly);
  router.post('/credits/initialize', async (req, res) => {
    let reference;
    try {
      if (!req.body || Object.keys(req.body).some(key => key !== 'planId')) fail('INVALID_PLAN', 'Send only a Quick Ads plan ID.', 400);
      const plan = findQuickAdPlan(req.body.planId);
      if (!plan) fail('INVALID_PLAN', 'Choose a valid Quick Ads plan.', 400);
      if (!paystackConfig?.secretKey) fail('PAYMENTS_UNAVAILABLE', 'Payments are temporarily unavailable.', 503);
      const callback = new URL('/quickads/credits', process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://tryspreadfast.com' : 'http://localhost:3000'));
      if (!['https:', 'http:'].includes(callback.protocol)) throw new Error('Invalid callback configuration');
      const DB = req.app.locals.db;
      reference = `qa_${randomUUID()}`;
      const user = await DB.withTransaction(async tx => {
        const account = await tx.User.findOne({ id: req.user.id });
        if (!account || !canUseQuickAds(account.role) || (account.status && account.status !== 'active')) fail('QUICK_AD_ACCOUNT_REQUIRED', 'An active company or promoter account is required.', 403);
        await tx.PaystackTransaction.create({ id: randomUUID(), reference, userId: account.id, email: account.email,
          purpose: PURPOSE, buyerRole: account.role, planId: plan.id, amount: plan.price, credits: plan.credits,
          pricing: { version: 'quick-ads-v1', planId: plan.id, amount: plan.price, credits: plan.credits },
          creditsApplied: false, status: 'pending', createdAt: new Date().toISOString() });
        return account;
      });
      const response = await http.post('https://api.paystack.co/transaction/initialize', {
        reference, email: user.email, amount: plan.price * 100, currency: 'NGN', callback_url: callback.href,
        metadata: { purpose: PURPOSE, planId: plan.id, userId: user.id, buyerRole: user.role }
      }, { headers: { Authorization: `Bearer ${paystackConfig.secretKey}` }, timeout: 15000 });
      const data = response.data?.data;
      if (!response.data?.status || data?.reference !== reference || typeof data.authorization_url !== 'string') throw new Error('Invalid initialization response');
      const checkout = new URL(data.authorization_url);
      if (checkout.protocol !== 'https:' || !['checkout.paystack.com', 'checkout.paystack.co'].includes(checkout.hostname) || checkout.username || checkout.password) throw new Error('Invalid checkout URL');
      res.set('Cache-Control', 'no-store').json({ success: true, reference, authorizationUrl: checkout.href, publicKey: paystackConfig.publicKey });
    } catch (error) {
      // Never log HTTP error objects: they can contain the Paystack Authorization header.
      if (reference) console.error('[Quick Ads payments] Initialization incomplete', { reference, status: Number.isInteger(error.response?.status) ? error.response.status : undefined });
      safeError(res, error);
    }
  });
  router.get('/credits/verify/:reference', async (req, res) => {
    try {
      const result = await verifyQuickAdPayment(req.app.locals.db, req.params.reference, req.user.id, paystackConfig, http);
      res.set('Cache-Control', 'no-store').json(result);
    } catch (error) { safeError(res, error); }
  });
  router.get('/transactions', async (req, res) => {
    try {
      const query = req.app.locals.db.PaystackTransaction.find({ userId: req.user.id, purpose: PURPOSE });
      const records = await (typeof query.limit === 'function' ? query.sort({ createdAt: -1 }).limit(50) : query);
      const transactions = records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50)
        .map(t => ({ reference: t.reference, planId: t.planId, amount: t.amount, credits: t.credits,
          status: t.status, creditsApplied: t.creditsApplied === true, createdAt: t.createdAt, verifiedAt: t.verifiedAt }));
      res.set('Cache-Control', 'no-store').json({ success: true, transactions });
    } catch (error) { safeError(res, error); }
  });
  return router;
}
module.exports = { createQuickAdPaymentsRouter };
