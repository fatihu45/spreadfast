const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Writable } = require('node:stream');
const express = require('express');
const { createAiCommercialsRouter } = require('../routes/aiCommercials');
const { quickAdsDb } = require('./helpers/quickAdsDb');

const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTf8AAAAASUVORK5CYII=', 'base64');
const imageDataUrl = `data:image/png;base64,${image.toString('base64')}`;
const previousJwtSecret = process.env.JWT_SECRET;
test.before(() => { process.env.JWT_SECRET = 'ai-commercials-test-secret'; });
test.after(() => {
  if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousJwtSecret;
});

async function fixture(t, options = {}) {
  const calls = [];
  const logs = [];
  const db = quickAdsDb([{
    id: 'owner',
    role: 'company',
    status: 'active',
    quickAdCredits: 10,
    quickAdFreePreviewUsed: false
  }]);
  const cloudinary = {
    uploader: {
      upload_stream(settings, callback) {
        return new Writable({
          write(chunk, encoding, done) { done(); },
          final(done) {
            callback(null, {
              public_id: `${settings.folder}/${settings.public_id}`,
              secure_url: `https://res.cloudinary.com/test/image/upload/${settings.public_id}.png`,
              version: 1
            });
            done();
          }
        });
      }
    }
  };
  const router = createAiCommercialsRouter({
    cloudinary,
    authenticate: (req, res, next) => { req.user = { id: 'owner', role: 'company' }; next(); },
    createPlan: async () => ({
      title: 'Three-scene product spot',
      voiceover: 'Meet the new product.',
      endCard: 'Shop today',
      scenes: [1, 2, 3].map(index => ({
        purpose: `Scene ${index}`,
        imagePrompt: `Set up scene ${index}`,
        motionPrompt: `Move camera for scene ${index}`,
        durationSeconds: 8
      }))
    }),
    generateImage: async input => {
      calls.push(['image', input.prompt]);
      if (options.failImageAt === calls.filter(call => call[0] === 'image').length) throw new Error('Image generation failed');
      return { imageUrl: imageDataUrl, requestId: `image-${calls.length}` };
    },
    generateVideo: async input => {
      calls.push(['video', input.prompt]);
      if (options.failVideoAt === calls.filter(call => call[0] === 'video').length) throw new Error('Video generation failed');
      return { videoUrl: `https://fal.example/scene-${calls.length}.mp4`, requestId: `video-${calls.length}` };
    },
    persistVideo: async (client, url, generation) => ({
      publicId: `spreadfast/quick-ads/videos/${generation.id}`,
      outputUrl: `https://res.cloudinary.com/test/video/authenticated/${generation.id}.mp4`,
      ...(generation.freePreview ? { previewUrl: 'https://res.cloudinary.com/test/video/authenticated/preview.mp4' } : {})
    }),
    assemble: async (client, clips, id, endCard) => {
      calls.push(['assemble', clips.length, endCard]);
      if (options.failAssembly) throw new Error('Assembly failed');
      return {
        publicId: clips[0].publicId,
        outputUrl: `https://res.cloudinary.com/test/video/authenticated/${id}-assembled.mp4`,
        transformations: []
      };
    },
    logger: { error: (...args) => logs.push(args) }
  });
  const app = express();
  app.locals.db = db;
  app.use('/api/ai-commercials', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { calls, db, logs, base: `http://127.0.0.1:${server.address().port}` };
}

function form({ tier = 'standard' } = {}) {
  const data = new FormData();
  data.append('productName', 'Test product');
  data.append('brandName', 'Test brand');
  data.append('contact', 'shop.example');
  data.append('specifications', 'Keep the blue label');
  data.append('style', 'cinematic');
  data.append('tier', tier);
  data.append('productImage', new Blob([image], { type: 'image/png' }), 'product.png');
  return data;
}

test('generates three scene images and clips, assembles them, stores history, and uses a free preview without credits', async t => {
  const f = await fixture(t);
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.freePreview, true);
  assert.equal(result.previewPath.startsWith('/api/quick-ads/generations/'), true);
  assert.equal(f.calls.filter(call => call[0] === 'image').length, 3);
  assert.equal(f.calls.filter(call => call[0] === 'video').length, 3);
  assert.deepEqual(f.calls.find(call => call[0] === 'assemble').slice(1), [3, 'shop.example']);
  const account = await f.db.User.findOne({ id: 'owner' });
  assert.equal(account.quickAdCredits, 10);
  assert.equal(account.quickAdFreePreviewUsed, true);
  const job = await f.db.QuickAdGeneration.findOne({ id: result.generationId });
  assert.equal(job.sceneAssets.length, 3);
  assert.equal(job.commercialDetails.voiceover, 'Meet the new product.');
  const history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(response => response.json());
  assert.equal(history.jobs[0].productName, 'Test product');
  assert.equal(history.jobs[0].sceneImages.length, 3);
});

test('failed scene generation releases its lock and leaves credits and free preview eligibility untouched', async t => {
  const f = await fixture(t, { failVideoAt: 2 });
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  assert.equal(response.status, 502);
  const account = await f.db.User.findOne({ id: 'owner' });
  assert.equal(account.quickAdGenerationLock, null);
  assert.equal(account.quickAdCredits, 10);
  assert.equal(account.quickAdFreePreviewUsed, false);
  assert.equal(f.logs.length, 1);
  const jobs = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.equal(jobs[0].status, 'failed');
});

test('assembly failure releases the reservation without consuming the free preview or paid credits', async t => {
  const f = await fixture(t, { failAssembly: true });
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  assert.equal(response.status, 502);
  const account = await f.db.User.findOne({ id: 'owner' });
  assert.equal(account.quickAdGenerationLock, null);
  assert.equal(account.quickAdCredits, 10);
  assert.equal(account.quickAdFreePreviewUsed, false);
  const jobs = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.equal(jobs[0].failureCode, 'ASSEMBLY_FAILED');
});

test('premium generations reserve and deduct seven credits only after a successful final output', async t => {
  const f = await fixture(t);
  await f.db.User.updateOne({ id: 'owner' }, { $set: { quickAdFreePreviewUsed: true } });
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form({ tier: 'premium' }) });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.requiredCredits, 7);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 3);
  assert.equal((await f.db.QuickAdGeneration.findOne({ id: result.generationId })).creditsUsed, 7);
});
