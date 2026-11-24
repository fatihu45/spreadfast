const path = require('node:path');
const models = require('../config/fashionModels.json');
const { providerUrl } = require('./studioInputs');
// Only server-selected, versioned references can reach the provider.
async function resolveModelReference(cloudinary, input) {
  if (!input.modelAssetKey) return providerUrl(input.modelImage); // Existing jobs / operator overrides.
  const model = models.find(m => m.id === input.modelId && m.assetKey === input.modelAssetKey);
  if (!model) throw new Error('Unknown model reference');
  const result = await cloudinary.uploader.upload(path.join(__dirname, '../assets/fashion-models', `${model.assetKey}.webp`), {
    resource_type: 'image', public_id: `spreadfast/models/${model.assetKey}`, overwrite: false, timeout: 60000
  });
  return providerUrl(result.secure_url);
}
module.exports = { resolveModelReference };
