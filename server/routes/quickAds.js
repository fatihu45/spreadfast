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

const COMMERCIAL_IMAGE_MODEL = process.env.COMMERCIAL_IMAGE_MODEL || 'bria/replace-background';
const VIDEO_MODEL = process.env.VIDEO_MODEL || 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const NEGATIVE_PROMPT = 'blur, distortion, warped packaging, incorrect logo, duplicated objects, unreadable branding, low quality';
const COMMERCIAL_NEGATIVE_PROMPT = 'warped packaging, changed logos, unreadable branding, product duplication, morphing, incorrect product geometry, low-quality imagery, random text, people unless explicitly required';
const QUICK_AD_BASE_PROMPT = 'Create a polished 5-second vertical product ad using the uploaded image as reference. Keep the product sharp, dominant, and faithful in identity, shape, proportions, packaging, colors, and logo. Animate it with subtle lift, rotation, or forward movement; animate the background with subtle motion, depth, and parallax. Use smooth camera movement, realistic light, shadows, and reflections. No morphing, duplicate products, people, or added text. End on a stable hero shot.';
const IMAGE_STYLE_PROMPTS = Object.freeze({
  food: 'Create premium commercial food/product advertising photography. Preserve the exact product, packaging, branding, proportions and important label details. Place it naturally in an appetizing advertising environment with professional food styling, complementary ingredients where appropriate, rich realistic lighting, depth, clean composition and a premium restaurant/brand campaign feel. Remove the ordinary original environment. No people, no extra product copies, no added text.',
  reveal: 'Turn the uploaded product into premium cinematic product advertising photography. Preserve exact product identity, packaging, logo, proportions and colors. Replace the ordinary environment with a dramatic studio advertising set with controlled spotlighting, premium reflective surfaces, atmospheric depth and subtle mist where appropriate. The product is the hero. No people, duplicate products or added text.',
  studio: 'Create polished minimalist commercial product photography. Preserve the exact product and branding. Use a clean premium studio environment with a complementary neutral background, realistic soft shadows, professional diffused lighting, subtle depth and elegant composition. Remove distracting original surroundings. No people, duplicate products or added text.',
  social: 'Create bold modern social-media commercial product photography while preserving the exact product, packaging and branding. Replace the ordinary environment with an energetic graphic advertising set using complementary colors, depth, professional lighting and visually interesting environmental elements. Product remains dominant and realistic. No people, duplicate products or added text.'
});
const VIDEO_STYLE_PROMPTS = Object.freeze({
  food: 'Food Burst: Use a warm, appetizing food or beverage setting. Sweep ingredients, steam, droplets, crumbs, or sauce naturally around and behind the product; add a smooth cinematic push-in.',
  reveal: 'Product Reveal: Begin in soft shadow or mist, then reveal the product moving forward with controlled rotation. Add gentle light beams, reflections, and a slow cinematic push.',
  studio: 'Clean Studio: Use a calm, minimalist studio with neutral or complementary tones, soft shadows, and restrained depth. Keep the backdrop quiet and the camera movement slow.',
  social: 'Attention Grabber: Open with a bold, energetic entrance. Add a quick camera push, lively particles or light streaks, and strong parallax for a vivid short-form ad.'
});
const PROMPTS = Object.freeze({ ...VIDEO_STYLE_PROMPTS });

