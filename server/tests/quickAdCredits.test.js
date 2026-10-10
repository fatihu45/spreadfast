const test = require('node:test');
const assert = require('node:assert/strict');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const { beginGeneration, finishGeneration, failGeneration, accountSummary } = require('../services/quickAdCredits');
const { QUICK_AD_PLANS, QUICK_AD_CREDIT_PRICE } = require('../config/quickAdPlans');
for (const role of ['company', 'promoter']) {
const user = { id: role, role, status: 'active' };
const media = { publicId: 'private/ad', outputUrl: 'https://media.example/private.mp4', previewUrl: 'https://media.example/watermarked.mp4' };
const begin = (DB, key = 'attempt-1', options = {}) => beginGeneration(DB, { userId: user.id, key, model: 'test-model', style: 'food', ...options });
const finish = (DB, generation, options = {}) => finishGeneration(DB, { userId: user.id, id: generation.id, media, imageUrl: 'https://media.example/image.png', ...options });

test('plans contain the requested backend prices, with no client-specified values', () => {
  assert.equal(QUICK_AD_CREDIT_PRICE, 1700);
  assert.deepEqual(QUICK_AD_PLANS.map(p => [p.id, p.price, p.credits]), [
    ['single', 1700, 1], ['starter', 5000, 4], ['growth', 10000, 8], ['business', 20000, 16]
  ]);
});
test('one successful preview marks eligibility used without spending a paid credit', async () => {
  const DB = quickAdsDb([{ ...user, quickAdCredits: 3 }]);
  const { generation } = await begin(DB);
  assert.equal(generation.freePreview, true);
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 3);
  const done = await finish(DB, generation);
  assert.equal(done.downloadable, false);
  assert.equal(done.creditUsed, false);
  const account = accountSummary(await DB.User.findOne({ id: user.id }));
  assert.equal(account.quickAdCredits, 3);
  assert.equal(account.quickAdTotalCreditsUsed, 0);
  assert.equal(account.quickAdsGenerated, 1);
  assert.equal(account.freePreviewAvailable, false);
});
test('paid generation deducts once only after success, including repeated completion/retry', async () => {
  const DB = quickAdsDb([{ ...user, quickAdCredits: 1, quickAdFreePreviewUsed: true }]);
  const { generation } = await begin(DB);
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 1);
  const [first, second] = await Promise.all([finish(DB, generation), finish(DB, generation)]);
  assert.equal(first.downloadable, true); assert.equal(second.id, first.id);
  const retry = await begin(DB);
  assert.equal(retry.reused, true);
  const account = accountSummary(await DB.User.findOne({ id: user.id }));
  assert.equal(account.quickAdCredits, 0); assert.equal(account.quickAdTotalCreditsUsed, 1); assert.equal(account.quickAdsGenerated, 1);
  await assert.rejects(begin(DB, 'attempt-2'), { code: 'NO_QUICK_AD_CREDITS', statusCode: 403 });
});
test('concurrent requests cannot reserve the same preview or paid credit twice', async () => {
  for (const initial of [{ ...user }, { ...user, quickAdFreePreviewUsed: true, quickAdCredits: 1 }]) {
    const DB = quickAdsDb([initial]);
    const attempts = await Promise.allSettled([begin(DB, 'a'), begin(DB, 'b')]);
    assert.equal(attempts.filter(a => a.status === 'fulfilled').length, 1);
    assert.equal(attempts.find(a => a.status === 'rejected').reason.code, 'GENERATION_IN_PROGRESS');
  }
});
test('failed and timed-out requests leave all balances and free eligibility unchanged', async () => {
  for (const initial of [{ ...user }, { ...user, quickAdFreePreviewUsed: true, quickAdCredits: 1 }]) {
    const DB = quickAdsDb([initial]);
    const { generation } = await begin(DB);
    await failGeneration(DB, { userId: user.id, id: generation.id, code: 'TIMEOUT' });
    assert.deepEqual(accountSummary(await DB.User.findOne({ id: user.id })), accountSummary(initial));
    await assert.rejects(finish(DB, generation), { code: 'GENERATION_EXPIRED' });
    await begin(DB, 'next-attempt');
  }
});
test('expired reservations recover without charging or letting a late job consume the new reservation', async () => {
  const DB = quickAdsDb([{ ...user }]);
  const first = await begin(DB, 'a', { now: 1000, leaseMs: 10 });
  await assert.rejects(begin(DB, 'a', { now: 1020 }), { code: 'GENERATION_EXPIRED' });
  const second = await begin(DB, 'b', { now: 1020, leaseMs: 1000 });
  await assert.rejects(finish(DB, first.generation, { now: 1021 }), { code: 'GENERATION_EXPIRED' });
  await failGeneration(DB, { userId: user.id, id: first.generation.id });
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdGenerationLock, second.generation.id);
  await finish(DB, second.generation, { now: 1022 });
});
test('a failed ledger write rolls back credit and usage updates', async () => {
  const DB = quickAdsDb([{ ...user, quickAdCredits: 1, quickAdFreePreviewUsed: true }]);
  const { generation } = await begin(DB);
  const update = DB.QuickAdGeneration.updateOne;
  DB.QuickAdGeneration.updateOne = async () => { throw new Error('Database write failed'); };
  await assert.rejects(finish(DB, generation), /Database write failed/);
  DB.QuickAdGeneration.updateOne = update;
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 1);
  assert.equal((await DB.QuickAdGeneration.findOne({ id: generation.id })).status, 'pending');
});
test('generation completion is owner-scoped and malformed credit accounts fail closed', async () => {
  const DB = quickAdsDb([{ ...user }]);
  const { generation } = await begin(DB);
  await assert.rejects(finishGeneration(DB, { userId: 'other', id: generation.id, media }), { statusCode: 404 });
  for (const value of [-1, 0.5, NaN, null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => accountSummary({ ...user, quickAdCredits: value }), { code: 'INVALID_CREDIT_ACCOUNT' });
  }
});
}
