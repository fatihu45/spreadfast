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
    authenticate: (req, res, next) => { req.user = { id: 'owner', role: 'company', ...(req.headers['x-test-user'] ? { id: req.headers['x-test-user'] } : {}) }; next(); },
    createPlan: async () => ({
      title: 'Three-scene product spot',
      concept: 'A coherent reveal', productIdentity: 'Blue label product', visualStyle: 'Studio', colorPalette: ['blue'], lighting: 'Soft daylight', accuracyRules: ['Preserve the label'], finalCta: '',
      endCard: 'Shop today',
      scenes: [1, 2, 3].map(index => ({
        purpose: `Scene ${index}`,
        imagePrompt: `Set up scene ${index}`,
        motionPrompt: `Move camera for scene ${index}`,
        durationSeconds: [6, 8, 7][index - 1], composition: 'Centered', cameraMovement: 'Slow push', transition: 'cut', onScreenText: ''
      }))
    }),
    generateImage: async input => {
      calls.push(['image', input.prompt]);
      await input.onSubmitted?.(`image-${calls.length}`);
      if (options.failImageAt === calls.filter(call => call[0] === 'image').length) throw new Error('Image generation failed');
      return { imageUrl: imageDataUrl, requestId: `image-${calls.length}` };
    },
    generateVideo: async input => {
      calls.push(['video', input.prompt]);
      await input.onSubmitted?.(`video-${calls.length}`);
      if (options.failVideoAt === calls.filter(call => call[0] === 'video').length) throw new Error('Video generation failed');
      return { videoUrl: `https://fal.example/scene-${calls.length}.mp4`, requestId: `video-${calls.length}` };
    },
    persistVideo: async (client, url, generation) => ({
      durationSeconds: generation.id.includes("-scene-") ? 8 : 21,
      publicId: `spreadfast/quick-ads/videos/${generation.id}`,
      outputUrl: `https://res.cloudinary.com/test/video/authenticated/${generation.id}.mp4`,
      ...(generation.freePreview ? { previewUrl: 'https://res.cloudinary.com/test/video/authenticated/preview.mp4' } : {})
    }),
    assemble: async (client, clips, id, endCard) => {
      calls.push(['assemble', clips.length, endCard, clips.map(c => c.durationSeconds)]);
      if (options.failAssembly) throw new Error('Assembly failed');
      return {
        publicId: clips[0].publicId,
        outputUrl: `https://res.cloudinary.com/test/video/authenticated/${id}-assembled.mp4`,
        transformations: []
      };
    },
    brandingUpload: async () => ({ mode: 'logo', publicId: 'logo' }),
    brandingRender: async (client, job) => { if (options.failBranding) throw new Error('Branding failed'); return job.media; },
    logger: { error: (...args) => logs.push(args) }
  });
  const app = express();
  app.locals.db = db;
  app.use(express.json());
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
  assert.deepEqual(f.calls.find(call => call[0] === 'assemble').slice(1), [3, 'Test brand · shop.example', [6, 8, 7]]);
  const account = await f.db.User.findOne({ id: 'owner' });
  assert.equal(account.quickAdCredits, 10);
  assert.equal(account.quickAdFreePreviewUsed, true);
  const job = await f.db.QuickAdGeneration.findOne({ id: result.generationId });
  assert.equal(job.sceneAssets.length, 3);
  assert.equal(job.creativePlan.concept, 'A coherent reveal');
  assert.equal(job.durationSeconds, 21);
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
  assert.ok(f.logs.length >= 1);
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


test('replaying the same idempotency key returns the completed commercial without paying providers twice', async t => {
  const f = await fixture(t);
  const key = 'retry-safe-commercial-001';
  const first = await fetch(`${f.base}/api/ai-commercials/generate`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: form()
  });
  const firstResult = await first.json();
  assert.equal(first.status, 200);
  const callsAfterFirst = f.calls.length;

  const second = await fetch(`${f.base}/api/ai-commercials/generate`, {
    method: 'POST', headers: { 'Idempotency-Key': key }, body: form()
  });
  const secondResult = await second.json();
  assert.equal(second.status, 200);
  assert.equal(secondResult.generationId, firstResult.generationId);
  assert.equal(secondResult.reused, true);
  assert.equal(f.calls.length, callsAfterFirst);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdFreePreviewUsed, true);
});

test('standard deducts four credits exactly once, exposes actual duration and dates', async t => {
  const f = await fixture(t);
  await f.db.User.updateOne({ id: 'owner' }, { $set: { quickAdFreePreviewUsed: true } });
  const send = () => fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { 'Idempotency-Key': 'standard-once' }, body: form() });
  const result = await (await send()).json();
  await send();
  assert.equal(result.durationSeconds, 21);
  assert.ok(result.createdAt);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
});

