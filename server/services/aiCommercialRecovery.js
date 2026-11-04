const { randomUUID } = require('node:crypto');
const { accountSummary, fail } = require('./quickAdCredits');
const { canUseQuickAds } = require('./quickAdAccess');

function canRetryFinalization(job) {
  return job?.provider === 'ai-commercials' && job.status === 'failed' && !job.deletedAt &&
    !job.freePreview && job.sceneAssets?.length === 3 &&
    job.sceneAssets.every(scene => scene.videoPublicId && scene.imageUrl);
}

function canRetryCommercial(job, now = Date.now()) {
  job = job?.toObject ? job.toObject() : job;
  const stopped = job?.status === 'failed' || (job?.status === 'pending' && new Date(job.expiresAt).getTime() <= now);
  return !!(job?.provider === 'ai-commercials' && stopped && !job.deletedAt && !job.freePreview &&
    (canRetryFinalization({ ...job, status: 'failed' }) || (job.sourceImageUrl && job.commercialDetails)) &&
    !(job.sceneAssets || []).some(scene => (scene.imageSubmitting && !scene.imageRequestId) || (scene.videoSubmitting && !scene.videoRequestId)));
}

// Claim the existing job, retaining its billing identity and all paid provider assets.
async function claimFinalization(DB, { id, userId, leaseMs, now = Date.now() }) {
  return DB.withTransaction(async tx => {
    const record = await tx.QuickAdGeneration.findOne({ id, userId, provider: 'ai-commercials' });
    const job = record?.toObject ? record.toObject() : record;
    if (!job || job.deletedAt) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
    const user = await tx.User.findOne({ id: userId });
    const account = accountSummary(user);
    if (!canUseQuickAds(user.role) || (user.status && user.status !== 'active')) {
      fail('QUICK_AD_ACCOUNT_REQUIRED', 'An active company or promoter account is required.', 403);
    }
    if (job.status === 'completed') return { generation: job.toObject ? job.toObject() : job, reused: true };
    if (!canRetryCommercial(job, now)) fail('FINALIZATION_NOT_READY', 'This ad cannot be resumed safely. Please contact support.', 409);
    if (user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime() > now) {
      fail('GENERATION_IN_PROGRESS', 'An ad is already being created. Please wait.', 409);
    }
    if (!Number.isSafeInteger(job.creditCost) || job.creditCost < 1) fail('INVALID_CREDIT_COST', 'This commercial needs support before retrying.', 503);
    if (account.quickAdCredits < job.creditCost) fail('NO_QUICK_AD_CREDITS', `You need ${job.creditCost} credits to finish this commercial.`, 403);
    const executionId = randomUUID();
    const stage = canRetryFinalization({ ...job, status: 'failed' }) ? 'finalizing' : 'preparing_image';
    const expiresAt = new Date(now + leaseMs);
    await tx.User.updateOne({ id: userId }, { $set: { quickAdGenerationLock: id, quickAdGenerationLockExpiresAt: expiresAt } });
    await tx.QuickAdGeneration.updateOne({ id, userId, status: job.status }, {
      $set: { status: 'pending', stage, expiresAt, executionId, cancellationRequested: false }
    });
    return { generation: { ...(job.toObject ? job.toObject() : job), status: 'pending', stage, expiresAt, executionId, cancellationRequested: false }, reused: false };
  });
}
module.exports = { canRetryFinalization, canRetryCommercial, claimFinalization };
