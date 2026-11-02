const express = require('express');
const multer = require('multer');
const { randomUUID, createHash } = require('node:crypto');
const cloudinaryDefault = require('cloudinary').v2;
const { authenticateToken } = require('../middleware/auth');
const { quickAdAccountOnly } = require('../services/quickAdAccess');
const { beginGeneration, failGeneration, accountSummary } = require('../services/quickAdCredits');
const { storeVideo, assembleVideos, publicGeneration } = require('../services/quickAdMedia');
const { readBranding, uploadBranding, renderBranding } = require('../services/quickAdBranding');
const {
  createCreativePlan,
  generateNanoBananaImage,
  generateVeoClip,
  IMAGE_MODEL,
  VEO_MODELS
} = require('../services/aiCommercialProviders');

const { runCommercial, reserveRecovery } = require('../services/aiCommercialPipeline');

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const TIER_COST = Object.freeze({ standard: 4, premium: 7 });
const VALID_STYLES = new Set(['cinematic', 'showcase', 'lifestyle', 'promo']);
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
    limits: { fileSize: MAX_FILE_SIZE, files: 2, fields: 8, fieldSize: 4096 },
    fileFilter: (req, file, callback) => {
      if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) callback(null, true);
      else callback(Object.assign(new Error('Unsupported image'), { code: 'INVALID_IMAGE_TYPE' }));
    }
  }).fields([{ name: 'productImage', maxCount: 1 }, { name: 'logo', maxCount: 1 }]);
  const parseUpload = (req, res, next) => upload(req, res, error => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Images must be 8 MB or smaller.' });
    if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ success: false, message: 'Upload one product image and, optionally, one logo.' });
    return res.status(400).json({ success: false, message: 'Upload valid JPG, PNG, or WEBP images.' });
  });

  router.use(authenticate);
  router.use(quickAdAccountOnly);

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  router.get('/credits', async (req, res) => {
    try {
      const summary = accountSummary(await loadUserBalance(req));
      return res.json({
        success: true,
        ...summary,
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
      if (productName.length < 2) {
        return res.status(400).json({ success: false, message: 'Product name is required.' });
      }
      const job = await db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials' });
      if (!job || job.deletedAt) return res.status(404).json({ success: false, message: 'Ad not found.' });
      if (job.status === 'pending') return res.status(409).json({ success: false, message: 'Wait for generation to finish before editing this ad.' });
      const current = job.commercialDetails || {};
      const updatedDetails = { ...current, title: productName, productName, brandName, contact, specifications };
      const updated = await db.QuickAdGeneration.updateOne(
        { id: req.params.id, userId: req.user.id, provider: 'ai-commercials', status: job.status, deletedAt: { $exists: false } },
        { $set: { commercialDetails: updatedDetails } }
      );
      if (!updated.modifiedCount) return res.status(409).json({ success: false, message: 'Ad changed. Refresh and try again.' });
      return res.json({ success: true, message: 'History details updated. The video is unchanged.' });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Could not update this ad.' });
    }
  });

  router.delete('/jobs/:id', async (req, res) => {
    try {
      const db = req.app.locals.db;
      const job = await db.QuickAdGeneration.findOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials' });
      if (!job || job.deletedAt) return res.status(404).json({ success: false, message: 'Ad not found.' });
      if (job.status === 'pending') return res.status(409).json({ success: false, message: 'Wait for generation to finish before deleting this ad.' });
      const deleted = await db.QuickAdGeneration.updateOne({ id: req.params.id, userId: req.user.id, provider: 'ai-commercials', status: job.status, deletedAt: { $exists: false } }, { $set: { deletedAt: new Date() } });
      if (!deleted.modifiedCount) return res.status(409).json({ success: false, message: 'Ad changed. Refresh and try again.' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Could not delete this ad.' });
    }
  });

  const pipelineDependencies = {
    cloudinary, createPlan, generateImage, generateVideo, persistVideo, assemble, brandingRender, logger,
    uploadSceneImage: async (url, id, signal) => {
      const response = await fetch(url, { signal });
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Scene image unavailable.');
      const buffer = await readImageResponse(response, 12 * 1024 * 1024);
      const result = await uploadImage(cloudinary, { buffer }, 'spreadfast/ai-commercials/scenes', id, signal);
      if (!result?.secure_url?.startsWith('https://')) throw new Error('Scene image could not be saved.');
      return result;
    }
  };
  router.post('/jobs/:id/retry', async (req, res) => {
    try {
      const job = await reserveRecovery(req.app.locals.db, req.user.id, req.params.id);
      if (req.headers.prefer === 'respond-async') {
        res.status(202).json({ success: true, generationId: job.id, status: 'pending' });
        runCommercial(req.app.locals.db, job, pipelineDependencies).catch(() => {});
        return;
      }
      const completed = await runCommercial(req.app.locals.db, job, pipelineDependencies);
      return res.json(publicGeneration(completed, await loadUserBalance(req)));
    } catch (error) {
      return res.status(error.statusCode || 502).json({ success: false, message: error.statusCode ? error.message : 'Recovery stopped. Saved scenes are preserved; no credits were charged.' });
    }
  });

  router.post('/generate', parseUpload, async (req, res) => {
    const db = req.app.locals.db;
    const controller = new AbortController();
    let generation;
    let stage = 'validation';
    const timer = setTimeout(() => controller.abort(new Error('Generation timed out.')), MAX_GENERATION_MS);
    try {
      const productImage = req.files?.productImage?.[0];
      const logoFile = req.files?.logo?.[0];
      if (!isValidImage(productImage)) {
        return res.status(400).json({ success: false, message: 'A valid product JPG, PNG, or WEBP image is required.' });
      }
      if (logoFile && !isValidImage(logoFile)) {
        return res.status(400).json({ success: false, message: 'The logo must be a valid JPG, PNG, or WEBP image.' });
      }

      const productName = cleanText(req.body?.productName, 100);
      const brandName = cleanText(req.body?.brandName, 100);
      const contact = cleanText(req.body?.contact, 120);
      const specifications = cleanText(req.body?.specifications, 500);
      const style = cleanText(req.body?.style, 30);
      const tier = cleanText(req.body?.tier || 'standard', 20);
      const requiredCredits = TIER_COST[tier];
      if (productName.length < 2) return res.status(400).json({ success: false, message: 'Product name must contain at least 2 characters.' });
      if (!VALID_STYLES.has(style)) return res.status(400).json({ success: false, message: 'Choose a valid creative style.' });
      if (!requiredCredits) return res.status(400).json({ success: false, message: 'Select a valid generation tier.' });
      const brandingRequest = logoFile
        ? readBranding({ brandingMode: 'logo' }, logoFile)
        : { mode: 'none' };

      const user = await loadUserBalance(req);
      const key = req.headers['idempotency-key'] || randomUUID();
      if (typeof key !== 'string' || key.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(key)) return res.status(400).json({ success: false, message: 'Invalid request key.' });
      const fingerprint = createHash('sha256').update(JSON.stringify({ productName, brandName, contact, specifications, style, tier })).update(productImage.buffer).update(logoFile?.buffer || '').digest('hex');
      const reservation = await beginGeneration(db, {
        userId: req.user.id,
        key,
        style,
        model: `${IMAGE_MODEL}+${VEO_MODELS[tier]}`,
        creditCost: requiredCredits,
        fingerprint,
        leaseMs: MAX_GENERATION_MS + 60 * 1000
      });
      generation = reservation.generation;
      if (reservation.reused && generation.status === 'completed') {
        return res.json({ success: true, ...publicGeneration(generation, user), reused: true });
      }

      stage = 'upload';
      const source = await uploadImage(cloudinary, productImage, 'spreadfast/ai-commercials/products', randomUUID(), controller.signal);
      if (!source?.secure_url?.startsWith('https://')) throw new Error('The product image could not be uploaded.');
      const uploadedLogo = logoFile
        ? await brandingUpload(cloudinary, brandingRequest, logoFile)
        : brandingRequest;
      const sourceImageUrl = source.secure_url;
      await db.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, {
        $set: {
          sourceImageUrl,
          runToken: randomUUID(),
          commercialInput: { productName, brandName, contact, specifications, tier, requiredCredits },
          stage: 'understanding',
          provider: 'ai-commercials',
          commercialDetails: { productName, brandName, contact, specifications, tier, requiredCredits },
          branding: uploadedLogo,
          brandingStatus: uploadedLogo.mode === 'none' ? 'none' : 'pending'
        }
      });

      generation = await db.QuickAdGeneration.findOne({ id: generation.id, userId: req.user.id });
      if (req.headers.prefer === 'respond-async') {
        res.status(202).json({ success: true, generationId: generation.id, status: 'pending' });
        runCommercial(db, generation.toObject ? generation.toObject() : generation, pipelineDependencies).catch(() => {});
        return;
      }
      const completed = await runCommercial(db, generation.toObject ? generation.toObject() : generation, pipelineDependencies);
      generation = completed;
      const latestUser = await db.User.findOne({ id: req.user.id });
      return res.json({
        success: true,
        completed: true,
        provider: 'anthropic+nano-banana+veo',
        ...publicGeneration(completed, latestUser)
      });
    } catch (error) {
      if (generation?.status === 'pending') {
        try {
          await failGeneration(db, { userId: req.user.id, id: generation.id, runToken: generation.runToken, code: stage === 'finalizing' ? 'ASSEMBLY_FAILED' : 'GENERATION_FAILED' });
        } catch (cleanupError) {
          logger.error('[AI Commercials] Failed to release generation lock', {
            generationId: generation.id,
            code: cleanupError.code || 'CREDIT_CLEANUP_FAILED'
          });
        }
      }
      logger.error('[AI Commercials] Generation failed', {
        generationId: generation?.id,
        stage,
        code: error.code || 'GENERATION_FAILED'
      });
      const status = error.statusCode || (error.code === 'AI_PROVIDER_NOT_CONFIGURED' ? 503 : 502);
      return res.status(status).json({
        success: false,
        message: error.code === 'AI_PROVIDER_NOT_CONFIGURED'
          ? 'AI commercial generation is not configured on the server.'
          : error.statusCode && error.statusCode < 500
            ? error.message
            : 'The commercial could not be completed. No credits were charged. Open My Ads to recover saved progress.'
      });
    } finally {
      clearTimeout(timer);
      if (req.files?.productImage?.[0]) delete req.files.productImage[0].buffer;
      if (req.files?.logo?.[0]) delete req.files.logo[0].buffer;
    }
  });

  return router;
}

module.exports = createAiCommercialsRouter();
module.exports.createAiCommercialsRouter = createAiCommercialsRouter;