test('assembly recovery reuses all scenes and charges once; retries after completion are rejected', async t => {
  const options = { failAssembly: true };
  const f = await fixture(t, options);
  await f.db.User.updateOne({ id: 'owner' }, { $set: { quickAdFreePreviewUsed: true } });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  options.failAssembly = false;
  const response = await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' });
  assert.equal(response.status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 409);
});

test('branding failure preserves final media and recovers without new provider calls', async t => {
  const options = { failBranding: true };
  const f = await fixture(t, options);
  const data = form();
  data.append('logo', new Blob([image], { type: 'image/png' }), 'logo.png');
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: data })).status, 502);
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.ok(job.media.publicId);
  const count = f.calls.length;
  options.failBranding = false;
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  assert.equal(f.calls.length, count);
});

test('history excludes Quick Ads, metadata edit preserves video, delete persists and preserves idempotency tombstone', async t => {
  const f = await fixture(t);
  const key = 'history-test';
  const result = await (await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: form() })).json();
  const id = result.generationId;
  const before = await f.db.QuickAdGeneration.findOne({ id });
  await f.db.QuickAdGeneration.create({ id: 'quick-ad', userId: 'owner', provider: 'fal', status: 'completed' });
  const patch = { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productName: 'New title', brandName: '' }) };
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${id}`, patch)).status, 200);
  assert.deepEqual((await f.db.QuickAdGeneration.findOne({ id })).media, before.media);
  const history = await (await fetch(`${f.base}/api/ai-commercials/jobs`)).json();
  assert.equal(history.jobs.length, 1);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await (await fetch(`${f.base}/api/ai-commercials/jobs`)).json()).jobs.length, 0);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: form() })).status, 409);
});

test('other users cannot edit, delete or recover a commercial', async t => {
  const f = await fixture(t, { failAssembly: true });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  for (const [method, suffix] of [['PATCH', ''], ['DELETE', ''], ['POST', '/retry']]) {
    const response = await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}${suffix}`, { method,
      headers: { 'x-test-user': 'intruder', 'Content-Type': 'application/json' },
      ...(method === 'PATCH' ? { body: JSON.stringify({ productName: 'Stolen' }) } : {}) });
    assert.equal(response.status, 404);
  }
});

test('recovery attempts are bounded and simultaneous retries cannot both claim a job', async t => {
  const f = await fixture(t, { failAssembly: true });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  const retry = () => fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' });
  await Promise.all([retry(), retry()]);
  await retry();
  assert.equal((await retry()).status, 409);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
});

test('same request key rejects a changed product brief', async t => {
  const f = await fixture(t);
  const headers = { 'Idempotency-Key': 'same-brief' };
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: form() });
  const changed = form(); changed.set('specifications', 'Different product');
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: changed })).status, 409);
});

test('failed second scene recovers its existing request and never repeats successful first scene', async t => {
  const options = { failVideoAt: 2 };
  const f = await fixture(t, options);
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  const first = job.sceneAssets[0].videoPublicId;
  assert.ok(job.sceneAssets[1].videoRequestId);
  options.failVideoAt = 0;
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  const complete = await f.db.QuickAdGeneration.findOne({ id: job.id });
  assert.equal(complete.sceneAssets[0].videoPublicId, first);
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
});

test('expired worker cannot release or charge a recovered reservation', async t => {
  const f = await fixture(t, { failAssembly: true });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  const { reserveRecovery } = require('../services/aiCommercialPipeline');
  const { failGeneration, finishGeneration } = require('../services/quickAdCredits');
  const current = await reserveRecovery(f.db, 'owner', job.id);
  await failGeneration(f.db, { userId: 'owner', id: job.id, runToken: job.runToken });
  assert.equal((await f.db.QuickAdGeneration.findOne({ id: job.id })).status, 'pending');
  await assert.rejects(finishGeneration(f.db, { userId: 'owner', id: job.id, runToken: job.runToken }), /no longer owns/);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdGenerationLock, current.id);
});

test('concurrent generate submissions produce one commercial', async t => {
  const f = await fixture(t);
  const send = () => fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { 'Idempotency-Key': 'concurrent' }, body: form() });
  const responses = await Promise.all([send(), send()]);
  assert.ok(responses.some(r => r.status === 200));
  assert.ok(responses.every(r => [200, 409].includes(r.status)));
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
});
