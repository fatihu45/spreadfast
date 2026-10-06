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

const COMMERCIAL_IMAGE_MODEL = process.env.COMMERCIAL_IMAGE_MODEL || 'fal-ai/nano-banana-2/edit';
const VIDEO_MODEL = process.env.VIDEO_MODEL || 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const NEGATIVE_PROMPT = 'blur, distortion, warped packaging, morphing, melting, duplicated objects, extra products, people, hands, text, watermark, unreadable branding, low quality';
const COMMERCIAL_NEGATIVE_PROMPT = 'people, hands, text, watermark, duplicate products, extra objects, blurry, low quality';
const COMMERCIAL_IMAGE_BASE_PROMPT = `Transform the supplied product photograph into a professional commercial advertising key visual.
The uploaded image contains the real customer's product. Preserve the exact identity of the main product.
Do not redesign or replace the product.
Preserve the product shape, proportions, colors, packaging, materials, logo, branding, labels, and important visible text.
The product must remain clearly recognizable as the same real item in the uploaded photograph.
Improve only the advertising presentation around it.
Create realistic professional commercial lighting, accurate contact shadows, believable reflections where appropriate, depth, clean composition, and strong product separation.
Remove distracting elements from the original environment and create a polished advertising scene appropriate to the selected style.
Create one hero product only unless the source image itself clearly contains multiple products.
Do not generate duplicate products.
Do not add people, hands, random text, fake logos, extra packaging, or unrelated objects.
Avoid warped packaging, malformed geometry, melted objects, changed brand names, misspelled labels, and distorted product proportions.
The image will be used as the starting frame of a 5-second product commercial, so create a visually strong scene with enough depth for subtle cinematic camera movement.
Keep the product as the unmistakable hero of the frame.`;
const QUICK_AD_BASE_PROMPT = 'A polished 5-second commercial product video using the supplied advertising image as the visual source. Preserve the exact product shape, proportions, colors, packaging, logo, branding, and label throughout the entire shot. Do not redesign, deform, duplicate, melt, or replace the product. Keep the product recognizable in every frame. Preserve the established scene and art direction. Use controlled professional advertising cinematography, realistic physical motion, and smooth temporal consistency. No new text, products, people, or unrelated objects. End on a stable clear hero shot of the product.';
const IMAGE_STYLE_PROMPTS = Object.freeze({
  food: 'Create a premium food advertising scene around the original product. Make the food or beverage look fresh, appetizing, and professionally photographed. Use warm commercial food lighting with realistic highlights and shadows. Build a tasteful environment appropriate to the actual food or drink. Possible supporting details can include a premium tabletop, subtle ingredients that genuinely relate to the product, herbs, fruit, condensation, crumbs, sauce details, steam, or atmospheric depth where contextually appropriate. Do not overwhelm the product. Do not cover packaging, branding, or labels. Do not invent unrelated ingredients. Do not turn packaged food into a completely different food product. Use depth and foreground/background separation that can later support subtle motion. The result should resemble a polished restaurant, FMCG, or beverage advertising campaign rather than a casual kitchen snapshot.',
  reveal: 'Create a dramatic cinematic product advertising scene while preserving the exact uploaded product. Place the product in a premium dark studio environment with controlled contrast. Use a dark or deep neutral background, elegant surface, realistic contact shadow, and subtle reflections where appropriate. Use one carefully controlled hero light, rim light, or spotlight to separate the real product from the background. Add only very subtle atmospheric depth when appropriate. The scene should feel like the opening frame of a premium cinematic product reveal. Do not hide the product in darkness. Branding and product details must remain clearly readable and recognizable. Avoid excessive smoke, fantasy effects, neon clutter, or unrealistic reflections. Leave visual space and depth around the product so Kling can later animate a slow reveal.',
  studio: 'Create a clean premium studio advertising photograph of the exact uploaded product. Preserve the product perfectly. Use a seamless neutral studio environment appropriate to the product. Prefer soft beige, warm white, light grey, or another restrained neutral tone that complements the real product. Use large diffused commercial lighting, realistic soft contact shadows, and subtle depth. Keep props minimal or use none. Use clean geometry, generous negative space, and premium ecommerce/editorial composition. The result should feel like professional brand campaign photography rather than a plain catalogue cutout. Do not add unnecessary objects. Do not alter packaging, logos, product text, materials, or proportions. Keep the frame suitable for a subtle cinematic push-in during video generation.',
  social: 'Create an eye-catching modern social-media product advertising scene while preserving the exact uploaded product. Use a bold, polished commercial background that complements the actual product colors. The scene may use a vibrant gradient, modern podium, geometric forms, or controlled graphic depth where appropriate. Keep the actual product clearly dominant. Use crisp commercial lighting, strong visual separation, and an energetic composition. Create depth behind and around the product so the video stage can introduce faster camera motion and subtle background movement. Do not add text, fake slogans, or fake brand elements. Do not duplicate the product. Do not overcrowd the scene. The result should look like a professionally art-directed Instagram, TikTok, or digital product campaign rather than a generic AI image.'
});
const VIDEO_STYLE_PROMPTS = Object.freeze({
  food: 'Use an appetizing commercial food-film treatment. Use a smooth cinematic push-in or slight lateral camera move. Where appropriate to the existing generated scene, allow subtle realistic steam, condensation, tiny droplets, ingredient movement, or gentle atmospheric motion. Do not make the food explode. Do not create large splashes unless the generated image naturally contains a splash composition. Do not morph the food or packaging. Keep motion tasteful, believable, and premium.',
  reveal: 'Create a slow cinematic reveal. Use a controlled dolly-in, subtle orbit, or elegant camera approach depending on the scene. Allow the existing key light or rim light to gradually reveal more product detail. Very subtle atmospheric movement is allowed if already present in the scene. Maintain dark premium contrast. Do not spin the product aggressively. Do not change the product geometry. Finish on a fully visible premium hero frame.',
  studio: 'Use minimal premium motion. Apply a very slow smooth push-in, subtle parallax, or tiny camera slide. Allow extremely subtle natural shadow/light movement while keeping the studio background calm. The product itself should remain visually stable. No dramatic effects. No unnecessary particles. No aggressive rotation. The result should feel like a restrained high-end brand commercial.',
  social: 'Use a quicker but still smooth social-ad camera move. Use a confident push-in, small arc, or dynamic parallax movement. Allow controlled movement in existing gradient, lighting, or graphic background elements. A subtle light sweep may pass behind or around the product. Keep the main product stable and recognizable. Do not use chaotic shaking, extreme zooms, morphing, duplicated objects, or random effects. The result should feel energetic enough to stop a social-media scroll while still looking like a professional advertisement.'
});
const PROMPTS = Object.freeze({ ...VIDEO_STYLE_PROMPTS, fashion_studio: 'fashion_studio' });
const FASHION_GARMENT_PROMPT = 'Create a professional ecommerce invisible-mannequin photograph of the exact outfit in the supplied source photographs. Preserve visible garment identity: colour, fabric texture, print placement, embroidery, seams, buttons, zippers, pockets, sleeve shape, collar, hem, length, silhouette and proportions. Remove the person, body parts, mannequin, hanger and original environment. Present only the garment, naturally filled as though worn by an invisible mannequin, with realistic fabric volume and hollow openings where appropriate. Reconstruct only minimal hidden interior fabric needed for the hollow effect; do not invent decorative details. Keep all parts of the supplied outfit, if it is still present, intact and recognisable.';
const FASHION_VIEW_PROMPTS = Object.freeze({
  front: 'Front view: frame the full front of the garment with the neckline, shoulders, bodice, sleeves, waist, hem and inseam clearly visible; centre the garment in a clean white studio background with soft commercial lighting, subtle shadows and accurate garment proportions.',
  back: 'Back view: frame the full back of the garment with the back neckline, shoulders, back panels, sleeves, hem, closures, seam lines and any back details clearly readable; centre the garment in the same clean white studio background with soft commercial lighting, subtle shadows and accurate garment proportions.'
});

