const { canRetryFinalization, canRetryCommercial } = require('./aiCommercialRecovery');
const { publicBranding } = require('./quickAdBranding');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { createHmac } = require('node:crypto');
const { accountSummary, fail } = require('./quickAdCredits');

const PREVIEW_TRANSFORMATION = [
  { width: 480, crop: 'limit' },
  { overlay: { font_family: 'Arial', font_size: 26, font_weight: 'bold', text: 'SpreadFast - Free Preview' },
    color: 'white', background: 'black', gravity: 'center', opacity: 70 },
  { video_codec: 'h264' }
];
function previewSecret() {
  if (!process.env.JWT_SECRET) throw new Error('Missing media signing configuration');
  // A preview token must never be accepted as a normal SpreadFast login token.
  return createHmac('sha256', process.env.JWT_SECRET).update('spreadfast:quick-ad-preview:v1').digest('hex');
}
function waitForUpload(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason || new Error('Upload aborted'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}
async function storeVideo(cloudinary, videoUrl, generation, signal) {
  signal.throwIfAborted();
  const uploaded = await waitForUpload(cloudinary.uploader.upload(videoUrl, {
    resource_type: 'video', type: 'authenticated',
    public_id: `spreadfast/quick-ads/videos/${generation.id}`, overwrite: false,
    format: 'mp4', timeout: 120000,
    ...(generation.freePreview ? { eager: [{ transformation: PREVIEW_TRANSFORMATION, format: 'mp4' }], eager_async: false } : {})
  }), signal);
  signal.throwIfAborted();
  if (!uploaded?.public_id) throw new Error('Missing protected video');
  const outputUrl = cloudinary.url(uploaded.public_id, {
    resource_type: 'video', type: 'authenticated', version: uploaded.version,
    format: 'mp4', sign_url: true, secure: true
  });
  const previewUrl = generation.freePreview ? uploaded.eager?.[0]?.secure_url : undefined;
  // Authenticated transformations must be generated eagerly; never fall back to the original.
  if (generation.freePreview && (!previewUrl || !previewUrl.includes('/video/authenticated/'))) {
    throw new Error('Protected preview was not prepared');
  }
  return { publicId: uploaded.public_id, outputUrl, ...(previewUrl ? { previewUrl } : {}) };
}
function videoLayerId(publicId) {
  return String(publicId).split('/').join(':');
}
async function assembleVideos(cloudinary, clips, generationId, endCardText = '') {
  if (!Array.isArray(clips) || clips.length < 1 || clips.some(clip => !clip?.publicId)) {
    throw new Error('All scene videos must be stored before assembly.');
  }
  const transformations = [];
  for (const clip of clips.slice(1)) {
    transformations.push(
      { overlay: `video:authenticated:${videoLayerId(clip.publicId)}`, flags: 'splice' },
      { width: 720, height: 1280, crop: 'fill' },
      { flags: 'layer_apply' }
    );
  }
  if (endCardText) {
    const durations = clips.map(clip => [4, 6, 8].includes(clip.durationSeconds) ? clip.durationSeconds : 8);
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    transformations.push(
      { overlay: { font_family: 'Arial', font_size: 42, font_weight: 'bold', text: endCardText.slice(0, 120) },
        color: 'white', background: '#18231e' },
      { width: 640, height: 180, crop: 'fit' },
      { flags: 'layer_apply', gravity: 'south', y: 80,
        start_offset: totalDuration - durations[durations.length - 1], end_offset: totalDuration }
    );
  }
  transformations.push({ video_codec: 'h264' });
  const base = clips[0].publicId;
  const result = await cloudinary.uploader.explicit(base, {
    resource_type: 'video',
    type: 'authenticated',
    eager: [{ transformation: transformations, format: 'mp4' }],
    eager_async: false,
    timeout: 300000
  });
  const eager = result?.eager?.[0];
  // Cloudinary may return an eager failure as data instead of throwing.
  if (!result?.public_id || eager?.status === 'failed' || eager?.error ||
      typeof eager?.secure_url !== 'string' || !eager.secure_url.startsWith('https://')) {
    throw Object.assign(new Error('Cloudinary could not assemble the protected commercial.'), {
      code: 'CLOUDINARY_ASSEMBLY_FAILED'
    });
  }
  // Authenticated derivatives MUST use signed delivery URLs. Do not reuse an
  // unsigned eager URL as an upload source: that remote fetch can fail with 401.
  const outputUrl = cloudinary.url(base, {
    resource_type: 'video', type: 'authenticated', format: 'mp4',
    transformation: transformations, sign_url: true, secure: true
  });
  if (!outputUrl?.startsWith('https://') ||
      !outputUrl.includes('/video/authenticated/s--')) {
    throw Object.assign(new Error('Cloudinary did not return a signed commercial URL.'), {
      code: 'CLOUDINARY_UNSIGNED_DERIVATIVE'
    });
  }
  return { publicId: base, outputUrl, originalOutputUrl: outputUrl, transformations };
}
// Keep trial provenance and credit accounting unchanged; verified lifetime purchases
// grant access even after the customer spends their remaining balance.
function canDownloadGeneration(generation, user) {
  if (generation.status !== 'completed' || generation.deletedAt) return false;
  if (generation.freePreview) return accountSummary(user).quickAdTotalCreditsPurchased > 0;
  return generation.creditUsed === true && generation.downloadable === true;
}
function publicGeneration(generation, user) {
  const recoveryAvailable = require('./quickAdRecovery').recoverable(generation);
  const result = { success: true, recoveryAvailable, provider: generation.provider || 'fal', creditsUsed: generation.creditsUsed || (generation.creditUsed ? generation.creditCost || 1 : 0), generationId: generation.id, style: generation.style, status: generation.status, stage: generation.stage || (generation.status === 'completed' ? 'completed' : 'queued'),
    createdAt: generation.createdAt, completedAt: generation.completedAt,
    freePreview: generation.freePreview, creditUsed: generation.creditUsed,
    branding: publicBranding(generation.branding),
    brandingStatus: generation.brandingStatus || (generation.branding?.mode && generation.branding.mode !== 'none' ? 'applied' : 'none'),
    commercialRecoveryRequired: generation.provider === 'ai-commercials' && generation.status === 'failed' &&
      (generation.sceneAssets || []).some(scene => (scene.imageSubmitting && !scene.imageRequestId) || (scene.videoSubmitting && !scene.videoRequestId)),
    commercialRetryAvailable: canRetryCommercial(generation),
    cancellationRequested: generation.cancellationRequested === true && generation.status === 'pending',
    cancelled: generation.failureCode === 'USER_CANCELLED',
    finalizationRetryAvailable: canRetryFinalization(generation),
    brandingRetryAvailable: generation.status === 'completed' && generation.brandingStatus === 'failed',
    downloadable: canDownloadGeneration(generation, user),
    ...accountSummary(user) };
  if (generation.provider === 'ai-commercials' && generation.commercialDetails) {
    result.completedScenes = (generation.sceneAssets || []).filter(scene => scene.videoPublicId).length;
    result.totalScenes = 3;
    result.productName = generation.commercialDetails.productName;
    result.brandName = generation.commercialDetails.brandName;
    result.contact = generation.commercialDetails.contact;
    result.specifications = generation.commercialDetails.specifications;
    result.tier = generation.commercialDetails.tier;
    result.requiredCredits = generation.commercialDetails.requiredCredits;
    result.title = generation.commercialDetails.title;
    result.voiceover = generation.commercialDetails.voiceover;
    result.endCard = generation.commercialDetails.endCard;
    result.sceneImages = (generation.sceneAssets || []).map(scene => ({
      imageUrl: scene.imageUrl,
      purpose: scene.purpose,
      durationSeconds: scene.durationSeconds
    }));
  }
  const commercialImageUrl = generation.commercialImage?.url || generation.imageUrl;
  // Return only generated image previews, never source uploads or internal metadata.
  if (commercialImageUrl) result.imageUrl = commercialImageUrl;
  if (generation.status !== 'completed') return result;
  if (generation.freePreview && !result.downloadable) {
    const token = jwt.sign({ generationId: generation.id, userId: user.id, tokenVersion: user.tokenVersion || 0 },
      previewSecret(), { algorithm: 'HS256', audience: 'quick-ad-preview', expiresIn: '5m' });
    result.previewPath = `/api/quick-ads/generations/${encodeURIComponent(generation.id)}/preview?token=${encodeURIComponent(token)}`;
    if (commercialImageUrl) result.imageUrl = commercialImageUrl;
  } else {
    result.videoUrl = generation.media?.outputUrl;
    result.imageUrl = commercialImageUrl || generation.imageUrl;
    result.requestId = generation.requestId;
  }
  return result;
}
function verifyPreviewToken(token) {
  return jwt.verify(token, previewSecret(), { algorithms: ['HS256'], audience: 'quick-ad-preview' });
}
function assertDownloadable(generation, user) {
  if (!canDownloadGeneration(generation, user)) {
    fail('QUICK_AD_DOWNLOAD_LOCKED', 'Buy any Quick Ads credit plan to unlock this video and create more ads.', 403);
  }
}
async function streamVideo(req, res, url, download = false, http = axios) {
  const range = req.headers.range;
  if (range && !/^bytes=\d*-\d*$/.test(range)) return res.sendStatus(416);
  const controller = new AbortController();
  const close = () => controller.abort();
  res.on('close', close);
  try {
    const upstream = await http.get(url, { responseType: 'stream', timeout: 30000, maxRedirects: 0,
      signal: controller.signal, headers: range ? { Range: range } : {},
      validateStatus: status => [200, 206, 416].includes(status) });
    res.status(upstream.status);
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      'Content-Type': 'video/mp4', 'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': download ? 'attachment; filename="spreadfast-quick-ad.mp4"' : 'inline' });
    for (const name of ['content-length', 'content-range', 'accept-ranges']) {
      if (upstream.headers[name]) res.set(name, upstream.headers[name]);
    }
    if (upstream.status === 416) { upstream.data.destroy(); res.end(); return; }
    upstream.data.on('error', () => res.destroy());
    upstream.data.pipe(res);
    res.once('finish', () => res.removeListener('close', close));
  } catch {
    res.removeListener('close', close);
    if (!res.destroyed && !res.headersSent) res.status(502).json({ success: false, message: 'The video could not be loaded. Please try again.' });
    else if (!res.destroyed) res.destroy();
  }
}
module.exports = { canDownloadGeneration, storeVideo, assembleVideos, publicGeneration, verifyPreviewToken, assertDownloadable, streamVideo, PREVIEW_TRANSFORMATION };

