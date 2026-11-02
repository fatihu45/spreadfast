const { accountSummary, fail } = require('./quickAdCredits');
const { canUseQuickAds } = require('./quickAdAccess');

function canRetryFinalization(job) {
  return job?.provider === 'ai-commercials' && job.status === 'failed' && !job.deletedAt &&
    !job.freePreview && job.sceneAssets?.length === 3 &&
    job.sceneAssets.every(scene => scene.videoPublicId && scene.imageUrl);
}

// Claim the existing job, retaining its billing identity and all paid provider assets.
async function claimFinalization(DB, { id, userId, leaseMs, now = Date.now() }) {
  return DB.withTransaction(async tx => {
    const job = await tx.QuickAdGeneration.findOne({ id, userId, provider: 'ai-commercials' });
    if (!job || job.deletedAt) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
    const user = await tx.User.findOne({ id: userId });
    const account = accountSummary(user);
    if (!canUseQuickAds(user.role) || (user.status && user.status !== 'active')) {
      fail('QUICK_AD_ACCOUNT_REQUIRED', 'An active company or promoter account is required.', 403);
    }
    if (job.status === 'completed') return { generation: job.toObject ? job.toObject() : job, reused: true };
    if (!canRetryFinalization(job)) fail('FINALIZATION_NOT_READY', 'This ad is not ready for a finalization retry.', 409);
    if (user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime() > now) {
      fail('GENERATION_IN_PROGRESS', 'An ad is already being created. Please wait.', 409);
    }
    if (!Number.isSafeInteger(job.creditCost) || job.creditCost < 1) fail('INVALID_CREDIT_COST', 'This commercial needs support before retrying.', 503);
    if (account.quickAdCredits < job.creditCost) fail('NO_QUICK_AD_CREDITS', `You need ${job.creditCost} credits to finish this commercial.`, 403);
    const expiresAt = new Date(now + leaseMs);
    await tx.User.updateOne({ id: userId }, { $set: { quickAdGenerationLock: id, quickAdGenerationLockExpiresAt: expiresAt } });
    await tx.QuickAdGeneration.updateOne({ id, userId, status: 'failed' }, {
      $set: { status: 'pending', stage: 'finalizing', expiresAt }
    });
    return { generation: { ...(job.toObject ? job.toObject() : job), status: 'pending', stage: 'finalizing', expiresAt }, reused: false };
  });
}
module.exports = { canRetryFinalization, claimFinalization };
