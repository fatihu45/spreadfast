const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { setTimeout: delay } = require('node:timers/promises');
const { authenticateToken } = require('../middleware/auth');
const { randomUUID } = require('node:crypto');
const { beginGeneration, finishGeneration, failGeneration } = require('../services/quickAdCredits');
const { storeVideo, publicGeneration } = require('../services/quickAdMedia');
const { createQuickAdMediaRouter, safeError } = require('./quickAdMedia');
const { quickAdAccountOnly } = require('../services/quickAdAccess');

const MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const NEGATIVE_PROMPT = 'blur, distortion, warped packaging, incorrect logo, duplicated objects, unreadable branding, low quality';
const PROMPTS = Object.freeze({
  food: `Create a polished 5-second commercial using this exact product image.
Preserve the original food and branding.
Create a smooth cinematic push-in.
Add subtle realistic steam and dimensional movement revealing ingredients.
Premium food advertisement style.
Natural appetizing lighting.
No people.
No text.
No distortion.`,
  reveal: `Create a premium 5-second product advertisement.
Preserve the exact product, logo, colors and proportions.
Use a cinematic push-in and subtle dimensional product reveal.
Premium commercial lighting.
No people.
No text.
No added products.
No distortion.`,
  studio: `Create a clean premium 5-second studio advertisement.
Keep the product unchanged.
Add elegant lighting, subtle reflections, a gentle camera orbit and slow push-in.
Minimal commercial aesthetic.
No text.
No people.
No distortion.`,
  social: `Create an energetic 5-second short-form product advertisement.
Preserve the exact product and brand.
Use a controlled fast push-in and engaging camera movement.
Finish with the product clearly centered.
No text.
No people.
No product distortion.`
});

async function loadFalClient() {
  // ESM-compatible SDK import; credentials never leave the server integration.
  const { createFalClient } = await import('@fal-ai/client');
  return createFalClient({ credentials: process.env.FAL_KEY });
}

function matchesImageType(file) {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return file.mimetype === 'image/webp' && bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function uploadImage(client, buffer, signal) {
  return new Promise((resolve, reject) => {
    let stream;
    const abort = () => { stream?.destroy(); reject(signal.reason); };
    if (signal.aborted) { reject(signal.reason); return; }
    const finish = (error, result) => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result);
    };
    try {
      stream = client.uploader.upload_stream({
        folder: 'spreadfast/quick-ads', resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'], timeout: 60000
      }, finish);
      stream.on('error', error => finish(error));
      signal.addEventListener('abort', abort, { once: true });
      stream.end(buffer);
    } catch (error) { finish(error); }
  });
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function generationError(code) {
  return Object.assign(new Error('Quick Ads generation failed'), { code });
}