function sanitizeVideoPrompt(prompt) {
  const MAX_LENGTH = 2200;
  return String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

function buildCommercialImagePrompt(style) {
  return sanitizeVideoPrompt(`${IMAGE_STYLE_PROMPTS[style] || IMAGE_STYLE_PROMPTS.studio} ${COMMERCIAL_NEGATIVE_PROMPT}`);
}

function buildQuickAdPrompt(style) {
  return `${QUICK_AD_BASE_PROMPT} ${VIDEO_STYLE_PROMPTS[style] || VIDEO_STYLE_PROMPTS.studio}`;
}

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

async function persistCommercialImage(client, imageUrl, generation, signal) {
  if (!imageUrl || !isHttpsUrl(imageUrl)) return { url: imageUrl, publicId: null };
  if (typeof client?.uploader?.upload !== 'function') return { url: imageUrl, publicId: null };
  try {
    const uploaded = await new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason || new Error('Commercial image upload aborted'));
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
      client.uploader.upload(imageUrl, {
        folder: 'spreadfast/quick-ads/commercial-images',
        public_id: `spreadfast/quick-ads/commercial-images/${generation.id}`,
        resource_type: 'image',
        overwrite: true,
        timeout: 120000
      }, (error, result) => {
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(result);
      });
    });
    return { url: uploaded?.secure_url || imageUrl, publicId: uploaded?.public_id || null };
  } catch {
    return { url: imageUrl, publicId: null };
  }
}

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function generationError(code) {
  return Object.assign(new Error('Quick Ads generation failed'), { code });
}

function isFalValidationError(error) {
  const payload = [
    error?.message,
    error?.details,
    error?.body?.message,
    error?.body?.error,
    error?.response?.data?.message,
    error?.response?.data?.error,
    error?.response?.statusText
  ].filter(Boolean).join(' ');

  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
  return status === 400 || status === 422 || /validation|invalid parameter|invalid parameters|too long|max.*characters|at most 2500|string should have at most/i.test(payload);
}

