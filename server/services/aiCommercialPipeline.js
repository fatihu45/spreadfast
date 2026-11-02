const { randomUUID } = require('node:crypto');
const { validateCreativePlan, continuityDirection, SCENE_DURATIONS } = require('./aiCommercialProviders');
const { finishGeneration, failGeneration, accountSummary, fail } = require('./quickAdCredits');
const { PREVIEW_TRANSFORMATION } = require('./quickAdMedia');
const MAX_MS = 15 * 60 * 1000;
const MAX_RECOVERIES = 2;

// Reacquire the existing account-wide reservation, never create a second job or
// change its original price/model. Mongo transactions serialize concurrent retries.
async function reserveRecovery(db, userId, id) {
  return db.withTransaction(async tx => {
    const job = await tx.QuickAdGeneration.findOne({ id, userId, provider: 'ai-commercials' });
    if (!job || job.deletedAt) fail('NOT_FOUND', 'Ad not found.', 404);
    if (job.status !== 'failed' && !(job.status === 'pending' && new Date(job.expiresAt).getTime() <= Date.now())) fail('BUSY', 'This ad is already processing or completed.');
    if (!job.sourceImageUrl || (job.recoveryCount || 0) >= MAX_RECOVERIES) fail('RECOVERY_LIMIT', 'Recovery is unavailable. Please contact support.');
    const user = await tx.User.findOne({ id: userId });
    const balance = accountSummary(user);
    if (user.quickAdGenerationLock && new Date(user.quickAdGenerationLockExpiresAt).getTime() > Date.now()) fail('BUSY', 'An ad is already processing.');
    if (job.freePreview ? !balance.freePreviewAvailable : balance.quickAdCredits < job.creditCost) fail('NO_CREDITS', 'Your original preview or credit reservation is no longer available.', 403);
    const expiresAt = new Date(Date.now() + MAX_MS + 60000);
    await tx.User.updateOne({ id: userId }, { $set: { quickAdGenerationLock: id, quickAdGenerationLockExpiresAt: expiresAt } });
    const patch = { runToken: randomUUID(), status: 'pending', stage: 'queued', expiresAt, recoveryCount: (job.recoveryCount || 0) + 1 };
    await tx.QuickAdGeneration.updateOne({ id, userId }, { $set: patch });
    return { ...(job.toObject ? job.toObject() : job), ...patch };
  });
}