// Allowlist diagnostic values; provider messages, bodies and headers may contain keys.
function logFailure(logger, { stage, style, error, timedOut = false, disconnected = false }) {
  const status = error?.status ?? error?.statusCode ?? error?.http_code ?? error?.response?.status;
  const upstreamStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : undefined;
  const knownCodes = ['INVALID_IMAGE_URL', 'MISSING_REQUEST_ID', 'INVALID_QUEUE_STATUS', 'MISSING_VIDEO_URL',
    'CONFIGURATION_MISSING', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND'];
  const category = timedOut ? 'TIMEOUT' : disconnected ? 'CLIENT_DISCONNECTED'
    : knownCodes.includes(error?.code) ? error.code
    : upstreamStatus === 401 || upstreamStatus === 403 ? 'UPSTREAM_AUTHORIZATION_FAILED'
    : upstreamStatus === 429 ? 'UPSTREAM_RATE_LIMITED'
    : upstreamStatus === 422 ? 'UPSTREAM_INPUT_REJECTED' : 'UPSTREAM_FAILURE';
  try {
    logger.error('[Quick Ads] Request failed', { stage, style, model: MODEL, category, upstreamStatus });
  } catch { /* Logging must not prevent a safe API response. */ }
}

// Inject dependencies in tests so they never upload media or buy a generation.
function createQuickAdsRouter({
  cloudinaryClient = cloudinary, authenticate = authenticateToken,
  getFalClient = loadFalClient, generationTimeoutMs = 10 * 60 * 1000,
  pollIntervalMs = 2000, logger = console, protectVideo = storeVideo
} = {}) {
  const router = express.Router();
  router.use(createQuickAdMediaRouter({ authenticate }));
  const upload = multer({
    storage: multer.memoryStorage(),
    // Busboy emits its size-limit event at equality; allow exactly 8 MB.
    limits: { fileSize: MAX_IMAGE_SIZE + 1, files: 1, fields: 1, fieldSize: 32 },
    fileFilter: (req, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        callback(Object.assign(new Error('Unsupported image'), { code: 'INVALID_IMAGE_TYPE' }));
      } else callback(null, true);
    }
  }).single('image');

  router.post('/generate', authenticate, quickAdAccountOnly, (req, res, next) => {
    upload(req, res, error => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Image must be 8 MB or smaller.' });
      const message = error.code === 'INVALID_IMAGE_TYPE'
        ? 'Only JPG, PNG, and WEBP images are supported.'
        : 'Send one image file and one style field as multipart/form-data.';
      return res.status(400).json({ success: false, message });
    });
  }, async (req, res) => {
    if (!req.file || !req.file.buffer?.length) return res.status(400).json({ success: false, message: 'An image is required.' });
    if (req.file.size > MAX_IMAGE_SIZE) return res.status(413).json({ success: false, message: 'Image must be 8 MB or smaller.' });
    const style = req.body?.style;
    if (typeof style !== 'string' || !Object.prototype.hasOwnProperty.call(PROMPTS, style)) {
      return res.status(400).json({ success: false, message: 'Style must be food, reveal, studio, or social.' });
    }
    if (!matchesImageType(req.file)) return res.status(400).json({ success: false, message: 'The file must contain a valid JPG, PNG, or WEBP image.' });
    const key = req.headers['idempotency-key'] || randomUUID();
    if (typeof key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(key)) {
      return res.status(400).json({ success: false, message: 'Invalid generation request key.' });
    }
    let config;
    try { config = cloudinaryClient.config(); } catch {
      logFailure(logger, { stage: 'configuration', style, error: generationError('CONFIGURATION_MISSING') });
      return res.status(503).json({ success: false, message: 'Quick Ads is not configured on the server.' });
    }
    if (!process.env.FAL_KEY?.trim() || !config?.cloud_name || !config.api_key || !config.api_secret) {
      logFailure(logger, { stage: 'configuration', style, error: generationError('CONFIGURATION_MISSING') });
      return res.status(503).json({ success: false, message: 'Quick Ads is not configured on the server.' });
    }

    const controller = new AbortController();
    let timedOut = false;
    let requestId;
    let generation;
    const DB = req.app.locals.db;
    let stage = 'setup';
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, generationTimeoutMs);
    const disconnect = () => controller.abort();
    res.on('close', disconnect);
    try {
      stage = 'credits';
      const reservation = await beginGeneration(DB, { userId: req.user.id, key, style, model: MODEL });
      generation = reservation.generation;
      if (reservation.reused) return res.json(publicGeneration(generation, await DB.User.findOne({ id: req.user.id })));
      controller.signal.throwIfAborted();
      stage = 'setup';
      const fal = await getFalClient();
      controller.signal.throwIfAborted();
      stage = 'upload';
      const uploaded = await uploadImage(cloudinaryClient, req.file.buffer, controller.signal);
      delete req.file.buffer;
      controller.signal.throwIfAborted();
      const imageUrl = uploaded?.secure_url;
      if (!isHttpsUrl(imageUrl)) throw generationError('INVALID_IMAGE_URL');
      stage = 'submission';
      const queued = await fal.queue.submit(MODEL, {
        // Kling 2.5 Turbo is silent; its schema has no generate_audio parameter.
        input: { image_url: imageUrl, prompt: PROMPTS[style], duration: '5', negative_prompt: NEGATIVE_PROMPT },
        abortSignal: controller.signal
      });
      requestId = queued?.request_id;
      if (typeof requestId !== 'string' || !requestId.trim()) throw generationError('MISSING_REQUEST_ID');
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { requestId } });
      stage = 'status';
      // Use one deadline across submission, polling, and result retrieval.
      while (true) {
        controller.signal.throwIfAborted();
        const status = await fal.queue.status(MODEL, { requestId, logs: false, abortSignal: controller.signal });
        if (status?.status === 'COMPLETED') break;
        if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status?.status)) throw generationError('INVALID_QUEUE_STATUS');
        await delay(pollIntervalMs, undefined, { signal: controller.signal });
      }
      stage = 'result';
      const result = await fal.queue.result(MODEL, { requestId, abortSignal: controller.signal });
      controller.signal.throwIfAborted();
      const videoUrl = result?.data?.video?.url;
      if (!isHttpsUrl(videoUrl)) throw generationError('MISSING_VIDEO_URL');
      stage = 'media';
      const media = await protectVideo(cloudinaryClient, videoUrl, generation, controller.signal);
      controller.signal.throwIfAborted();
      stage = 'completion';
      generation = await finishGeneration(DB, { userId: req.user.id, id: generation.id, imageUrl, media });
      return res.set('Cache-Control', 'no-store').json(publicGeneration(generation, await DB.User.findOne({ id: req.user.id })));
    } catch (error) {
      logFailure(logger, { stage, style, error, timedOut, disconnected: res.destroyed });
      if (generation?.status === 'pending') {
        try { await failGeneration(DB, { userId: req.user.id, id: generation.id, code: timedOut ? 'TIMEOUT' : 'GENERATION_FAILED' }); }
        catch { logFailure(logger, { stage: 'credit-cleanup', style, error: generationError('CREDIT_CLEANUP_FAILED') }); }
      }
      if (res.destroyed) return;
      if (error.quickAdSafe || stage === 'credits') return safeError(res, error);
      if (timedOut) return res.status(504).json({
        success: false, message: 'Generation timed out. It may still be processing; do not automatically submit again.',
        ...(requestId ? { requestId } : {})
      });
      // Return friendly messages only; never serialize raw provider errors.
      const message = stage === 'upload' ? 'Image upload failed. Please try again.'
        : stage === 'setup' ? 'Quick Ads is temporarily unavailable.'
        : 'Video generation could not be completed. The provider may be unavailable or the image may not be supported.';
      return res.status(stage === 'setup' ? 503 : 502).json({ success: false, message, ...(requestId ? { requestId } : {}) });
    } finally {
      clearTimeout(timer);
      res.removeListener('close', disconnect);
      delete req.file.buffer;
      // A timed-out/disconnected provider job may still need its source image.
    }
  });
  return router;
}

module.exports = createQuickAdsRouter();
module.exports.createQuickAdsRouter = createQuickAdsRouter;
