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
  return createFalClient({ credentials });
}

async function runQueuedFalJob(fal, model, input, { signal, pollIntervalMs = 1500, onSubmitted } = {}) {
  const queued = await fal.queue.submit(model, { input, ...(signal ? { abortSignal: signal } : {}) });
  const requestId = queued?.request_id;
  if (typeof requestId !== 'string' || !requestId.trim()) throw new Error('The AI provider did not return a request ID.');
  if (onSubmitted) await onSubmitted(requestId);
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

function parseJsonObject(text) {
  const cleaned = String(text || '').trim()
    .replace(/^\`\`\`(?:json)?\s*/i, '')
    .replace(/\s*\`\`\`$/, '');
  const value = JSON.parse(cleaned);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Claude returned an invalid JSON object.');
  }
  return value;
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
      max_tokens: 1800,
      temperature: 0.4,
      system: [
        'You are SpreadFast’s commercial creative director for product advertisements.',
        'Return only valid JSON. Do not invent product features, materials, ingredients, claims, certifications, discounts, prices, or contact details.',
        'Keep the uploaded product visually faithful. Specifications are hard constraints; never add/remove physical details.',
        'Plan three short scenes for a commercial. Each scene must be feasible as one image-to-video clip of up to 8 seconds.',
        'Output schema: {"title":string,"voiceover":string,"scenes":[{"purpose":string,"imagePrompt":string,"motionPrompt":string,"durationSeconds":number}],"endCard":string,"accuracyRules":[string]}',
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
  const text = (payload.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  const plan = parseJsonObject(text);
  if (!Array.isArray(plan.scenes) || plan.scenes.length !== 3) {
    throw new Error('Claude returned a creative plan with an invalid scene count.');
  }
  plan.scenes = plan.scenes.map((scene, index) => ({
    purpose: String(scene.purpose || `Scene ${index + 1}`).slice(0, 160),
    imagePrompt: String(scene.imagePrompt || '').slice(0, 1800),
    motionPrompt: String(scene.motionPrompt || '').slice(0, 1800),
    durationSeconds: Math.min(8, Math.max(6, Number(scene.durationSeconds) || 8))
  }));
  plan.title = String(plan.title || `${brandName} ${productName} Commercial`).slice(0, 120);
  plan.voiceover = String(plan.voiceover || '').slice(0, 1200);
  plan.endCard = String(plan.endCard || '').slice(0, 300);
  return plan;
}

async function generateNanoBananaImage({ imageUrl, prompt, fal: providedFal, signal, onSubmitted }) {
  if (!isHttpsUrl(imageUrl)) throw new Error('A public HTTPS source image is required.');
  const fal = providedFal || await loadFalClient();
  const { requestId, data } = await runQueuedFalJob(fal, IMAGE_MODEL, {
    prompt: String(prompt || '').slice(0, 2200),
    image_urls: [imageUrl],
    num_images: 1,
    aspect_ratio: '9:16',
    resolution: '1K',
    output_format: 'png',
    limit_generations: true
  }, { signal, onSubmitted });
  const generatedUrl = data?.images?.[0]?.url || data?.image?.url || data?.image_url || data?.url || data?.output?.url;
  if (!isHttpsUrl(generatedUrl)) throw new Error('Nano Banana returned no valid scene image URL.');
  return { imageUrl: generatedUrl, requestId, model: IMAGE_MODEL };
}

/**
 * Standard uses Veo Fast; Premium uses the full Veo endpoint. Each call returns
 * one clip of up to 8 seconds, which the route assembles with the other scenes.
 */
async function generateVeoClip({ imageUrl, prompt, tier = 'standard', fal: providedFal, signal, onSubmitted, onQueueUpdate }) {
  if (!VEO_MODELS[tier]) throw new Error('Unsupported AI Commercials quality tier.');
  if (!isHttpsUrl(imageUrl)) throw new Error('A public HTTPS scene image URL is required.');
  const fal = providedFal || await loadFalClient();
  const { requestId, data } = await runQueuedFalJob(fal, VEO_MODELS[tier], {
    image_url: imageUrl,
    prompt: String(prompt || '').slice(0, 1800),
    aspect_ratio: '9:16',
    duration: '8s',
    generate_audio: true
  }, { signal, onSubmitted: async id => {
    if (onSubmitted) await onSubmitted(id);
    if (onQueueUpdate) await onQueueUpdate({ status: 'IN_PROGRESS', requestId: id });
  } });
  const videoUrl = data?.video?.url;
  if (!isHttpsUrl(videoUrl)) {
    throw new Error('Veo returned no valid video URL.');
  }
  return { videoUrl, requestId, model: VEO_MODELS[tier] };
}

module.exports = { createCreativePlan, generateNanoBananaImage, generateVeoClip, runQueuedFalJob, IMAGE_MODEL, VEO_MODELS };
