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
