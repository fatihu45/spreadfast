const { randomUUID } = require('node:crypto');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { MAX_LOGO_SIZE, readBranding, uploadBranding, renderBranding } = require('../services/quickAdBranding');
const { PREVIEW_TRANSFORMATION } = require('../services/quickAdMedia');
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { accountSummary, fail, finishGeneration, failGeneration } = require('../services/quickAdCredits');
const { QUICK_AD_PLANS, QUICK_AD_CREDIT_PRICE } = require('../config/quickAdPlans');
const { canDownloadGeneration, publicGeneration, verifyPreviewToken, assertDownloadable, streamVideo } = require('../services/quickAdMedia');
const { canUseQuickAds, quickAdAccountOnly } = require('../services/quickAdAccess');

const { recoverable, claimRecovery, settleExpired } = require('../services/quickAdRecovery');
const { storeVideo } = require('../services/quickAdMedia');

function safeError(res, error) {
  return res.status(error.quickAdSafe ? error.statusCode : 503).json({ success: false,
    ...(error.quickAdSafe ? { code: error.code } : {}),
    message: error.quickAdSafe ? error.message : 'Quick Ads is temporarily unavailable. Please try again.' });
}
function createQuickAdMediaRouter({ authenticate = authenticateToken, stream = streamVideo, cloudinaryClient = cloudinary } = {}) {
  const router = express.Router();
  router.get('/plans', (req, res) => res.json({ success: true, plans: QUICK_AD_PLANS, pricePerCredit: QUICK_AD_CREDIT_PRICE }));
  router.get('/credits', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json({ success: true, ...accountSummary(user) });
    } catch (error) { safeError(res, error); }
  });
  async function owned(req) {
    let generation = await settleExpired(req.app.locals.db, await req.app.locals.db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id }));
    if (!generation || generation.deletedAt) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
    if (generation.brandingStatus === 'retrying' && new Date(generation.brandingRetryUntil || new Date(generation.updatedAt || 0).getTime() + 180000).getTime() <= Date.now()) {
      await req.app.locals.db.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id, brandingStatus: 'retrying',
        brandingAttemptId: generation.brandingAttemptId || { $exists: false } }, { $set: { brandingStatus: 'failed' } });
      generation = await req.app.locals.db.QuickAdGeneration.findOne({ id: generation.id, userId: req.user.id });
    }
    return generation;
  }
  async function recoverSavedVideo(DB, userId, id) {
    let job;
    try {

      job = await claimRecovery(DB, { id, userId });
      const signal = AbortSignal.timeout(10 * 60 * 1000);
      let media = job.media;
      if (!media?.publicId) {
        // Retrieval only: never submit another paid provider generation during recovery.
        const { createFalClient } = await import('@fal-ai/client');
        const fal = createFalClient({ credentials: process.env.FAL_KEY });
        const status = await fal.queue.status(job.model, { requestId: job.videoRequestId, logs: false, abortSignal: signal });
        if (status.status !== 'COMPLETED') fail('PROVIDER_NOT_READY', 'The saved video is not ready. Please retry later.', 409);
        const result = await fal.queue.result(job.model, { requestId: job.videoRequestId, abortSignal: signal });
        if (!result.data?.video?.url?.startsWith('https://')) throw new Error('Saved video unavailable');
        media = await storeVideo(cloudinaryClient, result.data.video.url, job, signal);
        media.originalOutputUrl = media.outputUrl;
        await DB.QuickAdGeneration.updateOne({ id: job.id, executionId: job.executionId, status: 'pending' }, { $set: { media } });
      }
      if (job.branding?.mode && job.branding.mode !== 'none') media = await renderBranding(cloudinaryClient, { ...job, media }, job.branding, PREVIEW_TRANSFORMATION);
      signal.throwIfAborted();
      const completed = await finishGeneration(DB, { userId: userId, id: job.id, executionId: job.executionId,
        imageUrl: job.imageUrl, media, brandingStatus: job.branding?.mode && job.branding.mode !== 'none' ? 'applied' : 'none' });
      return publicGeneration(completed, await DB.User.findOne({ id: userId }));
    } catch (error) {
      if (job) await failGeneration(DB, { userId: userId, id: job.id, executionId: job.executionId, code: 'RECOVERY_FAILED' }).catch(() => {});
      throw error;
    }
  }
  router.recoverSavedVideo = recoverSavedVideo;
  router.post('/generations/:id/retry', authenticate, quickAdAccountOnly, async (req, res) => {
    try { await owned(req); res.json(await recoverSavedVideo(req.app.locals.db, req.user.id, req.params.id)); }
    catch (error) { safeError(res, error); }
  });
  const brandingUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_LOGO_SIZE + 1, files: 1, fields: 2, fieldSize: 256 } }).single('brandingLogo');
  router.post('/generations/:id/branding/retry', authenticate, quickAdAccountOnly, async (req, res) => {
    let generation;
    let claimed = false;
    const brandingAttemptId = randomUUID();
    const DB = req.app.locals.db;
    try {
      generation = await owned(req);
      if (generation.status !== 'completed') fail('GENERATION_IN_PROGRESS', 'Wait until your video is ready.', 409);
      if (!generation.branding || generation.branding.mode === 'none') fail('INVALID_BRANDING', 'This video has no branding to retry.', 400);
      if (generation.brandingStatus === 'applied') {
        const user = await DB.User.findOne({ id: req.user.id });
        return res.set('Cache-Control', 'no-store').json(publicGeneration(generation, user));
      }
      if (!generation.media?.publicId || !(generation.media.originalOutputUrl || generation.media.outputUrl)) {
        fail('BRANDING_SOURCE_MISSING', 'The original video is unavailable for branding recovery.', 409);
      }
      const claim = await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id,
        status: 'completed', brandingStatus: 'failed', deletedAt: { $exists: false } }, { $set: { brandingStatus: 'retrying', brandingAttemptId, brandingRetryUntil: new Date(Date.now() + 180000) } });
      if (!claim.modifiedCount) fail('BRANDING_RETRY_IN_PROGRESS', 'Branding is already being retried. Refresh in a moment.', 409);
      claimed = true;
      const originalMedia = { ...generation.media, outputUrl: generation.media.originalOutputUrl || generation.media.outputUrl };
      const snapshot = generation.toObject ? generation.toObject() : generation;
      const media = await renderBranding(cloudinaryClient, { ...snapshot, media: originalMedia }, generation.branding, PREVIEW_TRANSFORMATION);
      const updated = await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id,
        status: 'completed', brandingStatus: 'retrying', brandingAttemptId, deletedAt: { $exists: false } }, { $set: { media, brandingStatus: 'applied', brandingRetryUntil: null }, $inc: { brandingRevision: 1 } });
      if (!updated.modifiedCount) fail('BRANDING_CHANGED', 'This video changed. Open it again and retry.', 409);
      const saved = await DB.QuickAdGeneration.findOne({ id: generation.id, userId: req.user.id });
      const user = await DB.User.findOne({ id: req.user.id });
      return res.set('Cache-Control', 'no-store').json(publicGeneration(saved, user));
    } catch (error) {
      if (claimed && generation) await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id,
        status: 'completed', brandingStatus: 'retrying', brandingAttemptId }, { $set: { brandingStatus: 'failed' } }).catch(() => {});
      return safeError(res, error);
    }
  });
  router.patch('/generations/:id/branding', authenticate, quickAdAccountOnly, (req, res, next) => {
    brandingUpload(req, res, error => error ? res.status(400).json({ success: false, message: 'Choose a PNG, JPG, or WEBP logo up to 2 MB.' }) : next());
  }, async (req, res) => {
    try {
      const generation = await owned(req);
      if (generation.status !== 'completed') fail('GENERATION_IN_PROGRESS', 'Wait until your video is ready.', 409);
      if (Object.keys(req.body || {}).some(key => !['brandingMode', 'businessName'].includes(key))) fail('INVALID_BRANDING', 'Unexpected branding fields.', 400);
      if (generation.brandingStatus === 'retrying') fail('BRANDING_RETRY_IN_PROGRESS', 'Wait for branding recovery to finish.', 409);
      const selected = readBranding(req.body, req.file);
      const branding = await uploadBranding(cloudinaryClient, selected, req.file);
      const media = await renderBranding(cloudinaryClient, generation, branding, PREVIEW_TRANSFORMATION);
      // Compare-and-set prevents overlapping edits or deletion from replacing newer work.
      const updated = await req.app.locals.db.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id,
        deletedAt: { $exists: false }, status: 'completed', brandingStatus: { $ne: 'retrying' },
        brandingRevision: generation.brandingRevision == null ? { $exists: false } : generation.brandingRevision
      }, { $set: { branding, media, brandingStatus: branding.mode === 'none' ? 'none' : 'applied' }, $inc: { brandingRevision: 1 } });
      if (!updated.modifiedCount) fail('BRANDING_CHANGED', 'This video changed. Open it again and retry.', 409);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json(publicGeneration({ ...(generation.toObject ? generation.toObject() : generation), branding, media, brandingStatus: branding.mode === 'none' ? 'none' : 'applied' }, user));
    } catch (error) { safeError(res, error); }
  });
  router.get('/requests/:key', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await req.app.locals.db.QuickAdGeneration.findOne({ userId: req.user.id, idempotencyKey: req.params.key });
      if (!generation || generation.deletedAt) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
      if (generation.status === 'pending' && new Date(generation.expiresAt).getTime() <= Date.now()) fail('GENERATION_EXPIRED', 'This generation expired. You can try again.', 410);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json(publicGeneration(generation, user));
    } catch (error) { safeError(res, error); }
  });
  router.get('/generations', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const DB = req.app.locals.db;
      const limit = Math.min(50, Math.max(1, Math.floor(Number(req.query.limit) || 12)));
      const page = Math.min(100000, Math.max(1, Math.floor(Number(req.query.page) || 1)));
      const skip = (page - 1) * limit;
      const user = await DB.User.findOne({ id: req.user.id });
      const query = { userId: req.user.id, deletedAt: { $exists: false }, ...(req.query.all === 'true' ? {} : { provider: { $ne: 'ai-commercials' } }) };
      if (req.query.type === 'commercial') query.provider = 'ai-commercials';
      if (req.query.type === 'fashion') { query.provider = { $ne: 'ai-commercials' }; query.style = 'fashion_studio'; }
      if (req.query.type === 'quick') { query.provider = { $ne: 'ai-commercials' }; query.style = { $ne: 'fashion_studio' }; }
      const found = await DB.QuickAdGeneration.find(query).sort({ createdAt: -1, id: -1 }).skip(skip).limit(limit + 1);
      const rows = await Promise.all(found.slice(0, limit).map(g => settleExpired(DB, g)));
      if (req.query.all === 'true') return res.set('Cache-Control', 'no-store').json({ success: true, generations: rows.map(g => publicGeneration(g, user)), hasMore: found.length > limit, page });
      res.set('Cache-Control', 'no-store').json({ success: true, hasMore: found.length > limit, page, generations: rows.map(g => ({
        recoveryAvailable: recoverable(g),
        brandingRetryAvailable: g.status === 'completed' && g.brandingStatus === 'failed',
        generationId: g.id,
        style: g.style,
        status: g.status,
        stage: g.stage || (g.status === 'completed' ? 'completed' : 'queued'),
        freePreview: !!g.freePreview,
        creditUsed: !!g.creditUsed,
        downloadable: canDownloadGeneration(g, user),
        createdAt: g.createdAt,
        completedAt: g.completedAt,
        thumbnail: g.commercialImage?.url || g.imageUrl || null,
        model: g.model,
        brandingRevision: g.brandingRevision || 0
      })) });
    } catch (error) { safeError(res, error); }
  });
  // Retain billing/idempotency records and assets used by existing campaigns.
  router.delete('/generations/:id', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      if (generation.status === 'pending') fail('GENERATION_IN_PROGRESS', 'Wait until this ad finishes before deleting it.', 409);
      const deleted = await req.app.locals.db.QuickAdGeneration.updateOne(
        { id: generation.id, userId: req.user.id, status: generation.status, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } }
      );
      if (!deleted.matchedCount) fail('GENERATION_CHANGED', 'This ad changed. Refresh before deleting.', 409);
      res.set('Cache-Control', 'no-store').json({ success: true });
    } catch (error) { safeError(res, error); }
  });
  router.get('/generations/:id', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json(publicGeneration(generation, user));
    } catch (error) { safeError(res, error); }
  });
  router.get('/generations/:id/preview', async (req, res) => {
    let claims;
    try {
      if (typeof req.query.token !== 'string') throw new Error('Missing token');
      claims = verifyPreviewToken(req.query.token);
      if (claims.generationId !== req.params.id) throw new Error('Wrong video');
    } catch { return res.status(401).json({ success: false, message: 'Preview expired. Choose Preview Again to continue.' }); }
    try {
      const DB = req.app.locals.db;
      const user = await DB.User.findOne({ id: claims.userId });
      if (!user || !canUseQuickAds(user.role) || (user.status && user.status !== 'active') || (user.tokenVersion || 0) !== claims.tokenVersion) {
        return res.sendStatus(401);
      }
      const generation = await DB.QuickAdGeneration.findOne({ id: req.params.id, userId: user.id });
      if (!generation || generation.deletedAt || generation.status !== 'completed' || !generation.freePreview || !generation.media?.previewUrl) return res.sendStatus(404);
      await stream(req, res, generation.media.previewUrl);
    } catch (error) { if (!res.headersSent) safeError(res, error); }
  });
  router.get('/generations/:id/download', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      assertDownloadable(generation, user);
      await stream(req, res, generation.media.outputUrl, true);
    } catch (error) { if (!res.headersSent) safeError(res, error); }
  });
  router.get('/generations/:id/export', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      assertDownloadable(generation, user);
      res.set('Cache-Control', 'no-store').json({ success: true, videoUrl: generation.media.outputUrl, imageUrl: generation.imageUrl });
    } catch (error) { safeError(res, error); }
  });
  return router;
}
module.exports = { createQuickAdMediaRouter, quickAdAccountOnly, safeError };
