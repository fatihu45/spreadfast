const test = require('node:test');
const assert = require('node:assert/strict');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const { createEmailSender, renderEmail } = require('../services/emailService');
const { deliverNotification, passwordChanged } = require('../services/emailNotifications');
const { awardQuickAdCredits, verifyQuickAdPayment } = require('../services/quickAdPayments');
const { beginGeneration, finishGeneration, failGeneration } = require('../services/quickAdCredits');
const { requestWithdrawal, reviewWithdrawal } = require('../services/wallet');
const previousAdmin = process.env.ADMIN_EMAIL;
test.before(() => { process.env.ADMIN_EMAIL = 'admin@example.test'; });
test.after(() => { if (previousAdmin === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = previousAdmin; });
const user = { id: 'owner', role: 'promoter', name: 'Ada <script>alert(1)</script>', email: 'ada@example.test',
  walletBalance: 15000, quickAdCredits: 0, quickAdFreePreviewUsed: true,
  bankDetails: { bankName: 'Test bank', accountNumber: 'sensitive-bank-number' } };
const purchase = reference => ({ id: reference, reference, userId: user.id, email: user.email, buyerRole: user.role,
  purpose: 'quick_ad_credits', amount: 5000, credits: 3, planId: 'starter', status: 'pending', creditsApplied: false,
  pricing: { version: 'quick-ads-v1', planId: 'starter', amount: 5000, credits: 3 } });
const charge = reference => ({ reference, status: 'success', amount: 500000, currency: 'NGN', customer: { email: user.email } });
const mailRows = DB => DB.EmailNotification.find({});
async function buy(DB, reference = 'qa_email_test') {
  await DB.PaystackTransaction.create(purchase(reference));
  return awardQuickAdCredits(DB, { reference, userId: user.id, charge: charge(reference) });
}
function delivery() {
  const calls = [];
  const send = async (...args) => { calls.push(args); return { success: true, id: 'provider-id' }; };
  return { calls, send };
}

test('verified purchases commit credits once and one customer/admin notification per role', async () => {
  for (const role of ['company', 'promoter']) {
    const DB = quickAdsDb([{ ...user, role }]);
    await DB.PaystackTransaction.create({ ...purchase('qa_email_test'), buyerRole: role });
    await Promise.all(Array.from({ length: 4 }, () => awardQuickAdCredits(DB, { reference: 'qa_email_test', userId: user.id, charge: charge('qa_email_test') })));
    assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 3);
    const rows = await mailRows(DB); assert.equal(rows.length, 2);
    const customer = rows.find(r => r.kind === 'quick_purchase');
    assert.equal(customer.to, user.email); assert.ok(customer.text.includes('₦5,000.00'));
    assert.match(customer.text, /Credits added: 3/); assert.match(customer.text, /Available credits: 3/);
    assert.ok(customer.text.includes('/' + role + '/quick-ads'));
    assert.equal(rows.find(r => r.kind === 'admin_quick_purchase').to, 'admin@example.test');
    assert.ok(!customer.html.includes('<script>')); assert.ok(customer.html.includes('&lt;script&gt;'));
    const d = delivery();
    await Promise.all(rows.flatMap(r => [deliverNotification(DB, r.id, d.send), deliverNotification(DB, r.id, d.send)]));
    for (const row of rows) await deliverNotification(DB, row.id, d.send);
    assert.equal(d.calls.length, 2);
    assert.ok((await mailRows(DB)).every(r => r.status === 'sent'));
  }
});

test('invalid, foreign and abandoned payments enqueue nothing', async () => {
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create(purchase('qa_email_test'));
  await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_email_test', userId: 'other', charge: charge('qa_email_test') }));
  await assert.rejects(awardQuickAdCredits(DB, { reference: 'qa_email_test', userId: user.id, charge: { ...charge('qa_email_test'), amount: 1 } }));
  const http = { get: async () => ({ data: { status: true, data: { ...charge('qa_email_test'), status: 'abandoned' } } }) };
  await assert.rejects(verifyQuickAdPayment(DB, 'qa_email_test', user.id, { secretKey: 'test' }, http));
  assert.equal((await mailRows(DB)).length, 0);
});

