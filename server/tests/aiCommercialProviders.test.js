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

test('Veo receives the scene image, motion direction, tier model, and narration audio request', async () => {
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
  assert.equal(fal.calls[0][2].input.generate_audio, true);
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


test('Veo accepts the six-second scenes and rejects unsupported lengths before submitting', async () => {
  const fal = fakeFal({ video: { url: 'https://fal.example/scene.mp4' } });
  await generateVeoClip({ fal, imageUrl: 'https://media.example/scene.png', prompt: 'A hook', durationSeconds: 6 });
  assert.equal(fal.calls[0][2].input.duration, '6s');
  assert.equal(fal.calls[0][2].input.resolution, '720p');
  await assert.rejects(generateVeoClip({ fal, imageUrl: 'https://media.example/scene.png', durationSeconds: 7 }), /Unsupported video duration/);
  assert.equal(fal.calls.filter(c => c[0] === 'submit').length, 1);
});

test('creative scene validation enforces timing, distinct narration, and complete prompts', () => {
  const { normalizeScenes } = require('../services/aiCommercialProviders');
  const scenes = [1, 2, 3].map(i => ({ imagePrompt: `Image ${i}`, motionPrompt: `Motion ${i}`, narration: `Scene ${i}`, durationSeconds: 99 }));
  assert.deepEqual(normalizeScenes(scenes).map(s => s.durationSeconds), [8, 8, 8]);
  assert.equal(normalizeScenes(scenes)[1].narration, 'Scene 2');
  assert.throws(() => normalizeScenes([{}, ...scenes.slice(1)]), /directions/);
  scenes[0].narration = Array(20).fill('word').join(' ');
  assert.throws(() => normalizeScenes(scenes), /too long/);
});


test('Claude receives the photo and customer brief with automatic professional direction', async t => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey; });
  let request;
  t.mock.method(global, 'fetch', async (url, options) => {
    request = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ title: 'Product Commercial', voiceover: '', endCard: '', accuracyRules: [], scenes: [1,2,3].map(i => ({ purpose: 'Scene', durationSeconds: 8, imagePrompt: `Shot ${i}`, motionPrompt: 'Slow push in', narration: '' })) }) } }] }) };
  });
  const { createCreativePlan } = require('../services/aiCommercialProviders');
  const plan = await createCreativePlan({ imageUrl: 'https://media.example/tea.png', specifications: 'Warm light; preserve packaging.', tier: 'standard' });
  const content = request.messages[1].content;
  assert.equal(content[0].image_url.url, 'https://media.example/tea.png');
  const brief = JSON.parse(content[1].text);
  assert.equal(brief.creativeStyle, 'auto');
  assert.equal(brief.customerBrief, 'Warm light; preserve packaging.');
  assert.match(request.messages[0].content, /one coherent visual story/);
  assert.match(request.messages[0].content, /never invent a brand or contact/);
  assert.equal(plan.title, 'Product Commercial');
  assert.deepEqual(plan.scenes.map(s => s.durationSeconds), [8, 8, 8]);
});

test('saved fal request IDs poll the existing job without paying for another submit', async () => {
  const fal = fakeFal({ video: { url: 'https://fal.example/saved.mp4' } });
  const video = await generateVeoClip({ fal, imageUrl: 'https://media.example/scene.png', requestId: 'saved-request' });
  assert.equal(video.requestId, 'saved-request');
  assert.equal(fal.calls.filter(c => c[0] === 'submit').length, 0);
  assert.equal(fal.calls[0][2].requestId, 'saved-request');
});

test('customer cancellation attempts fal queue cancellation without resubmission', async () => {
  const controller = new AbortController();
  const fal = fakeFal({}); let cancelledId;
  fal.queue.cancel = async (model, { requestId }) => { cancelledId = requestId; };
  fal.queue.status = async () => { controller.abort(Object.assign(new Error('Cancelled'), { code: 'USER_CANCELLED' })); throw controller.signal.reason; };
  await assert.rejects(runQueuedFalJob(fal, IMAGE_MODEL, {}, { signal: controller.signal, requestId: 'cancel-me' }), { code: 'USER_CANCELLED' });
  assert.equal(cancelledId, 'cancel-me');
  assert.equal(fal.calls.filter(c => c[0] === 'submit').length, 0);
});

