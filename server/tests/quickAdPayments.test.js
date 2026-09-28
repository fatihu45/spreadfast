const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const { createQuickAdPaymentsRouter } = require('../routes/quickAdPayments');
const { PURPOSE, awardQuickAdCredits, verifyQuickAdPayment, assertCampaignPayment } = require('../services/quickAdPayments');
const { verifyCharge } = require('../services/campaignPricing');
const mongoose = require('mongoose');
const config = { secretKey: 'test-only-paystack-secret', publicKey: 'test-only-public-key' };
const previousSecret = process.env.JWT_SECRET;
test.before(() => { process.env.JWT_SECRET = 'test-only-login-secret'; });
test.after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });
const user = { id: 'business', role: 'company', status: 'active', email: 'owner@example.test', quickAdCredits: 0 };
const purchase = (reference = 'qa_test-reference') => ({ id: reference, reference, userId: user.id, email: user.email,
  purpose: PURPOSE, planId: 'starter', amount: 5000, credits: 3, status: 'pending', creditsApplied: false,
  pricing: { version: 'quick-ads-v1', planId: 'starter', amount: 5000, credits: 3 }, createdAt: new Date().toISOString() });
const charge = reference => ({ reference, status: 'success', amount: 500000, currency: 'NGN', customer: { email: user.email } });

test('the shared payment schema still validates legacy campaigns and supports credit purchases', () => {
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = source.indexOf('const paystackTransactionSchema =');
  const end = source.indexOf('const PaystackTransaction =', start);
  const context = { mongoose, module: { exports: {} } };
  vm.runInNewContext(source.slice(start, end) + '\nmodule.exports = paystackTransactionSchema;', context);
  const Model = mongoose.model('QuickAdPaymentSchemaTest', context.module.exports);
  const base = { id: 'p', reference: 'ref', userId: user.id, email: user.email, amount: 20000 };
  assert.equal(new Model({ ...base, campaignName: 'Existing campaign' }).validateSync(), undefined);
  assert.ok(new Model(base).validateSync().errors.campaignName);
  assert.equal(new Model(purchase()).validateSync(), undefined);
});

test('duplicate and concurrent confirmations award credits exactly once', async () => {
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create(purchase());
  const results = await Promise.all(Array.from({ length: 5 }, () => awardQuickAdCredits(DB, { reference: 'qa_test-reference', userId: user.id, charge: charge('qa_test-reference') })));
  assert.equal(results.filter(r => !r.alreadyProcessed).length, 1);
  assert.ok(results.every(r => r.quickAdCredits === 3));
  const account = await DB.User.findOne({ id: user.id });
  assert.equal(account.quickAdTotalCreditsPurchased, 3);
  assert.equal(account.quickAdFreePreviewUsed, undefined);
});
test('forged amounts, currency, references, owners, email and failed statuses never add credits', async () => {
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create(purchase());
  for (const patch of [{ amount: 1 }, { currency: 'USD' }, { reference: 'wrong-reference' }, { status: 'failed' }, { customer: { email: 'other@example.test' } }]) {
    await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_test-reference', userId: user.id, charge: { ...charge('qa_test-reference'), ...patch } }), { code: 'PAYMENT_MISMATCH' });
  }
  await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_test-reference', userId: 'other', charge: charge('qa_test-reference') }), { statusCode: 404 });
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 0);
  assert.equal((await DB.PaystackTransaction.findOne({ reference: 'qa_test-reference' })).creditsApplied, false);
});
test('payment state write failures roll back the balance increment', async () => {
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create(purchase());
  const update = DB.PaystackTransaction.updateOne;
  DB.PaystackTransaction.updateOne = async () => { throw new Error('Database unavailable'); };
  await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_test-reference', charge: charge('qa_test-reference') }), /Database unavailable/);
  DB.PaystackTransaction.updateOne = update;
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 0);
});
test('campaign payments and Quick Ads purchases cannot be used interchangeably', async () => {
  assert.throws(() => assertCampaignPayment(purchase()), { code: 'WRONG_PAYMENT_PURPOSE' });
  assert.doesNotThrow(() => assertCampaignPayment({ purpose: 'campaign' }));
  assert.doesNotThrow(() => assertCampaignPayment({})); // legacy campaign records
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create({ ...purchase(), purpose: 'campaign' });
  await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_test-reference', charge: charge('qa_test-reference') }), { statusCode: 404 });
});