test('only a backend-confirmed failed payment enqueues one failure email', async () => {
  const DB = quickAdsDb([user]); await DB.PaystackTransaction.create(purchase('qa_email_test'));
  const http = { get: async () => ({ data: { status: true, data: { ...charge('qa_email_test'), status: 'failed' } } }) };
  for (let i = 0; i < 2; i++) await assert.rejects(verifyQuickAdPayment(DB, 'qa_email_test', user.id, { secretKey: 'test' }, http), { code: 'PAYMENT_UNCONFIRMED' });
  assert.deepEqual((await mailRows(DB)).map(r => r.kind), ['quick_payment_failed']);
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 0);
});

test('withdrawal request and paid transition notify once without bank data; email failure cannot undo paid status', async () => {
  const DB = quickAdsDb([user]);
  await requestWithdrawal(DB, user.id, 1000, null, 'withdrawal-1');
  assert.equal((await mailRows(DB)).length, 2);
  await Promise.all([reviewWithdrawal(DB, 'withdrawal-1', 'completed'), reviewWithdrawal(DB, 'withdrawal-1', 'completed')]);
  const rows = await mailRows(DB); assert.equal(rows.length, 3);
  assert.ok(!JSON.stringify(rows).includes('sensitive-bank-number'));
  const paid = rows.find(r => r.kind === 'withdrawal_paid'); assert.equal(paid.to, user.email);
  await deliverNotification(DB, paid.id, async () => { throw new Error('private provider details'); });
  assert.equal((await DB.Withdrawal.findOne({ id: 'withdrawal-1' })).status, 'completed');
  assert.equal((await DB.User.findOne({ id: user.id })).walletBalance, 14000);
  assert.equal((await DB.EmailNotification.findOne({ id: paid.id })).status, 'retry');
  await reviewWithdrawal(DB, 'withdrawal-1', 'approved'); assert.equal((await mailRows(DB)).length, 3);
});

test('withdrawal persistence failure produces no queued email and no debit', async () => {
  const DB = quickAdsDb([user]); DB.Withdrawal.create = async () => { throw new Error('Database unavailable'); };
  await assert.rejects(requestWithdrawal(DB, user.id, 1000, null, 'w'));
  assert.equal((await mailRows(DB)).length, 0);
  assert.equal((await DB.User.findOne({ id: user.id })).walletBalance, 15000);
});

test('low/zero alerts fire once per cycle, reset after purchase and exclude failed/free generations', async () => {
  const DB = quickAdsDb([{ ...user, quickAdCredits: 2 }]);
  const complete = async key => {
    const { generation } = await beginGeneration(DB, { userId: user.id, key, style: 'food', model: 'test' });
    return finishGeneration(DB, { userId: user.id, id: generation.id, media: { publicId: 'ad', outputUrl: 'https://example.test/ad', previewUrl: 'https://example.test/preview' } });
  };
  await complete('one'); await complete('one');
  assert.deepEqual((await mailRows(DB)).map(r => r.kind), ['quick_low']);
  await complete('two'); await complete('two');
  assert.deepEqual((await mailRows(DB)).map(r => r.kind), ['quick_low', 'quick_zero']);
  await buy(DB);
  const purchased = await DB.User.findOne({ id: user.id });
  assert.equal(purchased.quickAdsLowCreditNotified, false); assert.equal(purchased.quickAdsZeroCreditNotified, false);
  await complete('three'); await complete('four'); await complete('five');
  assert.equal((await mailRows(DB)).filter(r => r.kind === 'quick_low').length, 2);
  assert.equal((await mailRows(DB)).filter(r => r.kind === 'quick_zero').length, 2);
  await DB.User.updateOne({ id: user.id }, { $set: { quickAdCredits: 2, quickAdFreePreviewUsed: false } });
  const count = (await mailRows(DB)).length;
  const failed = await beginGeneration(DB, { userId: user.id, key: 'failure', style: 'food' });
  await failGeneration(DB, { userId: user.id, id: failed.generation.id });
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 2);
  await complete('free'); assert.equal((await mailRows(DB)).length, count);
});