// Allowlist diagnostic values; provider messages, bodies and headers may contain keys.
function logFailure(logger, { stage, style, error, timedOut = false, disconnected = false, model = VIDEO_MODEL }) {
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
    logger.error('[Quick Ads] Request failed', { stage, style, model, category, upstreamStatus });
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
      const reservation = await beginGeneration(DB, { userId: req.user.id, key, style, model: VIDEO_MODEL });
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
      const sourceImageUrl = uploaded?.secure_url;
      if (!isHttpsUrl(sourceImageUrl)) throw generationError('INVALID_IMAGE_URL');
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { sourceImageUrl, stage: 'preparing_image' } });
      stage = 'creating_scene';
      const commercialPrompt = sanitizeVideoPrompt(buildCommercialImagePrompt(style));
      const commercialQueue = await fal.queue.submit(COMMERCIAL_IMAGE_MODEL, {
        input: { image_url: sourceImageUrl, prompt: commercialPrompt },
        abortSignal: controller.signal
      });
      const commercialRequestId = commercialQueue?.request_id;
      if (typeof commercialRequestId !== 'string' || !commercialRequestId.trim()) throw generationError('MISSING_REQUEST_ID');
      const commercialImage = { url: null, publicId: null, model: COMMERCIAL_IMAGE_MODEL, requestId: commercialRequestId };
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { commercialImage, stage: 'creating_scene' } });
      while (true) {
        controller.signal.throwIfAborted();
        const status = await fal.queue.status(COMMERCIAL_IMAGE_MODEL, { requestId: commercialRequestId, logs: false, abortSignal: controller.signal });
        if (status?.status === 'COMPLETED') break;
        if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status?.status)) throw generationError('INVALID_QUEUE_STATUS');
        await delay(pollIntervalMs, undefined, { signal: controller.signal });
      }
      const commercialResult = await fal.queue.result(COMMERCIAL_IMAGE_MODEL, { requestId: commercialRequestId, abortSignal: controller.signal });
      const commercialUrl = commercialResult?.data?.image?.url || commercialResult?.data?.image_url || commercialResult?.data?.url || commercialResult?.data?.output?.url;
      if (!isHttpsUrl(commercialUrl)) throw generationError('INVALID_IMAGE_URL');
      const commercialAsset = await persistCommercialImage(cloudinaryClient, commercialUrl, generation, controller.signal);
      const nextCommercialImage = {
        url: commercialAsset?.url || commercialUrl,
        publicId: commercialAsset?.publicId || null,
        model: COMMERCIAL_IMAGE_MODEL,
        requestId: commercialRequestId
      };
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { commercialImage: nextCommercialImage, imageUrl: nextCommercialImage.url, sourceImageUrl, stage: 'creating_video' } });
      stage = 'creating_video';
      const safePrompt = sanitizeVideoPrompt(buildQuickAdPrompt(style));
      const queued = await fal.queue.submit(VIDEO_MODEL, {
        input: { image_url: nextCommercialImage.url, prompt: safePrompt, duration: '5', negative_prompt: NEGATIVE_PROMPT },
        abortSignal: controller.signal
      });
      requestId = queued?.request_id;
      if (typeof requestId !== 'string' || !requestId.trim()) throw generationError('MISSING_REQUEST_ID');
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { requestId, videoRequestId: requestId, stage: 'creating_video' } });
      while (true) {
        controller.signal.throwIfAborted();
        const status = await fal.queue.status(VIDEO_MODEL, { requestId, logs: false, abortSignal: controller.signal });
        if (status?.status === 'COMPLETED') break;
        if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status?.status)) throw generationError('INVALID_QUEUE_STATUS');
        await delay(pollIntervalMs, undefined, { signal: controller.signal });
      }
      stage = 'finalizing';
      const result = await fal.queue.result(VIDEO_MODEL, { requestId, abortSignal: controller.signal });
      controller.signal.throwIfAborted();
      const videoUrl = result?.data?.video?.url;
      if (!isHttpsUrl(videoUrl)) throw generationError('MISSING_VIDEO_URL');
      stage = 'media';
      const media = await protectVideo(cloudinaryClient, videoUrl, generation, controller.signal);
      controller.signal.throwIfAborted();
      stage = 'completion';
      generation = await finishGeneration(DB, { userId: req.user.id, id: generation.id, imageUrl: nextCommercialImage.url, media });
      return res.set('Cache-Control', 'no-store').json(publicGeneration(generation, await DB.User.findOne({ id: req.user.id })));
    } catch (error) {
      logFailure(logger, { stage, style, error, timedOut, disconnected: res.destroyed, model: stage === 'creating_scene' ? COMMERCIAL_IMAGE_MODEL : VIDEO_MODEL });
      if (generation?.status === 'pending') {
        try { await failGeneration(DB, { userId: req.user.id, id: generation.id, code: timedOut ? 'TIMEOUT' : 'GENERATION_FAILED' }); }
        catch { logFailure(logger, { stage: 'credit-cleanup', style, error: generationError('CREDIT_CLEANUP_FAILED'), model: VIDEO_MODEL }); }
      }
      if (res.destroyed) return;
      if (error.quickAdSafe || stage === 'credits') return safeError(res, error);
      if (['submission', 'status', 'result'].includes(stage) && isFalValidationError(error)) {
        return res.status(400).json({
          success: false,
          code: 'VIDEO_PROVIDER_VALIDATION_ERROR',
          message: 'The video generation request contained invalid parameters.'
        });
      }
      if (timedOut) return res.status(504).json({
        success: false, message: 'Generation timed out. It may still be processing; do not automatically submit again.',
        ...(requestId ? { requestId } : {})
      });
      const message = stage === 'upload' ? 'Image upload failed. Please try again.'
        : stage === 'setup' ? 'Quick Ads is temporarily unavailable.'
        : 'Video generation could not be completed. The provider may be unavailable or the image may not be supported.';
      return res.status(stage === 'setup' ? 503 : 502).json({ success: false, message, ...(requestId ? { requestId } : {}) });
    } finally {
      clearTimeout(timer);
      res.removeListener('close', disconnect);
      delete req.file.buffer;
    }
  });
  return router;
}

module.exports = createQuickAdsRouter();
module.exports.createQuickAdsRouter = createQuickAdsRouter;