async function fixture(t) {
  const DB = quickAdsDb([user, { id: 'other', role: 'company', status: 'active' }, { id: 'creator', role: 'promoter', status: 'active', email: user.email, quickAdCredits: 0 }, { id: 'admin', role: 'admin', status: 'active' }]);
  const calls = [];
  let providerCharge, campaigns = 0;
  const http = {
    async post(url, body, options) {
      calls.push({ url, body, options });
      return { data: { status: true, data: { reference: body.reference, authorization_url: 'https://checkout.paystack.com/test-checkout' } } };
    },
    async get(url, options) {
      calls.push({ url, options });
      const reference = url.split('/').pop();
      return { data: { status: true, data: providerCharge || charge(reference) } };
    }
  };
  const app = express(); app.locals.db = DB;
  app.use(express.json({ verify: (req, res, buffer) => { req.rawBody = buffer; } }));
  app.use('/api/quick-ads', createQuickAdPaymentsRouter({ paystackConfig: config, http }));
  // Exercise the actual existing webhook handler without starting the main server or external services.
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const start = source.indexOf("app.post('/api/payments/webhook'");
  const end = source.indexOf('\n});', start) + 4;
  assert.ok(start > 0 && end > start);
  vm.runInNewContext(source.slice(start, end), { app, express, crypto, Buffer, DB,
    paystackConfig: config, QUICK_AD_PAYMENT_PURPOSE: PURPOSE, verifyCharge,
    verifyQuickAdPayment: (db, ref, id, cfg) => verifyQuickAdPayment(db, ref, id, cfg, http),
    persistPaidCampaign: async campaign => { campaigns++; return campaign; },
    sendCampaignConfirmationEmail: async () => {}, sendNewCampaignAlertToPromoters: async () => {},
    console: { log() {}, error() {} }
  });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function request(route, { body, id = user.id } = {}) {
    const response = await fetch(base + '/api/quick-ads' + route, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json',
        ...(id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    return { status: response.status, body: await response.json() };
  }
  async function webhook(event, signature) {
    const body = JSON.stringify(event);
    return fetch(base + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json',
      'x-paystack-signature': signature === undefined ? crypto.createHmac('sha512', config.secretKey).update(body).digest('hex') : signature }, body });
  }
  return { DB, calls, request, webhook, campaigns: () => campaigns, setCharge: value => { providerCharge = value; } };
}
test('checkout uses trusted plan amounts, reuses Paystack configuration, and rejects arbitrary prices', async t => {
  const f = await fixture(t);
  for (const body of [{ planId: 'starter', price: 1 }, { planId: 'starter', credits: 99 }, { planId: 'unknown' }]) {
    assert.equal((await f.request('/credits/initialize', { body })).status, 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.request('/credits/initialize', { body: { planId: 'starter' }, id: 'admin' })).status, 403);
  assert.equal((await f.request('/credits/initialize', { body: { planId: 'starter' }, id: null })).status, 401);
  const initialized = await f.request('/credits/initialize', { body: { planId: 'starter' } });
  assert.equal(initialized.status, 200);
  assert.equal(f.calls[0].body.amount, 500000); assert.equal(f.calls[0].body.currency, 'NGN');
  assert.equal(f.calls[0].options.headers.Authorization, `Bearer ${config.secretKey}`);
  assert.ok(!JSON.stringify(initialized.body).includes(config.secretKey));
  const stored = await f.DB.PaystackTransaction.findOne({ reference: initialized.body.reference });
  assert.equal(stored.credits, 3); assert.equal(stored.creditsApplied, false);
  assert.equal(stored.purpose, PURPOSE);
});
test('owned verification and signed webhook races award once and never create a campaign', async t => {
  const f = await fixture(t); await f.DB.PaystackTransaction.create(purchase());
  const [verified, hook] = await Promise.all([
    f.request('/credits/verify/qa_test-reference'),
    f.webhook({ event: 'charge.success', data: charge('qa_test-reference') })
  ]);
  assert.equal(verified.status, 200); assert.equal(hook.status, 200);
  assert.equal((await f.DB.User.findOne({ id: user.id })).quickAdCredits, 3);
  assert.equal(f.campaigns(), 0);
  assert.equal((await f.request('/credits/verify/qa_test-reference')).body.alreadyProcessed, true);
  assert.equal((await f.request('/credits/verify/qa_test-reference', { id: 'other' })).status, 404);
  assert.equal((await f.request('/transactions', { id: 'other' })).body.transactions.length, 0);
  assert.equal((await f.request('/transactions')).body.transactions.length, 1);
});
test('webhook signatures and direct provider verification are required before awarding', async t => {
  const f = await fixture(t); await f.DB.PaystackTransaction.create(purchase());
  const event = { event: 'charge.success', data: charge('qa_test-reference') };
  for (const signature of ['', 'bad', '0'.repeat(128)]) assert.equal((await f.webhook(event, signature)).status, 401);
  assert.equal(f.calls.length, 0);
  f.setCharge({ ...charge('qa_test-reference'), status: 'failed' });
  assert.equal((await f.webhook(event)).status, 503);
  assert.equal((await f.request('/credits/verify/qa_test-reference')).status, 409);
  assert.equal((await f.DB.User.findOne({ id: user.id })).quickAdCredits, 0);
});
test('existing campaign webhook still creates its campaign and awards no Quick Ads credits', async t => {
  const f = await fixture(t);
  await f.DB.PaystackTransaction.create({ ...purchase('campaign-reference'), purpose: 'campaign', campaignName: 'Original campaign' });
  const event = { event: 'charge.success', data: charge('campaign-reference') };
  assert.equal((await f.webhook(event)).status, 200);
  assert.equal((await f.webhook(event)).status, 200);
  assert.equal(f.campaigns(), 1);
  assert.equal((await f.DB.User.findOne({ id: user.id })).quickAdCredits, 0);
});