async function runCommercial(db, job, dependencies) {
  const { cloudinary, createPlan, generateImage, generateVideo, persistVideo, assemble, brandingRender, uploadSceneImage, logger } = dependencies;
  const signal = AbortSignal.timeout(MAX_MS);
  const query = { id: job.id, userId: job.userId, status: 'pending', runToken: job.runToken };
  const save = async patch => {
    signal.throwIfAborted();
    const result = await db.QuickAdGeneration.updateOne(query, { $set: patch });
    if (!result.matchedCount) throw new Error('Commercial lease no longer active.');
    Object.assign(job, patch);
  };
  try {
    const details = job.commercialInput || job.commercialDetails;
    if (!job.creativePlan) {
      await save({ stage: 'preparing_image' });
      const plan = validateCreativePlan(await createPlan({ ...details, style: job.style, imageUrl: job.sourceImageUrl }));
      // Only explicit user text can be burned into the finished video.
      plan.finalCta = details.contact || '';
      await save({ creativePlan: plan });
    }
    const plan = validateCreativePlan(job.creativePlan);
    const direction = continuityDirection(plan, details.specifications);
    const scenes = (job.sceneAssets || []).map(s => s.toObject ? s.toObject() : { ...s });
    for (let index = 0; index < 3; index++) {
      const scene = plan.scenes[index];
      const asset = scenes[index] ||= { durationSeconds: SCENE_DURATIONS[index], purpose: scene.purpose };
      const checkpoint = () => save({ sceneAssets: scenes });
      await save({ stage: 'creating_scene', sceneIndex: index + 1 });
      if (!asset.imageUrl) {
        if (!asset.generatedImageUrl) {
          if (asset.imageAttempted && !asset.imageRequestId) throw new Error('Image submission outcome unknown; support must reconcile it.');
          asset.imageAttempted = true;
          await checkpoint();
          const result = await generateImage({ imageUrl: job.sourceImageUrl, referenceImageUrl: index > 0 ? scenes[0].imageUrl : undefined,
            prompt: `${direction}\nThe first reference is the product truth; the second, if present, supplies campaign lighting and palette only.\nComposition: ${scene.composition}\n${scene.imagePrompt}`,
            signal, requestId: asset.imageRequestId,
            onSubmitted: async id => { asset.imageRequestId = id; await checkpoint(); } });
          asset.generatedImageUrl = result.imageUrl;
          asset.imageRequestId = result.requestId;
          await checkpoint();
        }
        const image = await uploadSceneImage(asset.generatedImageUrl, `${job.id}-scene-${index + 1}`, signal);
        asset.imageUrl = image.secure_url;
        asset.imagePublicId = image.public_id;
        await checkpoint();
      }
      await save({ stage: 'creating_video' });
      if (!asset.videoPublicId) {
        if (!asset.generatedVideoUrl) {
          if (asset.videoAttempted && !asset.videoRequestId) throw new Error('Video submission outcome unknown; support must reconcile it.');
          asset.videoAttempted = true;
          await checkpoint();
          const video = await generateVideo({ imageUrl: asset.imageUrl,
            prompt: `${direction}\nCamera: ${scene.cameraMovement}\n${scene.motionPrompt}`,
            tier: details.tier, signal, requestId: asset.videoRequestId,
            onSubmitted: async id => { asset.videoRequestId = id; await checkpoint(); } });
          asset.generatedVideoUrl = video.videoUrl;
          asset.videoRequestId = video.requestId;
          await checkpoint();
        }
        const media = await persistVideo(cloudinary, asset.generatedVideoUrl, { id: `${job.id}-scene-${index + 1}`, freePreview: false }, signal);
        asset.videoPublicId = media.publicId;
        asset.videoUrl = media.outputUrl;
        await checkpoint();
      }
    }
    await save({ stage: 'finalizing', imageUrl: scenes[0].imageUrl });
    if (!job.assembledMedia) {
      const clips = scenes.map(s => ({ publicId: s.videoPublicId, durationSeconds: s.durationSeconds }));
      const text = [details.brandName, details.contact].filter(Boolean).join(' · ');
      const assembled = await assemble(cloudinary, clips, job.id, text);
      await save({ assembledMedia: assembled });
    }
    if (!job.media?.publicId) {
      const media = await persistVideo(cloudinary, job.assembledMedia.outputUrl, { id: job.id, freePreview: job.freePreview }, signal);
      if (!Number.isFinite(media.durationSeconds) || media.durationSeconds < 20 || media.durationSeconds > 24.1) throw new Error('Final video duration is outside 20–24 seconds.');
      await save({ media, durationSeconds: media.durationSeconds });
    }
    await save({ stage: 'finishing' });
    const branding = job.branding || { mode: 'none' };
    if (branding.mode !== 'none' && job.brandingStatus !== 'applied') {
      // Retain the unbranded output and all clips if this operation fails. Recovery
      // never calls image/video generation again and does not debit twice.
      const media = await brandingRender(cloudinary, job, branding, PREVIEW_TRANSFORMATION);
      await save({ media, brandingStatus: 'applied' });
    }
    signal.throwIfAborted();
    return await finishGeneration(db, { userId: job.userId, id: job.id, imageUrl: scenes[0].imageUrl, media: job.media, runToken: job.runToken, brandingStatus: branding.mode === 'none' ? 'none' : 'applied' });
  } catch (error) {
    await failGeneration(db, { userId: job.userId, id: job.id, runToken: job.runToken, code: ['finalizing', 'finishing'].includes(job.stage) ? 'ASSEMBLY_FAILED' : 'GENERATION_FAILED' });
    logger.error('[AI Commercials] Pipeline stopped', { generationId: job.id, stage: job.stage, code: error.code || 'GENERATION_FAILED' });
    throw error;
  }
}
module.exports = { runCommercial, reserveRecovery, MAX_RECOVERIES };
