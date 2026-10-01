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
const QUICK_AD_BASE_PROMPT = `
Create a professional 5-second vertical social media product advertisement using the uploaded image as the exact product reference.

The uploaded product must remain the hero subject throughout the video.

Preserve the exact product identity, packaging, colors, shape, proportions, branding, logo and recognizable visual details.

Transform the original image into a professionally designed commercial scene rather than simply animating the original photograph.

Create clear separation between foreground, product and background to produce realistic cinematic depth.

The product itself must have controlled visible movement such as a gentle lift, small rotation, forward motion, floating movement or natural settling depending on the selected advertising style.

Use realistic shadows, highlights and reflections so the product feels physically present inside the new environment.

Keep the product sharp, recognizable and visually dominant.

Do not redesign the product.
Do not change the packaging.
Do not change product colors.
Do not alter or invent logos.
Do not create unreadable branding.
Do not duplicate the product.
Do not deform the product.
Do not introduce people or hands unless explicitly requested elsewhere.
Do not generate promotional text inside the AI video.
`;
const PROMPTS = Object.freeze({
  food: `
STYLE: FOOD BURST

Create an energetic premium food or beverage commercial.

Replace or enhance the original background with a rich appetizing commercial environment that matches the uploaded product.

Animate the product with smooth hero motion:
- gently lift or float the product
- slightly rotate it
- subtly move it toward the camera
- keep the front branding readable whenever possible

Surround the product with category-relevant environmental motion.
Depending on the product, this may include ingredients, fruit, vegetables, herbs, seasoning particles, crumbs, ice, droplets, steam, sauce movement, liquid splashes, or food particles.
These elements should move around and behind the product without hiding it.

Use foreground elements passing closer to the camera and background elements moving more slowly to create strong depth and parallax.

Use warm, rich, appetizing commercial lighting.
Add realistic reflections and highlights to the packaging.
Use a smooth cinematic camera push-in.

Motion structure:
0–1 second: Quickly establish the commercial environment and introduce movement.
1–3.5 seconds: Show the strongest product motion, ingredient movement, particles and camera movement.
3.5–5 seconds: Reduce the environmental motion slightly and allow the product to settle into a strong centered hero composition.

The final frame should look suitable for adding a price, business name or call-to-action later.
Make the result feel like a high-end food advertisement, not an animated photograph.
`,
  reveal: `
STYLE: PRODUCT REVEAL

Create a cinematic premium product reveal advertisement.

Build a new commercial environment around the product using colors and visual styling inspired by the uploaded product.

At the beginning, the product should feel partially hidden, slightly distant, emerging from shadow, light, mist or another tasteful reveal element.

Animate the product smoothly moving forward into the hero position.
Add a small controlled rotation while the product enters the frame or moves toward the camera.
Avoid aggressive spinning.

Create a professional background using soft gradients, light beams, subtle atmospheric particles, reflections, soft shadows, abstract shapes, and color tones derived from the product.
Create clear foreground, middle-ground and background separation.

Use cinematic depth of field.
Add a smooth slow camera push toward the product.
Create subtle parallax between the background and product.
Add a soft moving highlight or light sweep across the product as it reaches the final hero position.

Motion structure:
0–1 second: Product begins partially hidden or distant.
1–3.5 seconds: Product moves forward, gently rotates and becomes fully revealed.
3.5–5 seconds: Product settles into a clean premium hero position while camera movement slows.

The final result should resemble a professionally produced commercial product reveal.
`,
  studio: `
STYLE: CLEAN STUDIO

Create a minimalist premium studio product commercial.

Replace the original background with a clean professional studio environment.
Choose a neutral or complementary background based on the uploaded product's colors.

The product may appear on a clean studio surface, subtle pedestal, minimal platform, or soft reflective surface.
Use realistic contact shadows and subtle reflections.

The product should not remain completely static.
Give it elegant controlled movement:
- slowly rise or settle into position
- gently rotate only a few degrees
- optionally move slightly toward the camera

Use a slow smooth camera push-in.
Add very subtle horizontal camera movement or parallax.

Use soft professional studio lighting.
Allow highlights to move slowly across the product to reveal its shape, texture and packaging.

The background should contain subtle depth, soft gradients and restrained atmospheric movement.
Avoid a flat static background.
Keep the background visually quiet so the product remains the main focus.

Motion structure:
0–1 second: Introduce the product and establish the premium studio setting.
1–3.5 seconds: Slow product movement, subtle rotation and soft camera movement.
3.5–5 seconds: Product settles into a very clean centered hero composition.

The style should feel modern, elegant and premium.
Do not add explosions, aggressive particles or chaotic movement.
`,
  social: `
STYLE: ATTENTION GRABBER

Create a bold high-energy short-form social media advertisement designed to attract attention immediately.

Transform the original image into a dynamic advertising environment built around the product's category and dominant colors.

The first second should contain an obvious visual change or motion.

Animate the product into the hero position using:
- controlled forward movement
- slight rotation
- quick scale/depth movement
- subtle cinematic bounce or settling movement
Do not use unrealistic uncontrolled spinning.

Keep the product large and visually dominant.

Generate energetic environmental motion around it using appropriate effects such as abstract shapes, particles, light streaks, splashes, fragments, category-related objects, or graphic motion elements.
Keep most effects behind or around the product.

Allow occasional foreground elements to move near the camera to create stronger depth and speed.

Use strong parallax between foreground effects, product and background.
Use a faster cinematic camera push during the first half of the video.
Then slow the camera movement and hold the product clearly toward the end.

Use dramatic but professional lighting, highlights and reflections.

Motion structure:
0–1 second: Strong attention-grabbing visual entrance.
1–3.5 seconds: Highest energy product motion, environmental movement and camera movement.
3.5–5 seconds: Motion becomes calmer and product settles into a clear hero composition.

The result should feel designed for TikTok, Instagram Reels and short social media advertisements.
It should stop the viewer's attention without making the product difficult to recognize.
`
});

function buildQuickAdPrompt(style) {
  const stylePrompts = {
    food: PROMPTS.food,
    reveal: PROMPTS.reveal,
    studio: PROMPTS.studio,
    social: PROMPTS.social,
  };

  const selectedStyle = stylePrompts[style] || stylePrompts.studio;

  return `
${QUICK_AD_BASE_PROMPT}

${selectedStyle}

FINAL VIDEO REQUIREMENTS:

Duration: approximately 5 seconds.

The video must immediately feel more polished than the uploaded static image.
The product should visibly move.
The environment/background should visibly move.
The camera should have controlled movement.
Maintain realistic product geometry.
Avoid morphing.
Avoid product duplication.
Avoid sudden packaging changes between frames.
Avoid unreadable or changing logos.
Do not generate random text.
Do not place fake promotional text around the product.
End with the product clearly visible in a stable hero position.
`;
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
      const finalPrompt = buildQuickAdPrompt(style);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[Quick Ads] Style:', style);
        console.log('[Quick Ads] Model:', MODEL);
        console.log('[Quick Ads] Final prompt:', finalPrompt);
      }
      const queued = await fal.queue.submit(MODEL, {
        // Kling 2.5 Turbo is silent; its schema has no generate_audio parameter.
        input: { image_url: imageUrl, prompt: finalPrompt, duration: '5', negative_prompt: NEGATIVE_PROMPT },
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
