const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const { normalizeEmail, validPassword, findEmailUser } = require('../services/accountIdentity');
const { authLimit } = require('../middleware/authLimits');
const { claimRecovery, settleExpired } = require('../services/quickAdRecovery');
const { finishGeneration } = require('../services/quickAdCredits');
const { reconcileGeneration } = require('../services/generationWatchdog');
const { eligible } = require('../services/emailMarketing');
const { isAdmin } = require('../services/adminAccess');
const { createAccountRouter } = require('../routes/account');
const { createQuickAdMediaRouter } = require('../routes/quickAdMedia');
const user = () => ({ id: 'owner', role: 'company', status: 'active', name: 'Owner', email: 'owner@example.test', password: 'old-hash', quickAdCredits: 2, quickAdTotalCreditsUsed: 0 });
const job = () => ({ id: 'saved', userId: 'owner', provider: 'fal', status: 'failed', model: 'saved-model', creditCost: 1, freePreview: false, media: { publicId: 'saved-video', outputUrl: 'https://media.example/video.mp4' } });
async function serve(t, DB, router) {
  const app = express(); app.use(express.json()); app.locals.db = DB; app.use(router);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const authenticate = (req, res, next) => { req.user = { id: 'owner', role: 'company' }; next(); };

test('email normalization preserves legacy identity and rejects ambiguous accounts', async () => {
  const DB = quickAdsDb([{ id: 'legacy', email: '  Owner@Example.Test ' }]);
  assert.equal(normalizeEmail(' Owner@Example.Test '), 'owner@example.test');
  assert.equal((await findEmailUser(DB.User, 'owner@example.test')).id, 'legacy');
  assert.equal(normalizeEmail({ $ne: null }), null);
  assert.equal(normalizeEmail('not-an-email'), null);
  await DB.User.create({ id: 'duplicate', email: 'owner@example.test' });
  await assert.rejects(findEmailUser(DB.User, 'owner@example.test'), { statusCode: 409 });
  assert.equal(validPassword('x'), false); assert.equal(validPassword('é'.repeat(40)), false);
  assert.equal(validPassword('secure-password'), true);
});
test('account limits share normalized account keys across IPs and return retry timing', async () => {
  const counters = new Map();
  const limiter = authLimit({ name: 'login', max: 2, now: () => 1000, store: async key => { counters.set(key, (counters.get(key) || 0) + 1); return counters.get(key); } });
  let status, retry, passed = 0;
  const res = { set(key, value) { retry = value; }, status(code) { status = code; return this; }, json() {} };
  for (let i = 0; i < 3; i++) await limiter({ ip: `ip-${i}`, body: { email: i ? 'owner@example.test' : ' Owner@Example.Test ' } }, res, () => passed++);
  assert.equal(passed, 2); assert.equal(status, 429); assert.ok(Number(retry) > 0);
  assert.ok([...counters.keys()].every(key => !key.includes('owner')));
});
test('saved-video recovery cannot be claimed twice and charges only after media is complete', async () => {
  const DB = quickAdsDb([user()]); await DB.QuickAdGeneration.create(job());
  const claims = await Promise.allSettled([claimRecovery(DB, { id: 'saved', userId: 'owner' }), claimRecovery(DB, { id: 'saved', userId: 'owner' })]);
  assert.equal(claims.filter(c => c.status === 'fulfilled').length, 1);
  assert.equal((await DB.User.findOne({ id: 'owner' })).quickAdCredits, 2);
  const active = claims.find(c => c.status === 'fulfilled').value;
  await assert.rejects(finishGeneration(DB, { id: active.id, userId: 'owner', executionId: 'stale', media: active.media }));
  await finishGeneration(DB, { id: active.id, userId: 'owner', executionId: active.executionId, media: active.media });
  await finishGeneration(DB, { id: active.id, userId: 'owner', executionId: active.executionId, media: active.media });
  assert.equal((await DB.User.findOne({ id: 'owner' })).quickAdCredits, 1);
});
test('expired jobs release only their own lock and retain assets for recovery', async () => {
  const DB = quickAdsDb([{ ...user(), quickAdGenerationLock: 'new-job', quickAdGenerationLockExpiresAt: new Date(Date.now() + 60000) }]);
  await DB.QuickAdGeneration.create({ ...job(), status: 'pending', expiresAt: new Date(0) });
  const stopped = await settleExpired(DB, await DB.QuickAdGeneration.findOne({ id: 'saved' }));
  assert.equal(stopped.status, 'failed'); assert.equal(stopped.media.publicId, 'saved-video');
  assert.equal((await DB.User.findOne({ id: 'owner' })).quickAdGenerationLock, 'new-job');
});
test('watchdog attempts saved-work recovery once and never retries ambiguous image-only jobs', async () => {
  const DB = quickAdsDb([user()]); await DB.QuickAdGeneration.create({ ...job(), status: 'pending', expiresAt: new Date(0) });
  let calls = 0; const recover = { quick: async () => { calls++; throw new Error('provider unavailable'); } };
  const pending = await DB.QuickAdGeneration.findOne({ id: 'saved' });
  await reconcileGeneration(DB, pending, recover);
  await reconcileGeneration(DB, await DB.QuickAdGeneration.findOne({ id: 'saved' }), recover);
  assert.equal(calls, 1);
  await DB.QuickAdGeneration.create({ ...job(), id: 'image-only', media: undefined, status: 'pending', expiresAt: new Date(0) });
  await reconcileGeneration(DB, await DB.QuickAdGeneration.findOne({ id: 'image-only' }), recover);
  assert.equal(calls, 1);
});
test('explicit local opt-out wins for registered audiences even without a Resend sync', () => {
  assert.equal(eligible({ ...user(), marketingSubscribed: false, marketingOptedOut: true }, 'registered'), false);
  assert.equal(eligible({ ...user(), marketingSubscribed: true, marketingOptedOut: true }, 'all'), false);
});
test('admin policy supports explicit roles and normalized legacy configuration', () => {
  assert.equal(isAdmin({ role: 'admin' }, {}), true);
  assert.equal(isAdmin({ email: ' ADMIN@example.test ' }, { ADMIN_EMAIL: 'admin@example.test' }), true);
  assert.equal(isAdmin({ role: 'company', email: 'other@example.test' }, {}), false);
});
test('profile updates reject privileged fields; password changes verify current secret and revoke sessions', async t => {
  const DB = quickAdsDb([user()]);
  const base = await serve(t, DB, createAccountRouter({ authenticate, limit: (req, res, next) => next(), password: { compare: async (plain, hash) => plain === 'current' && hash === 'old-hash', hash: async () => 'new-hash' } }));
  const send = (path, body, method = 'POST') => fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send('/profile', { name: 'New', role: 'admin' }, 'PATCH')).status, 400);
  assert.equal((await send('/profile', { name: 'New' }, 'PATCH')).status, 200);
  assert.equal((await send('/password', { currentPassword: 'wrong', newPassword: 'new-password' })).status, 400);
  assert.equal((await send('/password', { currentPassword: 'current', newPassword: 'new-password' })).status, 200);
  const saved = await DB.User.findOne({ id: 'owner' });
  assert.equal(saved.tokenVersion, 1); assert.equal(saved.password, 'new-hash'); assert.equal(saved.quickAdCredits, 2);
});
test('unified history paginates, filters studios and excludes other accounts', async t => {
  const DB = quickAdsDb([user()]);
  for (let i = 0; i < 25; i++) await DB.QuickAdGeneration.create({ ...job(), id: `ad-${i}`, provider: i % 2 ? 'ai-commercials' : 'fal', style: 'studio' });
  await DB.QuickAdGeneration.create({ ...job(), id: 'private', userId: 'someone-else' });
  const base = await serve(t, DB, createQuickAdMediaRouter({ authenticate }));
  const first = await (await fetch(base + '/generations?all=true&limit=20')).json();
  assert.equal(first.generations.length, 20); assert.equal(first.hasMore, true);
  const second = await (await fetch(base + '/generations?all=true&limit=20&page=2')).json();
  assert.equal(second.generations.length, 5); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.generations, ...second.generations].map(g => g.generationId)).size, 25);
  const commercials = await (await fetch(base + '/generations?all=true&type=commercial')).json();
  assert.ok(commercials.generations.every(g => g.provider === 'ai-commercials'));
  const quick = await (await fetch(base + '/generations')).json();
  assert.ok(quick.generations.every(g => Number(g.generationId.split('-')[1]) % 2 === 0));
});
