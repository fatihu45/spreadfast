const { randomUUID } = require('node:crypto');
const { canUseQuickAds } = require('./quickAdAccess');
const { enqueueEmail } = require('./emailNotifications');

function fail(code, message, statusCode = 409) {
  throw Object.assign(new Error(message), { code, statusCode, quickAdSafe: true });
}
function count(user, field) {
  const value = user[field] === undefined ? 0 : user[field];
  if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_CREDIT_ACCOUNT', 'Your credit account needs support. Please contact us.', 503);
  return value;
}
function accountSummary(user) {
  if (!user) fail('ACCOUNT_NOT_FOUND', 'Account not found.', 404);
  return {
    quickAdCredits: count(user, 'quickAdCredits'),
    quickAdsGenerated: count(user, 'quickAdsGenerated'),
    quickAdTotalCreditsPurchased: count(user, 'quickAdTotalCreditsPurchased'),
    quickAdTotalCreditsUsed: count(user, 'quickAdTotalCreditsUsed'),
    freePreviewAvailable: user.quickAdFreePreviewUsed !== true
  };
}
const plain = doc => doc?.toObject ? doc.toObject() : doc;

// One expiring account lock reserves eligibility, not money. No credit is debited here.
async function beginGeneration(DB, { userId, key, style, model, leaseMs = 12 * 60 * 1000, now = Date.now() }) {
  return DB.withTransaction(async tx => {
    const previous = await tx.QuickAdGeneration.findOne({ userId, idempotencyKey: key });
    if (previous) {
      if (previous.style !== style) fail('GENERATION_KEY_CONFLICT', 'Use a new request for a different ad style.');
      if (previous.status === 'completed') return { generation: plain(previous), reused: true };
      if (previous.status === 'pending' && new Date(previous.expiresAt).getTime() <= now) {
        fail('GENERATION_EXPIRED', 'This generation timed out. Please start a new request.');
      }
      fail(previous.status === 'pending' ? 'GENERATION_IN_PROGRESS' : 'GENERATION_FAILED',
        previous.status === 'pending' ? 'An ad is already being created. Please wait.' : 'This generation failed. Please start a new request.');
    }
    const user = await tx.User.findOne({ id: userId });
    const account = accountSummary(user);
    if (!canUseQuickAds(user.role) || (user.status && user.status !== 'active')) fail('QUICK_AD_ACCOUNT_REQUIRED', 'An active company or promoter account is required.', 403);
    if (user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime() > now) {
      fail('GENERATION_IN_PROGRESS', 'An ad is already being created. Please wait.');
    }
    if (!account.freePreviewAvailable && account.quickAdCredits < 1) {
      fail('NO_QUICK_AD_CREDITS', 'You need Quick Ads credits to generate another ad.', 403);
    }
    if (user.quickAdGenerationLock) {
      await tx.QuickAdGeneration.updateOne({ id: user.quickAdGenerationLock, status: 'pending' },
        { $set: { status: 'failed', failureCode: 'LEASE_EXPIRED' } });
    }
    const generation = { id: randomUUID(), userId, idempotencyKey: key, style, model,
      provider: 'fal', status: 'pending', freePreview: account.freePreviewAvailable,
      creditUsed: false, downloadable: false, expiresAt: new Date(now + leaseMs) };
    await tx.User.updateOne({ id: userId }, { $set: {
      quickAdGenerationLock: generation.id, quickAdGenerationLockExpiresAt: generation.expiresAt
    } });
    await tx.QuickAdGeneration.create(generation);
    return { generation, reused: false };
  });
}

async function finishGeneration(DB, { userId, id, imageUrl, media, now = Date.now() }) {
  return DB.withTransaction(async tx => {
    const generation = await tx.QuickAdGeneration.findOne({ id, userId });
    if (!generation) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
    if (generation.status === 'completed') return plain(generation);
    const user = await tx.User.findOne({ id: userId });
    const account = accountSummary(user);
    if (generation.status !== 'pending' || user.quickAdGenerationLock !== id || new Date(generation.expiresAt).getTime() <= now) {
      fail('GENERATION_EXPIRED', 'This generation timed out. No credit was used.');
    }
    if (!media?.publicId || !media.outputUrl || (generation.freePreview && !media.previewUrl)) {
      fail('MEDIA_NOT_READY', 'Your video could not be prepared. No credit was used.', 502);
    }
    const free = generation.freePreview;
    if (free ? !account.freePreviewAvailable : account.quickAdCredits < 1) fail('CREDIT_CONFLICT', 'Your credit account changed. No credit was used.');
    if (account.quickAdsGenerated >= Number.MAX_SAFE_INTEGER || (!free && account.quickAdTotalCreditsUsed >= Number.MAX_SAFE_INTEGER)) {
      fail('INVALID_CREDIT_ACCOUNT', 'Your credit account needs support.', 503);
    }
    await tx.User.updateOne({ id: userId }, { $set: {
      quickAdGenerationLock: null, quickAdGenerationLockExpiresAt: null,
      ...(free ? { quickAdFreePreviewUsed: true } : {})
    }, $inc: { quickAdsGenerated: 1, ...(!free ? { quickAdCredits: -1, quickAdTotalCreditsUsed: 1 } : {}) } });
    const completed = { status: 'completed', imageUrl, media, creditUsed: !free, downloadable: !free, completedAt: new Date(now) };
    await tx.QuickAdGeneration.updateOne({ id, userId }, { $set: completed });
    if (!free) {
      const balance = account.quickAdCredits - 1;
      const field = balance === 1 ? 'quickAdsLowCreditNotified' : balance === 0 ? 'quickAdsZeroCreditNotified' : null;
      if (field && !user[field]) {
        await tx.User.updateOne({ id: userId }, { $set: { [field]: true } });
        await enqueueEmail(tx, balance === 1 ? 'quick_low' : 'quick_zero', id, user, { balance });
      }
    }
    return { ...plain(generation), ...completed };
  });
}

async function failGeneration(DB, { userId, id, code = 'GENERATION_FAILED' }) {
  return DB.withTransaction(async tx => {
    const generation = await tx.QuickAdGeneration.findOne({ id, userId });
    if (!generation || generation.status !== 'pending') return;
    await tx.QuickAdGeneration.updateOne({ id, userId }, { $set: { status: 'failed', failureCode: code } });
    const user = await tx.User.findOne({ id: userId });
    if (user?.quickAdGenerationLock === id) await tx.User.updateOne({ id: userId }, {
      $set: { quickAdGenerationLock: null, quickAdGenerationLockExpiresAt: null }
    });
  });
}
module.exports = { accountSummary, beginGeneration, finishGeneration, failGeneration, fail };
