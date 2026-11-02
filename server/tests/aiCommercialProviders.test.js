const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateNanoBananaImage,
  generateVeoClip,
  runQueuedFalJob,
  IMAGE_MODEL,
  VEO_MODELS
} = require('../services/aiCommercialProviders');

function fakeFal(resultData) {
  const calls = [];
  return {
    calls,
    queue: {
      async submit(model, args) {
        calls.push(['submit', model, args]);
        return { request_id: `request-${calls.length}` };
      },
      async status(model, args) {
        calls.push(['status', model, args]);
        return { status: 'COMPLETED' };
      },
      async result(model, args) {
        calls.push(['result', model, args]);
        return { data: resultData };
      }
    }
  };
}

test('Nano Banana generates one vertical scene image from the uploaded product reference', async () => {
  const fal = fakeFal({ images: [{ url: 'https://fal.example/scene.png' }] });
  const generated = await generateNanoBananaImage({
    fal,
    imageUrl: 'https://media.example/product.png',
    prompt: 'Preserve the exact product.',
    signal: new AbortController().signal
  });
  assert.equal(generated.imageUrl, 'https://fal.example/scene.png');
  assert.equal(generated.model, IMAGE_MODEL);
  assert.equal(fal.calls[0][1], IMAGE_MODEL);
  assert.deepEqual(fal.calls[0][2].input.image_urls, ['https://media.example/product.png']);
  assert.equal(fal.calls[0][2].input.num_images, 1);
  assert.equal(fal.calls[0][2].input.aspect_ratio, '9:16');
});

test('Veo receives the scene image, motion direction, tier model, and disables audio', async () => {
  const fal = fakeFal({ video: { url: 'https://fal.example/scene.mp4' } });
  const generated = await generateVeoClip({
    fal,
    tier: 'premium',
    imageUrl: 'https://media.example/scene.png',
    prompt: 'Slow product reveal.',
    signal: new AbortController().signal
  });
  assert.equal(generated.videoUrl, 'https://fal.example/scene.mp4');
  assert.equal(generated.model, VEO_MODELS.premium);
  assert.equal(fal.calls[0][1], VEO_MODELS.premium);
  assert.equal(fal.calls[0][2].input.image_url, 'https://media.example/scene.png');
  assert.equal(fal.calls[0][2].input.generate_audio, false);
  assert.equal(fal.calls[0][2].input.duration, '8s');
});

test('fal provider failures and invalid outputs are not converted into success-shaped results', async () => {
  const failedFal = fakeFal({});
  failedFal.queue.status = async () => ({ status: 'FAILED' });
  await assert.rejects(
    runQueuedFalJob(failedFal, IMAGE_MODEL, {}, { pollIntervalMs: 0 }),
    /ended with status FAILED/
  );
  await assert.rejects(
    generateNanoBananaImage({ fal: fakeFal({ images: [] }), imageUrl: 'https://media.example/product.png', prompt: '' }),
    /no valid scene image URL/
  );
});

test('resuming a known provider request never submits a new billable job', async () => {
  const fal = fakeFal({ video: { url: 'https://fal.example/resumed.mp4' } });
  await generateVeoClip({ fal, imageUrl: 'https://media.example/scene.png', prompt: 'Slow reveal', requestId: 'existing-request' });
  assert.equal(fal.calls.filter(c => c[0] === 'submit').length, 0);
  assert.equal(fal.calls[0][2].requestId, 'existing-request');
});

test('creative plan validation rejects empty prompts, wrong durations and incomplete direction', () => {
  const { validateCreativePlan } = require('../services/aiCommercialProviders');
  const plan = { title: 'Spot', concept: 'Reveal', productIdentity: 'Bottle', visualStyle: 'Studio', lighting: 'Soft', colorPalette: ['blue'], accuracyRules: ['Exact label'], finalCta: '',
    scenes: [6, 8, 7].map(durationSeconds => ({ purpose: 'Show product', composition: 'Center', cameraMovement: 'Pan', imagePrompt: 'Product in studio', motionPrompt: 'Slow pan', durationSeconds, transition: 'cut', onScreenText: '' })) };
  assert.equal(validateCreativePlan(plan), plan);
  for (const change of [p => { p.scenes[0].imagePrompt = ''; }, p => { p.scenes[0].durationSeconds = 8; }, p => { delete p.lighting; }, p => { p.scenes.pop(); }, p => { p.scenes[2].onScreenText = 'Invented claim'; }]) {
    const bad = structuredClone(plan); change(bad);
    assert.throws(() => validateCreativePlan(bad), /Invalid/);
  }
});

test('billable submission sends once on an ambiguous provider or network failure', async () => {
  const { submitFalOnce } = require('../services/aiCommercialProviders');
  for (const response of [async () => { throw new Error('Connection lost'); }, async () => ({ ok: false, status: 503 })]) {
    let calls = 0;
    await assert.rejects(submitFalOnce('test-only', VEO_MODELS.standard, { input: {} }, async (...args) => { calls++; return response(...args); }));
    assert.equal(calls, 1);
  }
});

test('Claude is called with a structured tool and malformed responses fail validation', async () => {
  const { createCreativePlan } = require('../services/aiCommercialProviders');
  const originalFetch = global.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'mock-only-key';
  let body;
  global.fetch = async (url, options) => {
    body = JSON.parse(options.body);
    return { ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'plan_commercial', input: { scenes: [] } }] }) };
  };
  try {
    await assert.rejects(createCreativePlan({ productName: 'Shirt', specifications: 'Keep the embroidery', imageUrl: 'https://example.test/shirt.png', tier: 'standard' }), /Invalid/);
    assert.equal(body.tool_choice.name, 'plan_commercial');
    assert.equal(body.tools[0].input_schema.properties.scenes.maxItems, 3);
    assert.ok(body.messages[0].content.some(part => part.text?.includes('Keep the embroidery')));
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  }
});
