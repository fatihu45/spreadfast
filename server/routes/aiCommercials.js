const express = require('express');
const multer = require('multer');
const { randomUUID } = require('node:crypto');
const { claimFinalization, canRetryFinalization } = require('../services/aiCommercialRecovery');
const cloudinaryDefault = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');
const { quickAdAccountOnly } = require('../services/quickAdAccess');
const { beginGeneration, finishGeneration, failGeneration, accountSummary } = require('../services/quickAdCredits');
const { storeVideo, assembleVideos, publicGeneration, PREVIEW_TRANSFORMATION } = require('../services/quickAdMedia');
const { readBranding, uploadBranding, renderBranding } = require('../services/quickAdBranding');
const {
  createCreativePlan,
  normalizeScenes,
  generateNanoBananaImage,
  generateVeoClip,
  IMAGE_MODEL,
  VEO_MODELS
} = require('../services/aiCommercialProviders');

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const TIER_COST = Object.freeze({ standard: 4, premium: 7 });
const VALID_STYLES = new Set(['auto', 'cinematic', 'showcase', 'lifestyle', 'promo']);
const MAX_GENERATION_MS = 15 * 60 * 1000;

function cleanText(value, maxLength = 500) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function isValidImage(file) {
  const bytes = file?.buffer;
  if (!bytes?.length) return false;
  if (file.mimetype === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return file.mimetype === 'image/webp' && bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function uploadImage(client, file, folder, publicId, signal) {
  return new Promise((resolve, reject) => {
    let stream;
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const abort = () => {
      stream?.destroy();
      cleanup();
      reject(signal.reason || new Error('Image upload aborted.'));
    };
    try {
      if (signal?.aborted) return abort();
      stream = client.uploader.upload_stream({
        resource_type: 'image',
        folder,
        public_id: publicId,
        overwrite: false,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        timeout: 120000
      }, (error, result) => {
        cleanup();
        if (error) reject(error);
        else resolve(result);
      });
      stream.on('error', error => { cleanup(); reject(error); });
      signal?.addEventListener('abort', abort, { once: true });
      stream.end(file.buffer);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

async function readImageResponse(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The image provider returned an unreadable image.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new Error('The generated scene image exceeded the supported size.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function loadUserBalance(req) {
  const user = await req.app.locals.db.User.findOne({ id: req.user.id });
  if (!user) throw Object.assign(new Error('Account not found.'), { statusCode: 404 });
  return user;
}

function createAiCommercialsRouter({
  cloudinary = cloudinaryDefault,
  authenticate = authenticateToken,
  createPlan = createCreativePlan,
  generateImage = generateNanoBananaImage,
  generateVideo = generateVeoClip,
  persistVideo = storeVideo,
  assemble = assembleVideos,
  brandingUpload = uploadBranding,
  brandingRender = renderBranding,
  logger = console
} = {}) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 5, fields: 8, fieldSize: 4096 },
    fileFilter: (req, file, callback) => {
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
      else callback(Object.assign(new Error('Unsupported image'), { code: 'INVALID_IMAGE_TYPE' }));
    }
  }).fields([{ name: 'productImage', maxCount: 4 }, { name: 'logo', maxCount: 1 }]);
  const parseUpload = (req, res, next) => upload(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Images must be 8 MB or smaller.' });
    if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ success: false, message: 'Upload up to four product images and, optionally, one logo.' });
    return res.status(400).json({ success: false, message: 'Upload valid JPG, PNG, or WEBP images.' });
  });

  router.use(authenticate);
  router.use(quickAdAccountOnly);

  router.get('/credits', async (req, res) => {
    try {
      const summary = accountSummary(await loadUserBalance(req));
      return res.json({
        success: true,
        ...summary,
        freePreviewAvailable: false,
        requiredCredits: TIER_COST.standard,
        available: summary.quickAdCredits,
        tierCredits: TIER_COST
      });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Could not load credits.' });
    }
  });

  router.get('/jobs', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const [rows, user] = await Promise.all([
        db.QuickAdGeneration.find({ userId: req.user.id, provider: 'ai-commercials', deletedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(50),
        loadUserBalance(req)
      ]);
      return res.json({ success: true, jobs: rows.map(row => publicGeneration(row, user)) });
    } catch (error) {
      return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Could not load ad history.' });
    }
  });

  // Edit and delete only AI-commercial records owned by the authenticated user.
  router.patch('/jobs/:id', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const productName = cleanText(req.body?.productName, 100);
      const brandName = cleanText(req.body?.brandName, 100);
      const contact = cleanText(req.body?.contact, 120);
      const specifications = cleanText(req.body?.specifications, 500);
      const job = await db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials', deletedAt: { $exists: false } });
      if (!job) return res.status(404).json({ success: false, message: 'Ad not found.' });
      if (job.status === 'pending') return res.status(409).json({ success: false, message: 'Wait for generation to finish before editing this ad.' });
      const current = job.commercialDetails || {};
      const updatedDetails = { ...current, productName, brandName, contact, specifications };
      const updated = await db.QuickAdGeneration.updateOne(
        { id: req.params.id, userId: req.user.id, provider: 'ai-commercials', status: job.status, deletedAt: { $exists: false } },
        { $set: { commercialDetails: updatedDetails } }
      );
      if (!updated.matchedCount) return res.status(409).json({ success: false, message: 'This ad changed. Refresh and try again.' });
      return res.json({ success: true, message: 'Ad details updated.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Could not update this ad.' });
    }
  });

  router.delete('/jobs/:id', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const job = await db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials', deletedAt: { $exists: false } });
      if (!job) return res.status(404).json({ success: false, message: 'Ad not found.' });
      if (job.status === 'pending') return res.status(409).json({ success: false, message: 'Wait for generation to finish before deleting this ad.' });
      const deleted = await db.QuickAdGeneration.updateOne(
        { id: req.params.id, userId: req.user.id, provider: 'ai-commercials', status: job.status, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } }
      );
      if (!deleted.matchedCount) return res.status(409).json({ success: false, message: 'This ad changed. Refresh and try again.' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Could not delete this ad.' });
    }
  });

  function cancelled() { return Object.assign(new Error('Commercial cancelled. No credits were charged.'), { code: 'USER_CANCELLED', statusCode: 409, quickAdSafe: true }); }

  function watchJob(db, generation, controller) {
    let checking = false;
    const timer = setInterval(async () => {
      if (checking) return;
      checking = true;
      try { await ensureActive(db, generation, controller.signal); }
      catch (error) { controller.abort(error); }
      finally { checking = false; }
    }, 1000);
    return () => clearInterval(timer);
  }

  async function ensureActive(db, generation, signal) {
    signal.throwIfAborted();
    const current = await db.QuickAdGeneration.findOne({ id: generation.id, userId: generation.userId });
    if (current?.cancellationRequested) throw cancelled();
    if (!current || current.status !== 'pending' || current.executionId !== generation.executionId || new Date(current.expiresAt).getTime() <= Date.now()) {
      throw Object.assign(new Error('This attempt is no longer active.'), { code: 'GENERATION_EXPIRED' });
    }
  }

  async function checkpoint(db, generation, fields) {
    const result = await db.QuickAdGeneration.updateOne({ id: generation.id, userId: generation.userId,
      status: 'pending', executionId: generation.executionId }, { $set: fields });
    if (!result.matchedCount) throw Object.assign(new Error('This attempt is no longer active.'), { code: 'GENERATION_EXPIRED' });
    Object.assign(generation, fields);
  }

  router.post('/jobs/:id/cancel', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const result = await db.withTransaction(async tx => {
        const job = await tx.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials' });
        if (!job || job.deletedAt) return { status: 404, message: 'Ad not found.' };
        if (job.status === 'completed') return { status: 409, message: 'This commercial has already completed.' };
        if (job.status === 'failed') return { status: 200, message: 'This commercial has already stopped. No credits were charged.' };
        const expired = new Date(job.expiresAt).getTime() <= Date.now();
        await tx.QuickAdGeneration.updateOne({ id: job.id, userId: req.user.id }, { $set: {
          cancellationRequested: true, ...(expired ? { status: 'failed', stage: 'failed', failureCode: 'USER_CANCELLED' } : {})
        } });
        if (expired) {
          const user = await tx.User.findOne({ id: req.user.id });
          if (user?.quickAdGenerationLock === job.id) await tx.User.updateOne({ id: req.user.id }, { $set: { quickAdGenerationLock: null, quickAdGenerationLockExpiresAt: null } });
        }
        return { status: 200, message: expired ? 'Commercial cancelled. No credits were charged.' : 'Cancellation requested. No credits will be charged.' };
      });
      return res.status(result.status).json({ success: result.status === 200, message: result.message });
    } catch { return res.status(503).json({ success: false, message: 'Could not cancel this commercial. Please try again.' }); }
  });

  async function continueCommercial(db, generation, signal) {
    await ensureActive(db, generation, signal);
    if (canRetryFinalization({ ...generation, status: 'failed' })) return finalizeCommercial(db, generation, signal);
    const details = generation.creativePlan?.inputDetails || generation.commercialDetails || {};
    const sourceImageUrl = generation.sourceImageUrl;
    const imageUrls = generation.sourceImageUrls?.length ? generation.sourceImageUrls : [sourceImageUrl];
    let plan = generation.creativePlan;
    if (!plan) {
      await checkpoint(db, generation, { stage: 'preparing_image' });
      plan = await createPlan({ ...details, style: generation.style, imageUrl: sourceImageUrl, imageUrls, signal });
      await ensureActive(db, generation, signal);
      plan.scenes = normalizeScenes(plan?.scenes);
      plan.inputDetails = details;
      await checkpoint(db, generation, { creativePlan: plan, commercialDetails: { ...details,
        title: plan.title, voiceover: plan.voiceover, endCard: details.contact || [details.brandName, details.productName].filter(Boolean).join(' · ') || 'Discover more' } });
    }
    // Validate all directions before paying for any media, even when resuming saved work.
    plan.scenes = normalizeScenes(plan.scenes);
    const scenes = (generation.sceneAssets || []).map(scene => scene.toObject ? scene.toObject() : { ...scene });
    for (const [index, scene] of plan.scenes.entries()) {
      await ensureActive(db, generation, signal);
      const asset = scenes[index] ||= { durationSeconds: scene.durationSeconds, purpose: scene.purpose };
      const save = () => checkpoint(db, generation, { sceneAssets: scenes });
      const resumeProvider = async (kind, action) => {
        const savedRequestId = asset[`${kind}RequestId`];
        try { return await action(); }
        catch (error) {
          if (!savedRequestId || !error.providerTerminal) throw error;
          // A user-initiated resume may replace a definitively failed/cancelled job,
          // once. Never replace a request merely because polling lost connectivity.
          await ensureActive(db, generation, signal);
          asset[`${kind}RequestId`] = undefined;
          asset[`${kind}Submitting`] = true;
          await save();
          return action();
        }
      };
      if (!asset.imageUrl) {
        await checkpoint(db, generation, { stage: 'creating_scene' });
        if (!asset.generatedImageUrl) {
          if (asset.imageSubmitting && !asset.imageRequestId) throw new Error('A provider submission needs reconciliation.');
          asset.imageModel ||= IMAGE_MODEL;
          asset.imageSubmitting = true;
          await save();
          try {
            const generated = await resumeProvider('image', () => generateImage({ imageUrl: sourceImageUrl, imageUrls,
              prompt: [scene.imagePrompt, 'Preserve the product identity, proportions, colors, packaging, labels, and branding exactly.',
                details.specifications ? `Customer brief (apply relevant visual details; do not render this text): ${details.specifications}` : ''].filter(Boolean).join('\n'),
              model: asset.imageModel, requestId: asset.imageRequestId, signal,
              onSubmitted: async id => { asset.imageRequestId = id; await save(); }
            }));
            asset.generatedImageUrl = generated.imageUrl;
            asset.imageRequestId = generated.requestId;
            asset.imageSubmitting = false;
            await save();
          } catch (error) {
            if (error.providerTerminal) { asset.imageSubmitting = false; asset.imageRequestId = undefined; await save(); }
            throw error;
          }
        }
        await ensureActive(db, generation, signal);
        const response = await fetch(asset.generatedImageUrl, { signal });
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('The scene image could not be downloaded.');
        const buffer = await readImageResponse(response, 12 * 1024 * 1024);
        if (!buffer.length) throw new Error('The scene image was empty.');
        const stored = await uploadImage(cloudinary, { buffer, mimetype: 'image/png' }, 'spreadfast/ai-commercials/scenes', `${generation.id}-scene-${index + 1}`, signal);
        if (!stored?.secure_url?.startsWith('https://')) throw new Error('The scene image could not be saved.');
        asset.imageUrl = stored.secure_url; asset.imagePublicId = stored.public_id;
        await save();
      }
      if (!asset.videoPublicId) {
        await ensureActive(db, generation, signal);
        await checkpoint(db, generation, { stage: 'creating_video' });
        if (!asset.generatedVideoUrl) {
          if (asset.videoSubmitting && !asset.videoRequestId) throw new Error('A provider submission needs reconciliation.');
          asset.videoModel ||= VEO_MODELS[details.tier || 'standard'];
          asset.videoSubmitting = true;
          await save();
          try {
            const spoken = scene.narration ? `Use a calm, warm, consistent narrator voice. Speak only this scene's script: ${JSON.stringify(scene.narration)}. No extra dialogue.` : 'No spoken dialogue. Use subtle ambient sound only.';
            const video = await resumeProvider('video', () => generateVideo({ imageUrl: asset.imageUrl, prompt: [spoken, scene.motionPrompt].join('\n'),
              durationSeconds: asset.durationSeconds, tier: details.tier || 'standard', model: asset.videoModel,
              requestId: asset.videoRequestId, signal, onSubmitted: async id => { asset.videoRequestId = id; await save(); } }));
            asset.generatedVideoUrl = video.videoUrl; asset.videoRequestId = video.requestId; asset.videoSubmitting = false;
            await save();
          } catch (error) {
            if (error.providerTerminal) { asset.videoSubmitting = false; asset.videoRequestId = undefined; await save(); }
            throw error;
          }
        }
        await ensureActive(db, generation, signal);
        const media = await persistVideo(cloudinary, asset.generatedVideoUrl, { id: `${generation.id}-scene-${index + 1}`, freePreview: false }, signal);
        asset.videoPublicId = media.publicId;
        await save();
      }
      await checkpoint(db, generation, { commercialImage: { url: scenes[0].imageUrl, publicId: scenes[0].imagePublicId,
        model: scenes[0].imageModel, requestId: scenes[0].imageRequestId }, imageUrl: scenes[0].imageUrl });
    }
    await checkpoint(db, generation, { stage: 'finalizing' });
    return finalizeCommercial(db, generation, signal);
  }

  async function finalizeCommercial(db, generation, signal) {
    const details = generation.commercialDetails || {};
    const branding = generation.branding || { mode: 'none' };
    let media = generation.media?.toObject ? generation.media.toObject() : generation.media;
    await ensureActive(db, generation, signal);
    if (!media?.publicId || !media.outputUrl) {
      const assembled = await assemble(cloudinary,
        generation.sceneAssets.map(scene => ({ publicId: scene.videoPublicId, durationSeconds: scene.durationSeconds })),
        generation.id, details.endCard || details.contact || [details.brandName, details.productName].filter(Boolean).join(' · ') || 'Discover more');
      await ensureActive(db, generation, signal);
      media = await persistVideo(cloudinary, assembled.outputUrl, { id: generation.id, freePreview: false }, signal);
      // Save the protected original before optional branding. A retry needs no fal calls.
      media = { ...media, originalOutputUrl: media.outputUrl };
      await checkpoint(db, generation, { media });
    }
    if (branding.mode !== 'none' && generation.brandingStatus !== 'applied') {
      media = await brandingRender(cloudinary, { ...generation, media, freePreview: false }, branding, PREVIEW_TRANSFORMATION);
      await ensureActive(db, generation, signal);
      await checkpoint(db, generation, { media, brandingStatus: 'applied' });
    }
    await ensureActive(db, generation, signal);
    return finishGeneration(db, { userId: generation.userId, id: generation.id, executionId: generation.executionId,
      imageUrl: generation.sceneAssets[0].imageUrl, media,
      brandingStatus: branding.mode === 'none' ? 'none' : 'applied' });
  }

  router.post('/jobs/:id/retry', async (req, res) => {
    const db = req.app.locals.db;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('Finalization timed out.')), MAX_GENERATION_MS);
    let claimed;
    let stopWatching = () => {};
    try {
      const reservation = await claimFinalization(db, { id: req.params.id, userId: req.user.id, leaseMs: MAX_GENERATION_MS + 60000 });
      if (!reservation.reused) { claimed = reservation.generation; stopWatching = watchJob(db, claimed, controller); }
      const completed = reservation.reused ? reservation.generation : await continueCommercial(db, claimed, controller.signal);
      const user = await loadUserBalance(req);
      return res.json({ ...publicGeneration(completed, user), reused: reservation.reused });
    } catch (error) {
      if (controller.signal.reason?.code === 'USER_CANCELLED') error = controller.signal.reason;
      if (claimed) {
        try { await failGeneration(db, { userId: req.user.id, id: claimed.id, executionId: claimed.executionId, code: claimed.stage === 'finalizing' ? 'ASSEMBLY_FAILED' : 'GENERATION_FAILED' }); }
        catch { logger.error('[AI Commercials] Retry cleanup failed', { generationId: claimed.id }); }
      }
      logger.error('[AI Commercials] Resume failed', { generationId: claimed?.id, stage: claimed?.stage, code: error.code || 'GENERATION_FAILED' });
      return res.status(error.statusCode || 502).json({ success: false,
        message: error.code === 'USER_CANCELLED' ? 'Commercial cancelled. No credits were charged.' : error.quickAdSafe ? error.message : 'Could not finish this commercial. Your saved scenes are safe; no credits were charged. Retry from My Ads.' });
    } finally { clearTimeout(timer); stopWatching(); }
  });

  router.post('/generate', parseUpload, async (req, res) => {
    const db = req.app.locals.db;
    const controller = new AbortController();
    let generation;
    let stopWatching = () => {};
    let stage = 'validation';
    const timer = setTimeout(() => controller.abort(new Error('Generation timed out.')), MAX_GENERATION_MS);
    try {
      const productImages = req.files?.productImage || [];
      const logoFile = req.files?.logo?.[0];
      if (!productImages.length || !productImages.every(isValidImage)) {
        return res.status(400).json({ success: false, message: 'A valid product JPG, PNG, or WEBP image is required.' });
      }
      if (logoFile && !isValidImage(logoFile)) {
        return res.status(400).json({ success: false, message: 'The logo must be a valid JPG, PNG, or WEBP image.' });
      }

      const productName = cleanText(req.body?.productName, 100);
      const brandName = cleanText(req.body?.brandName, 100);
      const contact = cleanText(req.body?.contact, 120);
      const specifications = cleanText(req.body?.specifications, 500);
      const style = cleanText(req.body?.style, 30) || 'auto';
      const tier = cleanText(req.body?.tier || 'standard', 20);
      const requiredCredits = TIER_COST[tier];
      if (!VALID_STYLES.has(style)) return res.status(400).json({ success: false, message: 'Choose a valid creative style.' });
      if (!requiredCredits) return res.status(400).json({ success: false, message: 'Select a valid generation tier.' });
      const brandingRequest = logoFile
        ? readBranding({ brandingMode: 'logo' }, logoFile)
        : { mode: 'none' };

      const user = await loadUserBalance(req);
      const key = req.headers['idempotency-key'] || randomUUID();
      const reservation = await beginGeneration(db, {
        userId: req.user.id,
        key,
        style,
        model: `${IMAGE_MODEL}+${VEO_MODELS[tier]}`,
        creditCost: requiredCredits,
        allowFreePreview: false,
        provider: 'ai-commercials',
        executionId: randomUUID(),
        leaseMs: MAX_GENERATION_MS + 60 * 1000
      });
      generation = reservation.generation;
      if (reservation.reused && generation.status === 'completed') {
        return res.json({ success: true, ...publicGeneration(generation, user), reused: true });
      }

      stopWatching = watchJob(db, generation, controller);
      stage = 'upload';
      const sources = [];
      for (const file of productImages) {
        await ensureActive(db, generation, controller.signal);
        const source = await uploadImage(cloudinary, file, 'spreadfast/ai-commercials/products', randomUUID(), controller.signal);
        if (!source?.secure_url?.startsWith('https://')) throw new Error('The product image could not be uploaded.');
        sources.push(source.secure_url);
      }
      const uploadedLogo = logoFile
        ? await brandingUpload(cloudinary, brandingRequest, logoFile)
        : brandingRequest;
      const sourceImageUrl = sources[0];
      await checkpoint(db, generation, {
        sourceImageUrl, sourceImageUrls: sources, stage: 'preparing_image',
        commercialDetails: { productName, brandName, contact, specifications, tier, requiredCredits },
        branding: uploadedLogo, brandingStatus: uploadedLogo.mode === 'none' ? 'none' : 'pending'
      });
      stage = 'creative_plan';
      const completed = await continueCommercial(db, generation, controller.signal);
      generation = completed;
      const latestUser = await db.User.findOne({ id: req.user.id });
      return res.json({
        success: true,
        completed: true,
        ...publicGeneration(completed, latestUser)
      });
    } catch (error) {
      if (controller.signal.reason?.code === 'USER_CANCELLED') error = controller.signal.reason;
      if (generation?.status === 'pending') {
        try {
          await failGeneration(db, { userId: req.user.id, id: generation.id, executionId: generation.executionId, code: generation.stage === 'finalizing' ? 'ASSEMBLY_FAILED' : 'GENERATION_FAILED' });
        } catch (cleanupError) {
          logger.error('[AI Commercials] Failed to release generation lock', {
            generationId: generation.id,
            code: cleanupError.code || 'CREDIT_CLEANUP_FAILED'
          });
        }
      }
      stage = generation?.stage === 'preparing_image' ? 'creative_plan' : generation?.stage || stage;
      logger.error('[AI Commercials] Generation failed', {
        generationId: generation?.id,
        stage,
        code: error.code || 'GENERATION_FAILED',
        ...(Number.isInteger(error.providerStatus) ? { providerStatus: error.providerStatus } : {})
      });
      stage = generation?.stage === 'preparing_image' ? 'creative_plan' : generation?.stage || stage;
      const status = error.statusCode || (error.code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502);
      return res.status(status).json({
        success: false,
        ...(error.quickAdSafe ? { code: error.code } : {}),
        message: error.code === 'USER_CANCELLED' ? 'Commercial cancelled. No credits were charged.' : error.code === 'AI_PROVIDER_NOT_CONFIGURED'
          ? 'AI commercial generation is not configured on the server.'
          : stage === 'creative_plan'
            ? 'We could not prepare your commercial. No credits were charged. Please try again shortly.'
          : error.quickAdSafe && error.statusCode < 500
            ? error.message
            : stage === 'finalizing'
              ? 'Your scenes were saved, but the final video could not be finished. No credits were charged. Open My Ads and retry finishing.'
              : 'The commercial could not be completed. No credits were charged. Open My Ads to resume saved work.'
      });
    } finally {
      clearTimeout(timer);
      stopWatching();
      for (const file of req.files?.productImage || []) delete file.buffer;
      if (req.files?.logo?.[0]) delete req.files.logo[0].buffer;
    }
  });

  return router;
}

module.exports = createAiCommercialsRouter();
module.exports.createAiCommercialsRouter = createAiCommercialsRouter;

