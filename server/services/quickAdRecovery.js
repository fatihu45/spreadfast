const { randomUUID } = require('node:crypto');
const { accountSummary, fail } = require('./quickAdCredits');

const recoverable = job => job && !job.deletedAt && job.provider !== 'ai-commercials' &&
  job.status === 'failed' && !!(job.media?.publicId || job.videoRequestId);

async function settleExpired(DB, job, now = Date.now()) {
  if (job?.status !== 'pending' || new Date(job.expiresAt).getTime() > now) return job;
  return DB.withTransaction(async tx => {
    const current = await tx.QuickAdGeneration.findOne({ id: job.id, userId: job.userId });
    if (!current || current.status !== 'pending' || !(new Date(current.expiresAt).getTime() <= now)) return current;
    await tx.QuickAdGeneration.updateOne({ id: current.id, userId: current.userId, status: 'pending' },
      { $set: { status: 'failed', stage: 'failed', failureCode: 'LEASE_EXPIRED' } });
    const user = await tx.User.findOne({ id: current.userId });
    if (user?.quickAdGenerationLock === current.id) await tx.User.updateOne({ id: user.id },
      { $set: { quickAdGenerationLock: null, quickAdGenerationLockExpiresAt: null } });
    return tx.QuickAdGeneration.findOne({ id: current.id, userId: current.userId });
  });
}

async function claimRecovery(DB, { id, userId, now = Date.now() }) {
  return DB.withTransaction(async tx => {
    const doc = await tx.QuickAdGeneration.findOne({ id, userId });
    const job = doc?.toObject ? doc.toObject() : doc;
    if (!recoverable(job)) fail('RECOVERY_UNAVAILABLE', 'This ad has no saved video to recover.', 409);
    const user = await tx.User.findOne({ id: userId });
    const balance = accountSummary(user);
    if (!['company', 'promoter'].includes(user.role) || (user.status && user.status !== 'active')) fail('ACCOUNT_INACTIVE', 'An active account is required.', 403);
    if (user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime() > now) fail('GENERATION_IN_PROGRESS', 'Wait for your current ad to finish.', 409);
    if (job.freePreview ? !balance.freePreviewAvailable : balance.quickAdCredits < (job.creditCost || 1)) fail('NO_QUICK_AD_CREDITS', 'Your account needs credits to finish this saved ad.', 403);
    const executionId = randomUUID(), expiresAt = new Date(now + 12 * 60 * 1000);
    await tx.User.updateOne({ id: userId }, { $set: { quickAdGenerationLock: id, quickAdGenerationLockExpiresAt: expiresAt } });
    await tx.QuickAdGeneration.updateOne({ id, userId, status: 'failed' }, { $set: { status: 'pending', stage: 'finalizing', executionId, expiresAt } });
    return { ...job, status: 'pending', stage: 'finalizing', executionId, expiresAt };
  });
}
module.exports = { recoverable, claimRecovery, settleExpired };
