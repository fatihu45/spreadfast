const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const { calculateQuickAdAnalytics, getQuickAdAnalytics } = require('../services/quickAdAnalytics');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const env = { QUICK_AD_GENERATION_COST_USD: '0.10', USD_NGN_RATE: '1500' };
const purchase = { id: 'p1', reference: 'qa_reference1', userId: 'business', email: 'owner@example.test', purpose: 'quick_ad_credits', planId: 'starter', amount: 5000, credits: 3, status: 'completed', creditsApplied: true, verifiedAt: '2026-09-28T12:00:00Z', createdAt: '2026-09-28T11:00:00Z' };
const generation = { id: 'g1', userId: 'business', status: 'completed', freePreview: false, creditUsed: true, completedAt: '2026-09-28T13:00:00Z' };
function records() {
  return { users: [{ id: 'business', role: 'company', name: 'Test Restaurant', quickAdCredits: 1000, quickAdsGenerated: 99, createdAt: '2026-01-01' }],
    purchases: [purchase, { ...purchase, id: 'p2', reference: 'qa_reference2', amount: 1700, credits: 1, planId: 'single' },
      { ...purchase, id: 'campaign', reference: 'campaign1', purpose: 'campaign', amount: 999999 },
      { ...purchase, id: 'pending', reference: 'pending1', status: 'pending', creditsApplied: false },
      { ...purchase, id: 'failed', reference: 'failed1', status: 'failed', creditsApplied: false },
      { ...purchase, id: 'unverified', reference: 'unverified1', verifiedAt: null }],
    generations: [generation, { ...generation, id: 'free', freePreview: true, creditUsed: false },
      { ...generation, id: 'deleted', userId: 'deleted-business', freePreview: true, creditUsed: false },
      { ...generation, id: 'failed', status: 'failed' }] };
}
test('promoter payments and usage contribute to totals with saved buyer roles and legacy fallback', () => {
  const input = records();
  input.users.push({ id: 'creator', role: 'promoter', name: 'Creator', quickAdCredits: 2 }, { id: 'new-creator', role: 'promoter', quickAdCredits: 0 });
  input.purchases.push({ ...purchase, id: 'creator-payment', reference: 'qa_creator', userId: 'creator', buyerRole: 'promoter' });
  input.generations.push({ ...generation, id: 'creator-ad', userId: 'creator' });
  const result = calculateQuickAdAnalytics(input, env);
  assert.equal(result.analytics.totalRevenue, 11700); assert.equal(result.analytics.totalCreditsSold, 7);
  assert.equal(result.analytics.totalCreditsUsed, 2); assert.equal(result.analytics.totalQuickAdsGenerated, 4);
  assert.equal(result.transactions.find(t => t.reference === 'qa_creator').buyerRole, 'promoter');
  assert.equal(result.transactions.find(t => t.reference === purchase.reference).buyerRole, 'company');
  assert.equal(result.usage.find(u => u.userId === 'new-creator').accountType, 'promoter');
  input.users = input.users.filter(u => u.id !== 'creator');
  assert.equal(calculateQuickAdAnalytics(input, env).transactions.find(t => t.reference === 'qa_creator').buyerRole, 'promoter');
});
test('financial totals use actual verified bundles and completed records, excluding free credits, campaigns and failures', () => {
  const result = calculateQuickAdAnalytics(records(), env);
  assert.deepEqual(result.analytics, { totalRevenue: 6700, totalCreditsSold: 4, totalCreditsUsed: 1, creditsRemaining: 3,
    totalQuickAdsGenerated: 3, estimatedGenerationCost: 450, estimatedGrossProfit: 6250, estimatedGrossMargin: 93.3 });
  assert.equal(result.usage.find(u => u.userId === 'business').availableCredits, 1000);
  assert.equal(result.usage.find(u => u.userId === 'business').estimatedGenerationsPurchased, 4);
  assert.equal(result.usage.find(u => u.userId === 'business').totalQuickAdsGenerated, 2);
  assert.equal(result.usage.find(u => u.userId === 'business').lastGenerationAt, generation.completedAt);
  assert.equal(result.usage.find(u => u.userId === 'deleted-business').availableCredits, null);
  assert.equal(result.transactions.find(t => t.reference === 'pending1').amountPaid, null);
  assert.equal(result.transactions.find(t => t.reference === 'unverified1').status, 'unverified');
});
test('duplicate references and generation IDs count once regardless of pending-copy order', () => {
  const input = records(); input.purchases.push({ ...purchase, status: 'pending', creditsApplied: false }, { ...purchase });
  input.generations.push({ ...generation });
  assert.equal(calculateQuickAdAnalytics(input, env).analytics.totalRevenue, 6700);
  assert.equal(calculateQuickAdAnalytics(input, env).analytics.totalCreditsUsed, 1);
  input.purchases.push({ ...purchase, amount: 10000 });
  assert.throws(() => calculateQuickAdAnalytics(input, env), /Conflicting/);
});
test('missing or invalid estimate settings never present invented zero costs or expose configuration', () => {
  for (const config of [{}, { ...env, USD_NGN_RATE: '' }, { ...env, USD_NGN_RATE: '0' }, { ...env, QUICK_AD_GENERATION_COST_USD: '-1' }, { ...env, QUICK_AD_GENERATION_COST_USD: 'Infinity' }]) {
    const result = calculateQuickAdAnalytics(records(), config);
    assert.equal(result.estimatesAvailable, false);
    assert.equal(result.analytics.estimatedGenerationCost, null);
    assert.equal(result.analytics.estimatedGrossProfit, null);
    assert.equal(result.analytics.estimatedGrossMargin, null);
    assert.ok(!JSON.stringify(result).includes('USD_NGN_RATE'));
  }
});
test('zero revenue is safe, free previews cost money, and inconsistent remaining credits are not silently clamped', () => {
  const result = calculateQuickAdAnalytics({ users: [], purchases: [], generations: [{ ...generation, freePreview: true, creditUsed: false }] }, env);
  assert.equal(result.analytics.estimatedGrossMargin, 0);
  assert.equal(result.analytics.estimatedGrossProfit, -150);
  assert.equal(result.analytics.creditsRemaining, 0);
  const inconsistent = calculateQuickAdAnalytics({ users: [], purchases: [], generations: [generation] }, env);
  assert.equal(inconsistent.analytics.creditsRemaining, -1);
});
test('totals span all purchases while recent transactions are bounded and sorted', () => {
  const purchases = Array.from({ length: 60 }, (_, i) => ({ ...purchase, id: `p${i}`, reference: `ref${i}`, verifiedAt: new Date(Date.UTC(2026, 0, i + 1)).toISOString() }));
  const result = calculateQuickAdAnalytics({ users: [], purchases, generations: [] }, env);
  assert.equal(result.transactions.length, 50); assert.equal(result.transactions[0].reference, 'ref59');
  assert.equal(result.analytics.totalRevenue, 300000);
});
test('read-only analytics runs through the existing database transaction layer', async () => {
  const input = records(), calls = [];
  const db = { withTransaction: async work => work(Object.fromEntries([
    ['User', input.users], ['PaystackTransaction', input.purchases], ['QuickAdGeneration', input.generations]
  ].map(([name, rows]) => [name, { find: async (query, projection) => { calls.push({ name, query, projection }); return rows; } }]))) };
  assert.equal((await getQuickAdAnalytics(db, env)).analytics.totalRevenue, 6700);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[1].query, { purpose: 'quick_ad_credits' });
  assert.equal(calls[2].projection.media, undefined);
});
test('endpoint reuses current admin authentication, exposes no private media and isolates database errors', async t => {
  const prior = { JWT_SECRET: process.env.JWT_SECRET, ADMIN_EMAIL: process.env.ADMIN_EMAIL };
  process.env.JWT_SECRET = 'analytics-test-only'; process.env.ADMIN_EMAIL = 'admin@example.test';
  t.after(() => { for (const [key, value] of Object.entries(prior)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const db = quickAdsDb([{ id: 'admin', role: 'admin', email: process.env.ADMIN_EMAIL }, { id: 'company', role: 'company', email: 'company@example.test' }, { id: 'promoter', role: 'promoter', email: 'creator@example.test' }]);
  await db.PaystackTransaction.create(purchase);
  await db.QuickAdGeneration.create({ ...generation, media: { outputUrl: 'https://private.example/original' } });
  const app = express(); app.locals.db = db; app.use('/api/admin', require('../routes/admin'));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const get = id => fetch(`http://127.0.0.1:${server.address().port}/api/admin/quick-ads/analytics`, { headers: id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } : {} });
  assert.equal((await get()).status, 401);
  for (const id of ['company', 'promoter']) assert.equal((await get(id)).status, 403);
  const response = await get('admin'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json(); assert.equal(body.analytics.totalRevenue, 5000);
  assert.ok(!JSON.stringify(body).includes('private.example'));
  app.locals.db.withTransaction = async () => { throw new Error('private database details'); };
  const failed = await get('admin'); assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes('private database details'));
});