test('multiple reference photos are sent together to Nano Banana', async () => {
  const fal = fakeFal({ images: [{ url: 'https://fal.example/scene.png' }] });
  const images = ['https://media.example/front.png', 'https://media.example/back.png'];
  await generateNanoBananaImage({ fal, imageUrl: images[0], imageUrls: images, prompt: 'Same product' });
  assert.deepEqual(fal.calls[0][2].input.image_urls, images);
});

test('installed fal SDK cannot silently retry an ambiguous paid submission', async t => {
  const previous = process.env.FAL_KEY; process.env.FAL_KEY = 'mock-only-fal-key';
  t.after(() => { if (previous === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = previous; });
  let requests = 0;
  t.mock.method(global, 'fetch', async () => { requests++; throw new TypeError('fetch failed'); });
  await assert.rejects(generateNanoBananaImage({ imageUrl: 'https://media.example/product.png', prompt: 'Product' }), { code: 'PROVIDER_SUBMISSION_UNKNOWN' });
  assert.equal(requests, 1);
});


test('invalid first Claude plan retries planning before submitting media jobs', async t => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey; });
  let calls = 0;
  const valid = {
    title: 'Tea', voiceover: '', endCard: '', accuracyRules: [],
    scenes: [1, 2, 3].map(i => ({
      purpose: 'Scene', imagePrompt: 'Close-up of tea', motionPrompt: 'Slow camera pan',
      durationSeconds: i === 1 ? 6 : 8, narration: ''
    }))
  };
  t.mock.method(global, 'fetch', async () => {
    calls++;
    return { ok: true, json: async () => ({
      choices: [{ finish_reason: 'stop', message: {
        content: calls === 1 ? '{"title":"incomplete"}' : JSON.stringify(valid)
      } }]
    }) };
  });
  const { createCreativePlan } = require('../services/aiCommercialProviders');
  const plan = await createCreativePlan({ imageUrl: 'https://media.example/tea.png' });
  assert.equal(calls, 2);
  assert.equal(plan.scenes.length, 3);
});

test('OpenRouter text-part responses and fenced JSON are supported', async t => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey; });
  const valid = {
    title: 'Tea', voiceover: '', endCard: '', accuracyRules: [],
    scenes: [1, 2, 3].map(i => ({
      purpose: 'Scene', imagePrompt: 'Product shot', motionPrompt: 'Camera push',
      durationSeconds: i === 1 ? 6 : 8, narration: ''
    }))
  };
  t.mock.method(global, 'fetch', async () => ({
    ok: true, json: async () => ({
      choices: [{ finish_reason: 'stop', message: { content: [
        { type: 'text', text: '```json\n' + JSON.stringify(valid) + '\n```' }
      ] } }]
    })
  }));
  const { createCreativePlan } = require('../services/aiCommercialProviders');
  const plan = await createCreativePlan({ imageUrl: 'https://media.example/tea.png' });
  assert.equal(plan.title, 'Tea');
});

test('invalid Claude plans fail after a bounded retry without submitting paid media', async t => {
  const oldKey = process.env.OPENROUTER_API_KEY;
  process.env.OPENROUTER_API_KEY = 'test-key';
  t.after(() => { if (oldKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = oldKey; });
  let calls = 0;
  t.mock.method(global, 'fetch', async () => {
    calls++;
    return { ok: true, json: async () => ({
      choices: [{ finish_reason: 'stop', message: { content: '{"scenes":[]}' } }]
    }) };
  });
  const { createCreativePlan } = require('../services/aiCommercialProviders');
  await assert.rejects(createCreativePlan({ imageUrl: 'https://media.example/tea.png' }), { code: 'CREATIVE_PLAN_INVALID' });
  assert.equal(calls, 2);
});