test('promoter checkout records its authenticated owner and role; verification and webhook award once', async t => {
  const f = await fixture(t);
  for (const patch of [{ buyerRole: 'company' }, { userId: user.id }, { credits: 999 }]) {
    assert.equal((await f.request('/credits/initialize', { id: 'creator', body: { planId: 'starter', ...patch } })).status, 400);
  }
  const initialized = await f.request('/credits/initialize', { id: 'creator', body: { planId: 'starter' } });
  assert.equal(initialized.status, 200);
  const reference = initialized.body.reference;
  const stored = await f.DB.PaystackTransaction.findOne({ reference });
  assert.equal(stored.userId, 'creator'); assert.equal(stored.buyerRole, 'promoter');
  assert.equal(stored.amount, 5000); assert.equal(stored.credits, 3);
  assert.equal(f.calls[0].body.metadata.buyerRole, 'promoter');
  assert.equal((await f.request('/credits/verify/' + reference)).status, 404);
  f.setCharge({ ...charge(reference), status: 'failed' });
  assert.equal((await f.request('/credits/verify/' + reference, { id: 'creator' })).status, 409);
  assert.equal((await f.DB.User.findOne({ id: 'creator' })).quickAdCredits, 0);
  f.setCharge(charge(reference));
  const results = await Promise.all([
    f.request('/credits/verify/' + reference, { id: 'creator' }),
    f.webhook({ event: 'charge.success', data: charge(reference) })
  ]);
  assert.ok(results.every(r => r.status === 200));
  assert.equal((await f.request('/credits/verify/' + reference, { id: 'creator' })).body.alreadyProcessed, true);
  assert.equal((await f.DB.User.findOne({ id: 'creator' })).quickAdCredits, 3);
  assert.equal((await f.DB.User.findOne({ id: user.id })).quickAdCredits, 0);
  assert.equal((await f.request('/transactions', { id: 'creator' })).body.transactions.length, 1);
  assert.equal((await f.request('/transactions')).body.transactions.length, 0);
  assert.equal(f.campaigns(), 0);
});
