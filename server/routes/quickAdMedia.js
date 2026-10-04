const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { accountSummary, fail } = require('../services/quickAdCredits');
const { QUICK_AD_PLANS, QUICK_AD_CREDIT_PRICE } = require('../config/quickAdPlans');
const { publicGeneration, verifyPreviewToken, assertDownloadable, streamVideo } = require('../services/quickAdMedia');
const { canUseQuickAds, quickAdAccountOnly } = require('../services/quickAdAccess');

function safeError(res, error) {
  return res.status(error.quickAdSafe ? error.statusCode : 503).json({ success: false,
    ...(error.quickAdSafe ? { code: error.code } : {}),
    message: error.quickAdSafe ? error.message : 'Quick Ads is temporarily unavailable. Please try again.' });
}
function createQuickAdMediaRouter({ authenticate = authenticateToken, stream = streamVideo } = {}) {
  const router = express.Router();
  router.get('/plans', (req, res) => res.json({ success: true, plans: QUICK_AD_PLANS, pricePerCredit: QUICK_AD_CREDIT_PRICE }));
  router.get('/credits', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json({ success: true, ...accountSummary(user) });
    } catch (error) { safeError(res, error); }
  });
  async function owned(req) {
    const generation = await req.app.locals.db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id });
    if (!generation) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
    return generation;
  }
  router.get('/requests/:key', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await req.app.locals.db.QuickAdGeneration.findOne({ userId: req.user.id, idempotencyKey: req.params.key });
      if (!generation) fail('GENERATION_NOT_FOUND', 'Ad not found.', 404);
      if (generation.status === 'pending' && new Date(generation.expiresAt).getTime() <= Date.now()) fail('GENERATION_EXPIRED', 'This generation expired. You can try again.', 410);
      const user = await req.app.locals.db.User.findOne({ id: req.user.id });
      res.set('Cache-Control', 'no-store').json(publicGeneration(generation, user));
    } catch (error) { safeError(res, error); }
  });
  router.get('/generations', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const DB = req.app.locals.db;
      const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 12));
      const page = Math.max(1, Number(req.query.page) || 1);
      const skip = (page - 1) * limit;
      const rows = await DB.QuickAdGeneration.find({ userId: req.user.id }).sort({ createdAt: -1 }).skip(skip).limit(limit);
      res.set('Cache-Control', 'no-store').json({ success: true, generations: rows.map(g => ({
        generationId: g.id,
        style: g.style,
        status: g.status,
        stage: g.stage || (g.status === 'completed' ? 'completed' : 'queued'),
        freePreview: !!g.freePreview,
        creditUsed: !!g.creditUsed,
        downloadable: g.status === 'completed' && !g.freePreview && !!g.downloadable,
        createdAt: g.createdAt,
        completedAt: g.completedAt,
        thumbnail: g.commercialImage?.url || g.imageUrl || null,
        model: g.model
      })) });
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
      if (!generation || generation.status !== 'completed' || !generation.freePreview || !generation.media?.previewUrl) return res.sendStatus(404);
      await stream(req, res, generation.media.previewUrl);
    } catch (error) { if (!res.headersSent) safeError(res, error); }
  });
  router.get('/generations/:id/download', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      assertDownloadable(generation);
      await stream(req, res, generation.media.outputUrl, true);
    } catch (error) { if (!res.headersSent) safeError(res, error); }
  });
  router.get('/generations/:id/export', authenticate, quickAdAccountOnly, async (req, res) => {
    try {
      const generation = await owned(req);
      assertDownloadable(generation);
      res.set('Cache-Control', 'no-store').json({ success: true, videoUrl: generation.media.outputUrl, imageUrl: generation.imageUrl });
    } catch (error) { safeError(res, error); }
  });
  return router;
}
module.exports = { createQuickAdMediaRouter, quickAdAccountOnly, safeError };
