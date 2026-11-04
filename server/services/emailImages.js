const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
function validateImage(file) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.buffer.length) throw Object.assign(new Error('Choose an image to upload.'), { status: 400 });
  if (file.buffer.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('Choose an image smaller than 5 MB.'), { status: 413 });
  const b = file.buffer;
  const matches = (file.mimetype === 'image/jpeg' && b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255)
    || (file.mimetype === 'image/png' && b.length >= 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    || (file.mimetype === 'image/webp' && b.length >= 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP');
  if (!matches) throw Object.assign(new Error('Choose a valid JPG, PNG or WebP image.'), { status: 400 });
}
async function uploadEmailImage(file, media = require('cloudinary').v2) {
  validateImage(file);
  // Cloudinary decodes/re-encodes the image; PNG gives email clients a compatible format.
  const result = await new Promise((resolve, reject) => {
    const stream = media.uploader.upload_stream({ resource_type: 'image', folder: 'spreadfast/email-images', format: 'png',
      transformation: [{ width: 1200, height: 1600, crop: 'limit' }], timeout: 60000 }, (error, result) => error ? reject(error) : resolve(result));
    stream.on('error', reject);
    stream.end(file.buffer);
  });
  if (!result?.secure_url?.startsWith('https://') || result.resource_type !== 'image') throw new Error('Image upload failed');
  return result.secure_url;
}
module.exports = { MAX_IMAGE_BYTES, TYPES, validateImage, uploadEmailImage };
