const { randomUUID } = require('node:crypto');
const { fail } = require('./quickAdCredits');

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
function readBranding(body = {}, file) {
  const mode = body.brandingMode || 'none';
  if (!['none', 'name', 'logo'].includes(mode)) fail('INVALID_BRANDING', 'Choose a business name or logo.', 400);
  if (mode !== 'logo' && file) fail('INVALID_BRANDING', 'Choose either a business name or a logo.', 400);
  if (mode === 'name') {
    if (typeof body.businessName !== 'string') fail('INVALID_BRANDING', 'Enter your business name.', 400);
    const name = body.businessName.trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 40 || /[\p{Cc}\p{Cf}]/u.test(name)) fail('INVALID_BRANDING', 'Use a business name of 1–40 characters.', 400);
    return { mode, name };
  }
  if (mode === 'logo') {
    const b = file?.buffer;
    const valid = b && ((file.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
      (file.mimetype === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
      (file.mimetype === 'image/webp' && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'));
    if (!valid || !b.length || b.length > MAX_LOGO_SIZE) fail('INVALID_LOGO', 'Choose a valid PNG, JPG, or WEBP logo up to 2 MB.', 400);
  }
  return { mode };
}
async function uploadBranding(client, branding, file) {
  if (branding.mode !== 'logo') return branding;
  const asset = await new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream({ resource_type: 'image', type: 'authenticated',
      public_id: `spreadfast/quick-ads/logos/${randomUUID()}`, format: 'png',
      transformation: [{ width: 600, height: 600, crop: 'limit' }], timeout: 60000
    }, (error, result) => error ? reject(error) : resolve(result));
    stream.end(file.buffer);
  });
  if (!asset?.public_id || !asset.width || !asset.height) throw new Error('Logo could not be prepared');
  return { mode: 'logo', publicId: asset.public_id, logoUrl: client.url(asset.public_id, {
    resource_type: 'image', type: 'authenticated', format: 'png', version: asset.version, sign_url: true, secure: true
  }) };
}
function brandingTransformation(branding) {
  if (!branding || branding.mode === 'none') return [];
  // Cloudinary layer IDs use colons rather than slashes for folder separators.
  // Keep the authenticated layer type explicit so the private logo is not made public.
  const overlay = branding.mode === 'logo'
    ? { public_id: branding.publicId.split('/').join(':'), type: 'authenticated' }
    : { font_family: 'Arial', font_size: 48, font_weight: 'bold', text: branding.name };
  return [
    { overlay, ...(branding.mode === 'name' ? { color: 'white', background: '#242424' } : {}) },
    { width: branding.mode === 'logo' ? 0.18 : 0.32, height: 0.10, crop: 'fit', flags: 'relative' },
    { flags: 'layer_apply', gravity: 'north_west', x: 0.05, y: 0.05 }
  ];
}
function publicBranding(branding) {
  return { mode: branding?.mode || 'none', ...(branding?.mode === 'name' ? { name: branding.name } : {}),
    ...(branding?.mode === 'logo' ? { logoUrl: branding.logoUrl } : {}) };
}
// Both edits and initial branding start from the untouched authenticated video.
// Prepare derivatives eagerly: authenticated originals never become public uploads.
async function renderBranding(client, generation, branding, previewTransformation) {
  const media = generation.media;
  const originalOutputUrl = media.originalOutputUrl || media.outputUrl;
  const transform = brandingTransformation(branding);
  const eager = [];
  if (transform.length) eager.push({ transformation: [...transform, { video_codec: 'h264' }], format: 'mp4' });
  if (generation.freePreview) eager.push({ transformation: [...transform, ...previewTransformation], format: 'mp4' });
  if (!eager.length) return { ...media, originalOutputUrl, outputUrl: originalOutputUrl };
  const rendered = await client.uploader.explicit(media.publicId, { resource_type: 'video', type: 'authenticated',
    eager, eager_async: false, timeout: 120000 });
  const urls = rendered.eager?.map(item => item.secure_url) || [];
  if (urls.length !== eager.length || urls.some(url => typeof url !== 'string' || !url.startsWith('https://') || !url.includes('/video/authenticated/'))) {
    throw new Error('Branded video could not be prepared');
  }
  return { ...media, originalOutputUrl, outputUrl: transform.length ? urls[0] : originalOutputUrl,
    ...(generation.freePreview ? { previewUrl: urls[urls.length - 1] } : {}) };
}
module.exports = { MAX_LOGO_SIZE, readBranding, uploadBranding, brandingTransformation, publicBranding, renderBranding };