test('stale leases reuse immutable payload/key; outages leave credits intact and retries stop before key expiry', async () => {
  const DB = quickAdsDb([user]); await buy(DB);
  const row = (await mailRows(DB))[0]; const d = delivery();
  await DB.EmailNotification.updateOne({ id: row.id }, { $set: { status: 'sending', firstAttemptAt: new Date(Date.now() - 600000), leaseUntil: new Date(0) } });
  await deliverNotification(DB, row.id, d.send);
  assert.equal(d.calls.length, 1); assert.equal(d.calls[0][4].idempotencyKey, 'spreadfast/' + row.id);
  assert.equal(d.calls[0][2], row.html);
  const other = (await mailRows(DB)).find(r => r.id !== row.id);
  await deliverNotification(DB, other.id, async () => ({ success: false }));
  assert.equal((await DB.User.findOne({ id: user.id })).quickAdCredits, 3);
  await DB.EmailNotification.updateOne({ id: other.id }, { $set: { firstAttemptAt: new Date(Date.now() - 24 * 3600000), nextAttemptAt: new Date(0) } });
  await deliverNotification(DB, other.id, d.send);
  assert.equal(d.calls.length, 1); assert.equal((await DB.EmailNotification.findOne({ id: other.id })).status, 'needs_review');
});

test('password confirmation contains no credentials and deduplicates the same change', async () => {
  const DB = quickAdsDb([user]);
  await passwordChanged(DB, { ...user, password: 'secret-password', resetPasswordTokenHash: 'secret-token', tokenVersion: 2 });
  await passwordChanged(DB, { ...user, tokenVersion: 2 });
  const rows = await mailRows(DB); assert.equal(rows.length, 1);
  assert.equal(rows[0].subject, 'Your SpreadFast password was changed'); assert.ok(!JSON.stringify(rows).includes('secret-'));
});

test('Resend adapter handles response errors, exceptions/timeouts and development recipient safety', async () => {
  const calls = [], logs = [];
  const resend = { emails: { send: async (...args) => { calls.push(args); return { data: { id: 'sent' }, error: null }; } } };
  const send = env => createEmailSender({ resend, env, logger: { error: (...args) => logs.push(args) }, timeoutMs: 10 });
  const args = ['real@example.test', 'Subject', '<p>Hello</p>', 'Hello', { idempotencyKey: 'test-key' }];
  for (const env of [{}, { NODE_ENV: 'test', EMAILS_ENABLED: 'true' }, { NODE_ENV: 'production', EMAILS_ENABLED: 'false' }]) assert.equal((await send(env)(...args)).skipped, true);
  assert.equal(calls.length, 0);
  await send({ NODE_ENV: 'development', EMAILS_ENABLED: 'true', EMAIL_TEST_RECIPIENT: 'safe@example.test' })(...args);
  assert.equal(calls[0][0].to, 'safe@example.test'); assert.equal(calls[0][0].text, 'Hello');
  await send({ NODE_ENV: 'production' })(...args); assert.equal(calls[1][0].to, 'real@example.test');
  resend.emails.send = async () => ({ error: { message: 'RESEND_SECRET' } });
  assert.equal((await send({ NODE_ENV: 'production' })(...args)).success, false);
  resend.emails.send = async () => { throw new Error('RESEND_SECRET'); };
  assert.equal((await send({ NODE_ENV: 'production' })(...args)).success, false);
  resend.emails.send = () => new Promise(() => {});
  assert.equal((await send({ NODE_ENV: 'production' })(...args)).success, false);
  assert.ok(!JSON.stringify(logs).includes('RESEND_SECRET'));
});

test('all new templates provide HTML/text and omit sensitive banking fields', () => {
  for (const kind of ['quick_purchase', 'admin_quick_purchase', 'withdrawal_requested', 'admin_withdrawal_requested', 'withdrawal_paid', 'quick_payment_failed', 'quick_low', 'quick_zero', 'password_changed']) {
    const result = renderEmail(kind, { ...user, amount: 1700, credits: 1, balance: 1, reference: 'test-reference', date: new Date().toISOString() });
    assert.ok(result.html.includes('SpreadFast')); assert.ok(result.text.includes('SpreadFast'));
    assert.ok(!JSON.stringify(result).includes('sensitive-bank-number'));
    if (kind.startsWith('admin_')) assert.ok(result.text.includes('/admin-portal'));
  }
});

test('invalid email site configuration falls back without blocking payment notifications', () => {
  const details = { ...user, amount: 1700, credits: 1, balance: 1, reference: 'reference', date: new Date().toISOString() };
  const result = renderEmail('quick_purchase', details, { FRONTEND_URL: 'not a URL', CLIENT_URL: 'javascript:invalid' });
  assert.ok(result.text.includes('https://tryspreadfast.com/promoter/quick-ads'));
});