function sanitizeVideoPrompt(prompt) {
  const MAX_LENGTH = 2200;
  return String(prompt || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

function buildCommercialImagePrompt(style) {
  return sanitizeVideoPrompt(`${COMMERCIAL_IMAGE_BASE_PROMPT} ${IMAGE_STYLE_PROMPTS[style] || IMAGE_STYLE_PROMPTS.studio}`);
}

function buildFashionImagePrompt(view) {
  const viewPrompt = FASHION_VIEW_PROMPTS[view] || FASHION_VIEW_PROMPTS.front;
  return sanitizeVideoPrompt(`${FASHION_GARMENT_PROMPT} ${viewPrompt}`);
}

function buildQuickAdPrompt(style) {
  return `${QUICK_AD_BASE_PROMPT} ${VIDEO_STYLE_PROMPTS[style] || VIDEO_STYLE_PROMPTS.studio}`;
}

function supportsCommercialImageModel(model) {
  return typeof model === 'string' && /fal-ai\/nano-banana-2\/edit/i.test(model.trim());
}

async function runCommercialImageGeneration({ fal, model, prompt, imageUrls, controller, pollIntervalMs = 2000 }) {
  const submitted = await fal.queue.submit(model, {
    input: {
      prompt,
      image_urls: imageUrls,
      num_images: 1,
      aspect_ratio: '9:16',
      resolution: '1K',
      output_format: 'png',
      limit_generations: true
    },
    abortSignal: controller.signal
  });
  const requestId = submitted?.request_id;
  if (typeof requestId !== 'string' || !requestId.trim()) throw generationError('MISSING_REQUEST_ID');
  while (true) {
    controller.signal.throwIfAborted();
    const status = await fal.queue.status(model, { requestId, logs: false, abortSignal: controller.signal });
    if (status?.status === 'COMPLETED') break;
    if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status?.status)) throw generationError('INVALID_QUEUE_STATUS');
    await delay(pollIntervalMs, undefined, { signal: controller.signal });
  }
  const result = await fal.queue.result(model, { requestId, abortSignal: controller.signal });
  const generatedUrl = result?.data?.images?.[0]?.url || result?.data?.image?.url || result?.data?.image_url || result?.data?.url || result?.data?.output?.url;
  if (!isHttpsUrl(generatedUrl)) throw generationError('INVALID_IMAGE_URL');
  return { requestId, generatedUrl };
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
    limits: { fileSize: MAX_IMAGE_SIZE + 1, files: 2, fields: 3, fieldSize: 32 },
    fileFilter: (req, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        callback(Object.assign(new Error('Unsupported image'), { code: 'INVALID_IMAGE_TYPE' }));
      } else callback(null, true);
    }
  }).fields([
    { name: 'image', maxCount: 1 },
    { name: 'frontImage', maxCount: 1 },
    { name: 'backImage', maxCount: 1 }
  ]);

  router.post('/generate', authenticate, quickAdAccountOnly, (req, res, next) => {
    upload(req, res, error => {
      if (!error) return next();
      if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'Image must be 8 MB or smaller.' });
      if (error.code === 'LIMIT_UNEXPECTED_FILE') return res.status(400).json({ success: false, message: 'Only one product image or one front/back pair is allowed.' });
      const message = error.code === 'INVALID_IMAGE_TYPE'
        ? 'Only JPG, PNG, and WEBP images are supported.'
        : 'Send a valid product image or a front/back outfit pair as multipart/form-data.';
      return res.status(400).json({ success: false, message });
    });
  }, async (req, res) => {
    const files = req.files || {};
    const style = req.body?.style;
    const singleImage = Array.isArray(files.image) ? files.image[0] : null;
    const frontImage = Array.isArray(files.frontImage) ? files.frontImage[0] : null;
    const backImage = Array.isArray(files.backImage) ? files.backImage[0] : null;
    const unexpectedFields = Object.keys(req.body || {}).filter(key => !['style', 'image', 'frontImage', 'backImage'].includes(key));
    if (unexpectedFields.length > 0) {
      return res.status(400).json({ success: false, message: 'Unexpected request fields were provided.' });
    }
    if (typeof style !== 'string' || !Object.prototype.hasOwnProperty.call(PROMPTS, style)) {
      return res.status(400).json({ success: false, message: 'Style must be food, reveal, studio, social, or fashion_studio.' });
    }
    const isFashionStyle = style === 'fashion_studio';
    const hasOrdinaryImage = !!singleImage && !frontImage && !backImage;
    const hasFashionPair = !!frontImage && !!backImage && !singleImage;
    if (isFashionStyle) {
      if (!hasFashionPair) {
        return res.status(400).json({ success: false, message: 'Fashion Studio requires exactly one front photo and one back photo.' });
      }
    } else if (!hasOrdinaryImage) {
      return res.status(400).json({ success: false, message: 'Exactly one product image is required for this style.' });
    }
    const imageFiles = isFashionStyle ? [frontImage, backImage] : [singleImage];
    for (const imageFile of imageFiles) {
      if (!imageFile || !imageFile.buffer?.length) return res.status(400).json({ success: false, message: 'An image is required.' });
      if (imageFile.size > MAX_IMAGE_SIZE) return res.status(413).json({ success: false, message: 'Image must be 8 MB or smaller.' });
      if (!matchesImageType(imageFile)) return res.status(400).json({ success: false, message: 'The file must contain a valid JPG, PNG, or WEBP image.' });
    }
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
      if (!supportsCommercialImageModel(COMMERCIAL_IMAGE_MODEL)) {
        throw Object.assign(new Error('Quick Ads requires a Nano Banana 2 edit model.'), { code: 'UNSUPPORTED_IMAGE_MODEL' });
      }
      stage = 'credits';
      const reservation = await beginGeneration(DB, { userId: req.user.id, key, style, model: VIDEO_MODEL });
      generation = reservation.generation;
      if (reservation.reused) return res.json(publicGeneration(generation, await DB.User.findOne({ id: req.user.id })));
      controller.signal.throwIfAborted();
      stage = 'setup';
      const fal = await getFalClient();
      controller.signal.throwIfAborted();
      stage = 'upload';
      const sourceFiles = isFashionStyle ? [frontImage, backImage] : [singleImage];
      const uploadedSourceUrls = [];
      for (const sourceFile of sourceFiles) {
        const uploaded = await uploadImage(cloudinaryClient, sourceFile.buffer, controller.signal);
        delete sourceFile.buffer;
        const sourceImageUrl = uploaded?.secure_url;
        if (!isHttpsUrl(sourceImageUrl)) throw generationError('INVALID_IMAGE_URL');
        uploadedSourceUrls.push(sourceImageUrl);
      }
      const [firstSourceUrl, secondSourceUrl] = uploadedSourceUrls;
      await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { sourceImageUrl: firstSourceUrl, stage: 'preparing_image' } });
      stage = 'creating_scene';
      let primaryCommercialUrl = null;
      let primaryRequestId = null;
      let nextCommercialImage = null;
      if (isFashionStyle) {
        const frontPrompt = sanitizeVideoPrompt(buildFashionImagePrompt('front'));
        const frontCommercial = await runCommercialImageGeneration({
          fal,
          model: COMMERCIAL_IMAGE_MODEL,
          prompt: frontPrompt,
          imageUrls: [firstSourceUrl, secondSourceUrl],
          controller,
          pollIntervalMs
        });
        primaryCommercialUrl = frontCommercial.generatedUrl;
        primaryRequestId = frontCommercial.requestId;
        const backPrompt = sanitizeVideoPrompt(buildFashionImagePrompt('back'));
        const backCommercial = await runCommercialImageGeneration({
          fal,
          model: COMMERCIAL_IMAGE_MODEL,
          prompt: backPrompt,
          imageUrls: [secondSourceUrl, firstSourceUrl, primaryCommercialUrl],
          controller,
          pollIntervalMs
        });
        const nextCommercialUrl = backCommercial.generatedUrl;
        const commercialAsset = await persistCommercialImage(cloudinaryClient, nextCommercialUrl, generation, controller.signal);
        nextCommercialImage = {
          url: commercialAsset?.url || nextCommercialUrl,
          publicId: commercialAsset?.publicId || null,
          model: COMMERCIAL_IMAGE_MODEL,
          requestId: backCommercial.requestId
        };
        await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { commercialImage: nextCommercialImage, imageUrl: nextCommercialImage.url, sourceImageUrl: firstSourceUrl, stage: 'creating_video' } });
        requestId = backCommercial.requestId;
      } else {
        const commercialPrompt = sanitizeVideoPrompt(buildCommercialImagePrompt(style));
        const commercialQueue = await fal.queue.submit(COMMERCIAL_IMAGE_MODEL, {
          input: {
            prompt: commercialPrompt,
            image_urls: [firstSourceUrl],
            resolution: '1K',
            limit_generations: true
          },
          abortSignal: controller.signal
        });
        const commercialRequestId = commercialQueue?.request_id;
        if (typeof commercialRequestId !== 'string' || !commercialRequestId.trim()) throw generationError('MISSING_REQUEST_ID');
        requestId = commercialRequestId;
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
        const commercialUrl = commercialResult?.data?.images?.[0]?.url || commercialResult?.data?.image?.url || commercialResult?.data?.image_url || commercialResult?.data?.url || commercialResult?.data?.output?.url;
        if (!isHttpsUrl(commercialUrl)) throw generationError('INVALID_IMAGE_URL');
        const commercialAsset = await persistCommercialImage(cloudinaryClient, commercialUrl, generation, controller.signal);
        nextCommercialImage = {
          url: commercialAsset?.url || commercialUrl,
          publicId: commercialAsset?.publicId || null,
          model: COMMERCIAL_IMAGE_MODEL,
          requestId: commercialRequestId
        };
        await DB.QuickAdGeneration.updateOne({ id: generation.id, userId: req.user.id }, { $set: { commercialImage: nextCommercialImage, imageUrl: nextCommercialImage.url, sourceImageUrl: firstSourceUrl, stage: 'creating_video' } });
      }
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
      const isCommercialValidation = stage === 'creating_scene';
      const isVideoValidation = stage === 'creating_video';
      if ((['creating_scene', 'creating_video', 'submission', 'status', 'result'].includes(stage) && isFalValidationError(error))) {
        return res.status(400).json({
          success: false,
          code: isCommercialValidation ? 'IMAGE_PROVIDER_VALIDATION_ERROR' : 'VIDEO_PROVIDER_VALIDATION_ERROR',
          message: isCommercialValidation
            ? 'The commercial image generation request contained invalid parameters.'
            : 'The video generation request contained invalid parameters.'
        });
      }
      if (timedOut) return res.status(504).json({
        success: false, message: 'Generation timed out. It may still be processing; do not automatically submit again.',
        ...(requestId ? { requestId } : {})
      });
      const message = stage === 'upload' ? 'Image upload failed. Please try again.'
        : stage === 'creating_scene' ? 'We could not prepare your commercial scene. Please try another image.'
        : stage === 'creating_video' ? 'We could not animate your Quick Ad. Please try again.'
        : stage === 'setup' ? 'Quick Ads is temporarily unavailable.'
        : 'Video generation could not be completed. The provider may be unavailable or the image may not be supported.';
      return res.status(stage === 'setup' ? 503 : 502).json({ success: false, message, ...(requestId ? { requestId } : {}) });
    } finally {
      clearTimeout(timer);
      res.removeListener('close', disconnect);
      for (const imageFile of [singleImage, frontImage, backImage].filter(Boolean)) {
        delete imageFile.buffer;
      }
    }
  });
  return router;
}

module.exports = createQuickAdsRouter();
module.exports.createQuickAdsRouter = createQuickAdsRouter;
