const DEFAULT_CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929';
const VEO_MODELS = Object.freeze({
  standard: 'fal-ai/veo3.1/image-to-video',
  premium: 'fal-ai/veo3.1/fast/image-to-video'
});

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
    error.status = response.status === 429 ? 503 : 502;
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
  return plan;
}

/**
 * Uses fal's existing server-side SDK and queue. Standard = Veo 3.1;
 * Premium = Veo 3.1 Fast (less expensive, faster generation).
 * The model endpoint returns a single clip (up to 8 seconds), not a finished
 * 30-second edit; scene stitching and final-card rendering are separate stages.
 */
async function generateVeoClip({ imageUrl, prompt, tier = 'standard', onQueueUpdate }) {
  const credentials = requiredEnv('FAL_KEY');
  if (!VEO_MODELS[tier]) throw new Error('Unsupported AI Commercials quality tier.');
  if (!/^https:\/\//i.test(String(imageUrl || ''))) throw new Error('A public HTTPS image URL is required.');

  const { createFalClient } = await import('@fal-ai/client');
  const fal = createFalClient({ credentials });
  const result = await fal.subscribe(VEO_MODELS[tier], {
    input: {
      image_url: imageUrl,
      prompt: String(prompt || '').slice(0, 1800),
      aspect_ratio: '9:16',
      duration: '8s',
      generate_audio: false
    },
    logs: false,
    onQueueUpdate
  });
  const videoUrl = result?.data?.video?.url;
  if (!/^https:\/\//i.test(String(videoUrl || ''))) {
    throw new Error('Veo returned no valid video URL.');
  }
  return { videoUrl, requestId: result.requestId || null, model: VEO_MODELS[tier] };
}

module.exports = { createCreativePlan, generateVeoClip, VEO_MODELS };
