// Provider list prices checked 2026-11-11. Estimates, never provider invoices.
const MODELS = Object.freeze({ image: 'fal-ai/nano-banana-2/edit', quick: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', motion: 'fal-ai/kling-video/v3/standard/image-to-video', tryon: 'fal-ai/fashn/tryon/v1.6' });
const STUDIO_CREDIT_COSTS = Object.freeze({ quick_ad: 1, fashion_mannequin: 1, fashion_model_5s: 2, fashion_model_10s: 3, product_studio: 1, auto_cinematic: 4, auto_voiceover: 7, commercial_standard: 4, commercial_premium: 7 });
const MODES = Object.freeze({
  quick_ad: { studio: 'quick', duration: 5, images: 1, video: MODELS.quick, estimate: .43 },
  fashion_mannequin: { studio: 'fashion', duration: 5, images: 2, video: MODELS.quick, estimate: .51 },
  fashion_model_5s: { studio: 'fashion', duration: 5, images: 2, video: MODELS.motion, estimate: .495, approval: true },
  fashion_model_10s: { studio: 'fashion', duration: 10, images: 2, video: MODELS.motion, estimate: .915, approval: true },
  product_studio: { studio: 'product', duration: 5, images: 5, video: MODELS.quick, estimate: .43 },
  auto_cinematic: { studio: 'auto', duration: 10, images: 5, video: MODELS.motion, estimate: 1 },
  auto_voiceover: { studio: 'auto', duration: 15, images: 5, video: MODELS.motion, estimate: 1.54 },
  commercial_standard: { studio: 'commercial', duration: 24, estimate: 3.84 },
  commercial_premium: { studio: 'commercial', duration: 24, estimate: 9.84 }
});
function presets(env = process.env) {
  // Only explicitly licensed adult model photographs, supplied by the operator.
  return ['hausa_male','hausa_female','yoruba_male','yoruba_female','igbo_male','igbo_female'].map(id => ({
    id, label: id.replace('_', ' '), image: env[`STUDIO_MODEL_${id.toUpperCase()}`] || '',
    modest: id.startsWith('hausa')
  })).filter(p => /^https:\/\/res\.cloudinary\.com\//.test(p.image));
}
function quote(mode, env = process.env) {
  const config = MODES[mode];
  if (!config) throw Object.assign(new Error('Choose a supported studio mode.'), { statusCode: 400, quickAdSafe: true });
  const override = env[`STUDIO_CREDITS_${mode.toUpperCase()}`];
  const fixed = ['quick_ad','fashion_mannequin'].includes(mode);
  const credits = fixed || override === undefined ? STUDIO_CREDIT_COSTS[mode] : Number(override);
  const rate = Number(env.USD_NGN_RATE), margin = Number(env.STUDIO_MIN_MARGIN), overhead = Number(env.STUDIO_OVERHEAD_USD);
  const valid = Number.isSafeInteger(credits) && credits > 0 && rate > 0 && Number.isFinite(rate) && margin >= 0 && margin < 1 && env.STUDIO_MIN_MARGIN !== undefined && overhead >= 0 && Number.isFinite(overhead) && env.STUDIO_OVERHEAD_USD !== undefined;
  // Lowest existing bundle yield, less a configurable payment-fee buffer.
  const fee = Number(env.STUDIO_PAYMENT_FEE_RATE ?? .02);
  const net = credits * 1250 * (1 - fee);
  const profitable = valid && fee >= 0 && fee < 1 && (net - (config.estimate + overhead) * rate) / net >= margin;
  const enabled = (env.STUDIO_ENABLED_MODES || '').split(',').includes(mode);
  const assetsReady = !config.approval || presets(env).length > 0;
  const voiceReady = mode !== 'auto_voiceover' || !!(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID && env.ELEVENLABS_COMMERCIAL_LICENSE === 'true');
  return { mode, ...config, credits, available: enabled && profitable && assetsReady && voiceReady,
    reason: !enabled ? 'Coming soon' : !profitable ? 'Pricing review in progress' : !assetsReady ? 'Model collection is being prepared' : !voiceReady ? 'Voiceover is being prepared' : '', estimatedCostUsd: config.estimate };
}
function requireMode(mode, env = process.env) {
  const result = quote(mode, env);
  if (!result.available) throw Object.assign(new Error(result.reason), { statusCode: 503, quickAdSafe: true });
  return result;
}
module.exports = { MODELS, MODES, STUDIO_CREDIT_COSTS, quote, requireMode, presets };
