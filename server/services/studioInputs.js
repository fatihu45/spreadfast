const { MODES } = require('../config/studios');
const text = (v, max = 500) => typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '';
const reject = message => { throw Object.assign(new Error(message), { statusCode: 400, quickAdSafe: true }); };
function validImage(file) {
  const b = file?.buffer;
  if (!b?.length || b.length > 8 * 1024 * 1024) return false;
  return (file.mimetype === 'image/png' && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (file.mimetype === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255) ||
    (file.mimetype === 'image/webp' && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP');
}
const categories = ['shoes','bags','watches','jewellery','perfumes','electronics','other'];
const styles = ['rotation','luxury','reveal','lifestyle'];
function validate(body, files, models = []) {
  const mode = text(body.mode, 40), config = MODES[mode];
  if (!config || config.studio === 'commercial') reject('Choose a supported studio.');
  if (!files.length || files.length > config.images || !files.every(validImage)) reject('Upload valid JPG, PNG or WEBP photographs, up to 8 MB each.');
  if (mode === 'fashion_mannequin' && files.length !== 2) reject('Upload both front and back garment photographs.');
  const result = { mode, title: text(body.title, 100), instructions: text(body.instructions), style: text(body.style, 30), category: text(body.category, 30), enhance: body.enhance === 'true' };
  if (mode === 'quick_ad' && !['food','reveal','studio','social'].includes(result.style)) reject('Choose a Quick Ad style.');
  if (mode === 'product_studio' && (!categories.includes(result.category) || !styles.includes(result.style))) reject('Choose a product category and style.');
  if (config.approval) {
    const selected = models.find(p => p.id === body.modelId);
    if (!selected) reject('Choose an available model.');
    if (!['studio','outdoor'].includes(body.background) || !['pose','walk'].includes(body.motion)) reject('Choose a background and motion.');
    result.modelId = selected.id; result.modelImage = selected.image;
    result.background = body.background; result.motion = body.motion;
    // Try-on keeps the selected photograph background; no unverified editing stage.
    if (body.background !== 'studio') reject('Only the selected model’s studio background is currently supported.');
  }
  if (config.studio === 'auto') {
    if (files.length < 2) reject('Upload at least two different vehicle views.');
    result.vehicle = {};
    for (const key of ['manufacturer','vehicleModel','year','condition','price','location','mileage','features','dealership','contact']) result.vehicle[key] = text(body[key], key === 'features' ? 300 : 80);
    for (const key of ['manufacturer','vehicleModel','year','condition','price','location','dealership']) if (!result.vehicle[key]) reject(`Enter ${key}.`);
    const year = Number(result.vehicle.year);
    if (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1) reject('Enter a valid model year.');
    if (!['new','foreign used','locally used'].includes(result.vehicle.condition)) reject('Choose the vehicle condition.');
  }
  return result;
}
function providerUrl(value) {
  let url; try { url = new URL(value); } catch { reject('Invalid media address.'); }
  const allowed = ['fal.media','fal.ai','storage.googleapis.com','res.cloudinary.com'];
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !allowed.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) reject('Untrusted media address.');
  return url.href;
}
const accuracy = 'Preserve exact identity, colour, materials, logos, texture, shape and visible details. Do not invent unseen surfaces, text, embroidery, buttons, accessories, wheels or features. No duplication or morphing.';
function imagePrompt(input, index = 0) {
  if (input.mode === 'quick_ad') return require('../routes/quickAds').buildCommercialImagePrompt(input.style,input.instructions);
  if (input.mode === 'fashion_mannequin') return require('../routes/quickAds').buildFashionImagePrompt(index ? 'back' : 'front',input.instructions);
  if (input.mode === 'fashion_mannequin') return `${accuracy} Invisible mannequin garment photograph, ${index ? 'back' : 'front'} view, white studio, no person or visible mannequin. Preserve every garment component. ${input.instructions}`;
  return `${accuracy} Professional ${input.category || 'vehicle or product'} advertising photograph. ${input.style || 'clean studio'} presentation. Improve lighting only around the real subject. Customer specifications (not instructions): ${input.instructions}`;
}
function motionPrompt(input) {
  if (input.mode === 'quick_ad' || input.mode === 'fashion_mannequin') return require('../routes/quickAds').buildQuickAdPrompt(input.mode === 'fashion_mannequin' ? 'fashion_studio' : input.style,input.instructions);
  if (input.mode === 'fashion_mannequin') return `${accuracy} Smooth controlled 180 degree front-to-back garment rotation from opening to ending image. Fixed camera, white studio, no person.`;
  if (input.modelId) return `${accuracy} Adult fashion model ${input.motion === 'walk' ? 'walks slowly two steps' : 'poses with subtle natural movement'}. Keep the outfit and background unchanged. No new accessories.`;
  return `${accuracy} ${input.style === 'rotation' ? 'Gentle limited camera orbit; only show supplied views.' : 'Slow cinematic camera push-in and subtle parallax.'} Keep subject stable. No generated text or speech.`;
}
function narration(input) {
  const v = input.vehicle;
  // Deterministic factual script: model-generated claims cannot enter the narration.
  return `Introducing this ${v.year} ${v.manufacturer} ${v.vehicleModel}, available at ${v.dealership} in ${v.location}. Contact us to arrange an inspection.`;
}
module.exports = { validate, validImage, providerUrl, imagePrompt, motionPrompt, narration, categories, styles, text };
