const { setTimeout: delay } = require('node:timers/promises');

const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const IMAGE_MODEL = process.env.COMMERCIAL_IMAGE_MODEL || 'fal-ai/nano-banana-2/edit';
const VEO_MODELS = Object.freeze({
  standard: 'fal-ai/veo3.1/fast/image-to-video',
  premium: 'fal-ai/veo3.1/image-to-video'
});

function isHttpsUrl(value) {
  if (typeof value !== 'string') return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

async function loadFalClient() {
  const credentials = requiredEnv('FAL_KEY');
  const { createFalClient } = await import('@fal-ai/client');
  const fal = createFalClient({ credentials });
  // The SDK hard-codes retries for queue.submit, even when config.retry is zero.
  // A lost submission response is ambiguous: send this billable POST once only.
  return { ...fal, queue: { ...fal.queue, submit: (model, options) => submitFalOnce(credentials, model, options) } };
}

async function submitFalOnce(credentials, model, { input, abortSignal }, request = fetch) {
  if (![IMAGE_MODEL, ...Object.values(VEO_MODELS)].includes(model)) throw new Error('Unsupported commercial model.');
  const response = await request(`https://queue.fal.run/${model}`, {
    method: 'POST', headers: { Authorization: `Key ${credentials}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input), signal: abortSignal
  });
  if (!response.ok) throw new Error('Provider submission failed; reconcile the request before retrying.');
  return response.json();
}

async function runQueuedFalJob(fal, model, input, { signal, pollIntervalMs = 1500, onSubmitted, requestId: existingRequestId } = {}) {
  signal = signal || AbortSignal.timeout(15 * 60 * 1000);
  const queued = existingRequestId ? null : await fal.queue.submit(model, { input, ...(signal ? { abortSignal: signal } : {}) });
  const requestId = existingRequestId || queued?.request_id;
  if (typeof requestId !== 'string' || !requestId.trim()) throw new Error('The AI provider did not return a request ID.');
  if (!existingRequestId && onSubmitted) await onSubmitted(requestId);
  while (true) {
    if (signal?.aborted) signal.throwIfAborted();
    const status = await fal.queue.status(model, { requestId, logs: false, ...(signal ? { abortSignal: signal } : {}) });
    if (status?.status === 'COMPLETED') break;
    if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status?.status)) {
      throw new Error(`The AI provider job ended with status ${String(status?.status || 'unknown')}.`);
    }
    await delay(pollIntervalMs, undefined, signal ? { signal } : {});
  }
  const result = await fal.queue.result(model, { requestId, ...(signal ? { abortSignal: signal } : {}) });
  return { requestId, data: result?.data };
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`Missing required server configuration: ${name}`);
    error.code = 'AI_PROVIDER_NOT_CONFIGURED';
    error.status = 503;
    throw error;
  }
  return value;
}

const SCENE_DURATIONS = Object.freeze([6, 8, 7]);
const PLAN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['title', 'concept', 'productIdentity', 'visualStyle', 'colorPalette', 'lighting', 'accuracyRules', 'scenes', 'finalCta'],
  properties: {
    ...Object.fromEntries(['title', 'concept', 'productIdentity', 'visualStyle', 'lighting', 'finalCta'].map(key => [key, { type: 'string' }])),
    colorPalette: { type: 'array', items: { type: 'string' }, minItems: 1 },
    accuracyRules: { type: 'array', items: { type: 'string' }, minItems: 1 },
    scenes: { type: 'array', minItems: 3, maxItems: 3, items: {
      type: 'object', additionalProperties: false,
      required: ['purpose', 'composition', 'cameraMovement', 'imagePrompt', 'motionPrompt', 'durationSeconds', 'transition', 'onScreenText'],
      properties: {
        ...Object.fromEntries(['purpose', 'composition', 'cameraMovement', 'imagePrompt', 'motionPrompt', 'onScreenText'].map(key => [key, { type: 'string' }])),
        durationSeconds: { type: 'number', enum: [6, 7, 8] }, transition: { type: 'string', enum: ['cut'] }
      }
    } }
  }
};
function validateCreativePlan(plan) {
  const invalid = () => { throw new Error('Invalid commercial creative plan.'); };
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) invalid();
  for (const key of ['title', 'concept', 'productIdentity', 'visualStyle', 'lighting']) {
    if (typeof plan[key] !== 'string' || !plan[key].trim() || plan[key].length > 1800) invalid();
  }
  for (const key of ['colorPalette', 'accuracyRules']) {
    if (!Array.isArray(plan[key]) || !plan[key].length || plan[key].length > 20 || plan[key].some(v => typeof v !== 'string' || !v.trim() || v.length > 500)) invalid();
  }
  if (typeof plan.finalCta !== 'string' || plan.finalCta.length > 120) invalid();
  if (!Array.isArray(plan.scenes) || plan.scenes.length !== 3) invalid();
  plan.scenes.forEach((scene, index) => {
    if (!scene || scene.durationSeconds !== SCENE_DURATIONS[index] || scene.transition !== 'cut' || scene.onScreenText !== '') invalid();
    for (const key of ['purpose', 'composition', 'cameraMovement', 'imagePrompt', 'motionPrompt']) {
      if (typeof scene[key] !== 'string' || !scene[key].trim() || scene[key].length > 1800) invalid();
    }
  });
  return plan;
}
function continuityDirection(plan, specifications) {
  return [
    `One campaign: ${plan.concept}. Product: ${plan.productIdentity}.`,
    `Visual style: ${plan.visualStyle}. Palette: ${plan.colorPalette.join(', ')}. Lighting: ${plan.lighting}.`,
    'Keep the reference product unchanged: colors, patterns, stitching, labels, shape and proportions. No added details or unsupported claims. No text, narration, music or speech.',
    `Accuracy rules: ${plan.accuracyRules.join('; ')}`,
    specifications ? `User specifications (mandatory): ${specifications}` : ''
  ].filter(Boolean).join('\n');
}

/**
 * Uses Anthropic's Messages API directly. Claude is not a fal-hosted model;
 * keep ANTHROPIC_API_KEY on the backend and configure it in Render.
 */
async function createCreativePlan({ productName, brandName, contact, specifications, style, imageUrl, tier }) {
  const apiKey = requiredEnv('ANTHROPIC_API_KEY');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: DEFAULT_CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.4,
      tools: [{ name: 'plan_commercial', description: 'Plan one coherent product commercial.', input_schema: PLAN_SCHEMA }],
      tool_choice: { type: 'tool', name: 'plan_commercial' },
      system: [
        'You are SpreadFast’s commercial creative director for product advertisements.',
        'Return only valid JSON. Do not invent product features, materials, ingredients, claims, certifications, discounts, prices, or contact details.',
        'Keep the uploaded product visually faithful. Specifications are hard constraints; never add/remove physical details.',
        'Plan three short scenes for a commercial. Each scene must be feasible as one image-to-video clip of up to 8 seconds.',
        'Use the plan_commercial tool. First establish one concept, identity, palette and lighting shared by all scenes. Scene 1: hook, 6 seconds. Scene 2: product showcase, 8 seconds. Scene 3: premium closing, 7 seconds. All transitions are cut. onScreenText must be empty; finalCta must copy the supplied contact exactly or be empty.',
        'Use three scenes and 6-8 seconds per scene. Avoid readable text inside generated imagery; reserve text and logo for post-production.'
      ].join(' '),
      messages: [{
        role: 'user',
        content: [
          ...(imageUrl ? [{
            type: 'image',
            source: { type: 'url', url: imageUrl }
          }] : []),
          {
            type: 'text',
            text: JSON.stringify({
              task: 'Create a commercially useful three-scene product advert plan.',
              productName: String(productName || '').slice(0, 100),
              brandName: String(brandName || '').slice(0, 100),
              contact: String(contact || '').slice(0, 120),
              specifications: String(specifications || '').slice(0, 500),
              creativeStyle: style,
              qualityTier: tier,
              productImageUrl: imageUrl,
              constraints: [
                'Product identity and visible details must remain faithful to the source image.',
                'Do not place invented labels, logos, stitching, pockets, patterns, or accessories on the product.',
                'No unsupported performance, health, safety, or superiority claims.',
                'Make each scene visually distinct but keep the product consistent.'
              ]
            })
          }
        ]
      }]
    }),
    signal: AbortSignal.timeout(45000)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error('Creative planning provider request failed.');
    error.code = 'CLAUDE_REQUEST_FAILED';
    error.statusCode = response.status === 429 ? 503 : 502;
    error.providerStatus = response.status;
    throw error;
  }
  const plan = payload.content?.find(part => part.type === 'tool_use' && part.name === 'plan_commercial')?.input;
  return validateCreativePlan(plan);
}

async function generateNanoBananaImage({ imageUrl, referenceImageUrl, prompt, fal: providedFal, signal, onSubmitted, requestId }) {
  if (!isHttpsUrl(imageUrl)) throw new Error('A public HTTPS source image is required.');
  const fal = providedFal || await loadFalClient();
  const { requestId: completedRequestId, data } = await runQueuedFalJob(fal, IMAGE_MODEL, {
    prompt: String(prompt || '').slice(0, 12000),
    image_urls: [imageUrl, ...(isHttpsUrl(referenceImageUrl) ? [referenceImageUrl] : [])],
    num_images: 1,
    aspect_ratio: '9:16',
    resolution: '1K',
    output_format: 'png',
    limit_generations: true
  }, { signal, onSubmitted, requestId });
  const generatedUrl = data?.images?.[0]?.url || data?.image?.url || data?.image_url || data?.url || data?.output?.url;
  if (!isHttpsUrl(generatedUrl)) throw new Error('Nano Banana returned no valid scene image URL.');
  return { imageUrl: generatedUrl, requestId: completedRequestId, model: IMAGE_MODEL };
}

/**
 * Standard uses Veo Fast; Premium uses the full Veo endpoint. Each call returns
 * one clip of up to 8 seconds, which the route assembles with the other scenes.
 */
async function generateVeoClip({ imageUrl, prompt, tier = 'standard', fal: providedFal, signal, onSubmitted, onQueueUpdate, requestId }) {
  if (!VEO_MODELS[tier]) throw new Error('Unsupported AI Commercials quality tier.');
  if (!isHttpsUrl(imageUrl)) throw new Error('A public HTTPS scene image URL is required.');
  const fal = providedFal || await loadFalClient();
  const { requestId: completedRequestId, data } = await runQueuedFalJob(fal, VEO_MODELS[tier], {
    image_url: imageUrl,
    prompt: String(prompt || '').slice(0, 12000),
    aspect_ratio: '9:16',
    duration: '8s',
    generate_audio: false,
    resolution: '720p'
  }, { signal, requestId, onSubmitted: async id => {
    if (onSubmitted) await onSubmitted(id);
    if (onQueueUpdate) await onQueueUpdate({ status: 'IN_PROGRESS', requestId: id });
  } });
  const videoUrl = data?.video?.url;
  if (!isHttpsUrl(videoUrl)) {
    throw new Error('Veo returned no valid video URL.');
  }
  return { videoUrl, requestId: completedRequestId, model: VEO_MODELS[tier] };
}

module.exports = { submitFalOnce, validateCreativePlan, continuityDirection, SCENE_DURATIONS, PLAN_SCHEMA, createCreativePlan, generateNanoBananaImage, generateVeoClip, runQueuedFalJob, IMAGE_MODEL, VEO_MODELS };
