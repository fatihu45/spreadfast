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
// Keep trial provenance and credit accounting unchanged; verified lifetime purchases
// grant access even after the customer spends their remaining balance.
function canDownloadGeneration(generation, user) {
  if (generation.status !== 'completed' || generation.deletedAt) return false;
  if (generation.freePreview) return accountSummary(user).quickAdTotalCreditsPurchased > 0;
  return generation.creditUsed === true && generation.downloadable === true;
}
function publicGeneration(generation, user) {
  const result = { success: true, generationId: generation.id, style: generation.style, status: generation.status, stage: generation.stage || (generation.status === 'completed' ? 'completed' : 'queued'),
    freePreview: generation.freePreview, creditUsed: generation.creditUsed,
    downloadable: canDownloadGeneration(generation, user),
    ...accountSummary(user) };
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
module.exports = { canDownloadGeneration, storeVideo, publicGeneration, verifyPreviewToken, assertDownloadable, streamVideo, PREVIEW_TRANSFORMATION };
