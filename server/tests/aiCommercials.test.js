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
  const storedVideos = [];
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
    authenticate: options.realAuth ? undefined : (req, res, next) => { req.user = { id: 'owner', role: 'company' }; next(); },
    createPlan: async input => {
      calls.push(['plan', input]);
      if (options.createPlan) return options.createPlan(input);
      return ({
      title: 'Three-scene product spot',
      voiceover: 'Meet the new product.',
      endCard: 'Shop today',
      scenes: [1, 2, 3].map(index => ({
        purpose: `Scene ${index}`,
        imagePrompt: `Set up scene ${index}`,
        motionPrompt: `Move camera for scene ${index}`,
        durationSeconds: [6, 8, 8][index - 1],
        narration: `Narration for scene ${index}`
      }))
    }); },
    generateImage: async input => {
      calls.push(['image', input.prompt, input.imageUrls, input.requestId]);
      if (input.onSubmitted && !input.requestId) await input.onSubmitted(`image-${calls.length}`);
      if (options.failImageAt === calls.filter(call => call[0] === 'image').length) throw new Error('Image generation failed');
      return { imageUrl: imageDataUrl, requestId: `image-${calls.length}` };
    },
    generateVideo: async input => {
      calls.push(['video', input.prompt, input.durationSeconds, input.requestId]);
      if (input.onSubmitted && !input.requestId) await input.onSubmitted(`video-${calls.length}`);
      if (options.generateVideo) return options.generateVideo(input);
      if (options.failVideoAt === calls.filter(call => call[0] === 'video').length) throw Object.assign(new Error('Video generation failed'), { providerTerminal: true });
      return { videoUrl: `https://fal.example/scene-${calls.length}.mp4`, requestId: `video-${calls.length}` };
    },
    persistVideo: async (client, url, generation) => {
      storedVideos.push(generation.id);
      if (options.failStoreAt && generation.id.endsWith(`scene-${options.failStoreAt}`)) throw new Error('Storage failed');
      return ({
      publicId: `spreadfast/quick-ads/videos/${generation.id}`,
      outputUrl: `https://res.cloudinary.com/test/video/authenticated/${generation.id}.mp4`,
      ...(generation.freePreview ? { previewUrl: 'https://res.cloudinary.com/test/video/authenticated/preview.mp4' } : {})
    }); },
    assemble: async (client, clips, id, endCard) => {
      calls.push(['assemble', clips.length, endCard]);
      if (options.assemble) return options.assemble(clips);
      if (options.failAssembly) throw new Error('Assembly failed');
      return {
        publicId: clips[0].publicId,
        outputUrl: `https://res.cloudinary.com/test/video/authenticated/${id}-assembled.mp4`,
        transformations: []
      };
    },
    brandingUpload: async () => ({ mode: 'logo', publicId: 'brand-logo' }),
    brandingRender: async (client, generation) => {
      calls.push(['branding']);
      if (options.failBranding) throw new Error('Branding failed');
      return { ...generation.media, outputUrl: 'https://res.cloudinary.com/test/video/authenticated/branded.mp4' };
    },
    logger: { error: (...args) => logs.push(args) }
  });
  const app = express();
  app.locals.db = db;
  app.use(express.json());
  app.use('/api/ai-commercials', router);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { calls, storedVideos, db, logs, base: `http://127.0.0.1:${server.address().port}` };
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

test('generates three scene images and clips, assembles them, stores history, and charges standard credits while preserving the Quick Ad preview', async t => {
  const f = await fixture(t);
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.success, true);
  assert.equal(result.freePreview, false);
  assert.equal(result.previewPath, undefined);
  assert.equal(result.downloadable, true);
  assert.equal(f.calls.filter(call => call[0] === 'image').length, 3);
  assert.equal(f.calls.filter(call => call[0] === 'video').length, 3);
  assert.deepEqual(f.calls.find(call => call[0] === 'assemble').slice(1), [3, 'shop.example']);
  const account = await f.db.User.findOne({ id: 'owner' });
  assert.equal(account.quickAdCredits, 6);
  assert.equal(account.quickAdFreePreviewUsed, false);
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


test('successful commercial uses only the three persisted scene clips and keeps assembled Cloudinary derivative', async t => {
  const f = await fixture(t);
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(f.storedVideos.length, 3, 'final Cloudinary derivative must not be uploaded again');
  const stored = await f.db.QuickAdGeneration.findOne({ id: result.generationId });
  assert.equal(stored.media.publicId, stored.sceneAssets[0].videoPublicId);
  assert.ok(stored.media.outputUrl.includes('-assembled.mp4'));
  assert.equal(stored.media.originalOutputUrl, stored.media.outputUrl);
  assert.equal(stored.creditUsed, true);
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
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdFreePreviewUsed, false);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});


test('unused Quick Ad trial cannot bypass commercial payment at either tier', async t => {
  for (const tier of ['standard', 'premium']) {
    const f = await fixture(t);
    await f.db.User.updateOne({ id: 'owner' }, { $set: { quickAdCredits: 0 } });
    const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form({ tier }) });
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 0);
    const credits = await fetch(`${f.base}/api/ai-commercials/credits`).then(r => r.json());
    assert.equal(credits.freePreviewAvailable, false);
  }
});

test('history excludes Quick Ads and deleted commercials; deletion preserves retry and billing records', async t => {
  const f = await fixture(t);
  const headers = { 'Idempotency-Key': 'delete-replay' };
  const result = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: form() }).then(r => r.json());
  await f.db.QuickAdGeneration.create({ id: 'quick', userId: 'owner', provider: 'fal' });
  await f.db.QuickAdGeneration.create({ id: 'other', userId: 'someone-else', provider: 'ai-commercials' });
  let history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(r => r.json());
  assert.equal(history.jobs.length, 1);
  assert.ok(history.jobs[0].createdAt);
  const deleted = await fetch(`${f.base}/api/ai-commercials/jobs/${result.generationId}`, { method: 'DELETE' });
  assert.equal(deleted.status, 200);
  const stored = await f.db.QuickAdGeneration.findOne({ id: result.generationId });
  assert.ok(stored.deletedAt);
  assert.equal(stored.creditsUsed, 4);
  history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(r => r.json());
  assert.equal(history.jobs.length, 0);
  const count = f.calls.length;
  const replay = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: form() });
  assert.equal(replay.status, 410);
  assert.equal(f.calls.length, count);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/other`, { method: 'DELETE' })).status, 404);
});

test('failed assembly retries saved scenes with no extra AI calls and charges exactly once', async t => {
  const options = { failAssembly: true };
  const f = await fixture(t, options);
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(r => r.json());
  const job = history.jobs[0];
  assert.equal(job.finalizationRetryAvailable, true);
  assert.equal(job.requiredCredits, 4);
  options.failAssembly = false;
  const retry = () => fetch(`${f.base}/api/ai-commercials/jobs/${job.generationId}/retry`, { method: 'POST' });
  const responses = await Promise.all([retry(), retry()]);
  assert.ok(responses.some(r => r.status === 200));
  assert.ok(responses.every(r => [200, 409].includes(r.status)));
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
  assert.equal(f.calls.filter(c => c[0] === 'assemble').length, 2);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
  assert.equal((await retry()).status, 200);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});

test('logo failure keeps the protected original; retry skips assembly and preserves credits until success', async t => {
  const options = { failBranding: true };
  const f = await fixture(t, options);
  const data = form();
  data.append('logo', new Blob([image], { type: 'image/png' }), 'logo.png');
  const result = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: data });
  assert.equal(result.status, 502);
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.ok(job.media.originalOutputUrl);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
  const retry = () => fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' });
  assert.equal((await retry()).status, 502);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
  options.failBranding = false;
  assert.equal((await retry()).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'assemble').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});

test('retry enforces ownership, sufficient credits, and deletion', async t => {
  const f = await fixture(t, { failAssembly: true });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  await f.db.User.updateOne({ id: 'owner' }, { $set: { quickAdCredits: 0 } });
  const retry = id => fetch(`${f.base}/api/ai-commercials/jobs/${id}/retry`, { method: 'POST' });
  assert.equal((await retry(job.id)).status, 403);
  assert.equal(f.calls.filter(c => c[0] === 'assemble').length, 1);
  assert.equal((await retry('foreign')).status, 404);
  await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}`, { method: 'DELETE' });
  assert.equal((await retry(job.id)).status, 404);
});

test('each scene receives its own narration and duration', async t => {
  const f = await fixture(t);
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const clips = f.calls.filter(c => c[0] === 'video');
  assert.deepEqual(clips.map(c => c[2]), [6, 8, 8]);
  clips.forEach((clip, index) => assert.ok(clip[1].includes(`Narration for scene ${index + 1}`)));
});


test('photo and brief generate a paid commercial with automatic direction and no branding fields', async t => {
  const f = await fixture(t);
  const data = form();
  for (const key of ['productName', 'brandName', 'contact', 'style', 'tier']) data.delete(key);
  data.set('specifications', 'Warm tea advert with a pouring shot. Preserve packaging.');
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: data });
  const result = await response.json();
  assert.equal(response.status, 200);
  const brief = f.calls.find(call => call[0] === 'plan')[1];
  assert.equal(brief.style, 'auto');
  assert.equal(brief.specifications, data.get('specifications'));
  assert.equal(brief.brandName, '');
  assert.equal(brief.tier, 'standard');
  assert.equal(f.calls.find(call => call[0] === 'assemble')[2], 'Discover more');
  const saved = await f.db.QuickAdGeneration.findOne({ id: result.generationId });
  assert.equal(saved.style, 'auto');
  assert.equal(result.freePreview, false);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
  const edit = await fetch(`${f.base}/api/ai-commercials/jobs/${result.generationId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ specifications: 'Updated brief', productName: '', brandName: '' })
  });
  assert.equal(edit.status, 200);
});

for (const code of ['AI_PROVIDER_NOT_CONFIGURED', 'OPENROUTER_AUTH_FAILED', 'OPENROUTER_INSUFFICIENT_CREDITS', 'OPENROUTER_RATE_LIMITED', 'OPENROUTER_TIMEOUT', 'CREATIVE_PLAN_CANCELLED', 'CREATIVE_PLAN_INVALID']) {
  test(`planning failure ${code} releases reservation before any media costs`, async t => {
    const f = await fixture(t, { createPlan: async () => { throw Object.assign(new Error('secret provider body'), { code, statusCode: 503 }); } });
    const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /secret|OpenRouter|Claude/);
    assert.doesNotMatch(JSON.stringify(f.logs), /secret provider body/);
    assert.equal(f.calls.length, 1);
    const user = await f.db.User.findOne({ id: 'owner' });
    assert.equal(user.quickAdCredits, 10);
    assert.equal(user.quickAdGenerationLock, null);
    const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
    const { failGeneration } = require('../services/quickAdCredits');
    await failGeneration(f.db, { userId: 'owner', id: job.id });
    assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
  });
}

test('all scenes must be valid before the first paid media request', async t => {
  const f = await fixture(t, { createPlan: async () => ({ scenes: [
    { imagePrompt: 'valid', motionPrompt: 'valid', narration: '' }, {}, {}
  ] }) });
  const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  assert.equal(response.status, 502);
  assert.equal(f.calls.length, 1);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdGenerationLock, null);
});

test('duplicate requests during planning cannot start another plan or release the active lock', async t => {
  let entered;
  const started = new Promise(resolve => { entered = resolve; });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { createPlan: async () => { entered(); await gate; throw new Error('planning failed'); } });
  const headers = { 'Idempotency-Key': 'concurrent-plan' };
  const first = fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: form() });
  await started;
  try {
    for (const key of ['concurrent-plan', 'different-key']) {
      const duplicate = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { 'Idempotency-Key': key }, body: form() });
      assert.equal(duplicate.status, 409);
      assert.ok((await f.db.User.findOne({ id: 'owner' })).quickAdGenerationLock);
    }
    assert.equal(f.calls.length, 1);
  } finally { release(); }
  assert.equal((await first).status, 502);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
});


test('commercial routes enforce real authentication and current account role before provider calls', async t => {
  const f = await fixture(t, { realAuth: true });
  for (const auth of ['', 'Bearer invalid']) {
    const response = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers: { Authorization: auth }, body: form() });
    assert.equal(response.status, 401);
  }
  const jwt = require('jsonwebtoken');
  const headers = { Authorization: `Bearer ${jwt.sign({ id: 'owner' }, process.env.JWT_SECRET)}` };
  await f.db.User.updateOne({ id: 'owner' }, { $set: { role: 'admin' } });
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', headers, body: form() })).status, 403);
  await f.db.User.updateOne({ id: 'owner' }, { $set: { role: 'company', status: 'suspended' } });
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs`, { headers })).status, 403);
  assert.equal(f.calls.length, 0);
});

test('foreign commercial records cannot be edited, deleted or finalized', async t => {
  const f = await fixture(t);
  await f.db.QuickAdGeneration.create({ id: 'foreign', userId: 'another', provider: 'ai-commercials', status: 'failed' });
  for (const [path, method] of [['foreign', 'PATCH'], ['foreign', 'DELETE'], ['foreign/retry', 'POST']]) {
    assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${path}`, { method })).status, 404);
  }
  assert.equal(f.calls.length, 0);
});

test('legacy paid jobs retain stored six-second closing scenes on finalization retry', async t => {
  const f = await fixture(t, { failAssembly: true });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  job.sceneAssets[2].durationSeconds = 6;
  await f.db.QuickAdGeneration.updateOne({ id: job.id }, { $set: { sceneAssets: job.sceneAssets } });
  const { claimFinalization } = require('../services/aiCommercialRecovery');
  const claimed = await claimFinalization(f.db, { id: job.id, userId: 'owner', leaseMs: 10000 });
  assert.deepEqual(claimed.generation.sceneAssets.map(scene => scene.durationSeconds), [6, 8, 6]);
  assert.equal(claimed.generation.creditCost, 4);
});

test('up to four product angles reach planning and every scene image generator, with logo excluded', async t => {
  const f = await fixture(t); const data = form();
  for (let i = 0; i < 3; i++) data.append('productImage', new Blob([image], { type: 'image/png' }), `angle-${i}.png`);
  data.append('logo', new Blob([image], { type: 'image/png' }), 'logo.png');
  const result = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: data });
  assert.equal(result.status, 200);
  const plan = f.calls.find(c => c[0] === 'plan')[1];
  assert.equal(plan.imageUrls.length, 4);
  assert.equal(new Set(plan.imageUrls).size, 4);
  for (const call of f.calls.filter(c => c[0] === 'image')) assert.deepEqual(call[2], plan.imageUrls);
});

test('invalid extra photos and more than four photos fail before reservations or providers', async t => {
  const f = await fixture(t);
  const invalid = form(); invalid.append('productImage', new Blob(['invalid'], { type: 'image/png' }), 'bad.png');
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: invalid })).status, 400);
  const tooMany = form(); for (let i = 0; i < 4; i++) tooMany.append('productImage', new Blob([image], { type: 'image/png' }), `${i}.png`);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: tooMany })).status, 400);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.db.QuickAdGeneration.find({})).length, 0);
});

test('retry reuses the plan, first complete clip and second scene image after a terminal video failure', async t => {
  const options = { failVideoAt: 2 }; const f = await fixture(t, options);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() })).status, 502);
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.ok(job.creativePlan); assert.ok(job.sceneAssets[0].videoPublicId); assert.ok(job.sceneAssets[1].imageUrl);
  const history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(r => r.json());
  assert.equal(history.jobs[0].commercialRetryAvailable, true);
  assert.equal(history.jobs[0].creativePlan, undefined);
  options.failVideoAt = null;
  const retry = await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' });
  assert.equal(retry.status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'plan').length, 1);
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 4);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
  assert.equal((await f.db.QuickAdGeneration.find({ userId: 'owner' })).length, 1);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});

test('storage failure reuses generated video URL without submitting a second video job', async t => {
  const options = { failStoreAt: 2 }; const f = await fixture(t, options);
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.ok(job.sceneAssets[1].generatedVideoUrl);
  options.failStoreAt = null;
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'video').length, 3);
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
});

test('transport failure resumes the saved provider request ID rather than resubmitting', async t => {
  let fail = true; const received = [];
  const f = await fixture(t, { generateVideo: async input => {
    received.push(input.requestId);
    if (fail) { fail = false; throw new Error('temporary connection failure'); }
    return { videoUrl: 'https://fal.example/result.mp4', requestId: input.requestId || 'new-request' };
  } });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  const savedId = job.sceneAssets[0].videoRequestId;
  assert.ok(savedId);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  assert.equal(received[1], savedId);
});

test('cancelling during planning aborts the active request, releases its lock and never starts media', async t => {
  let entered; const started = new Promise(resolve => { entered = resolve; });
  const f = await fixture(t, { createPlan: async ({ signal }) => {
    entered(); return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  } });
  const pending = fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  await started;
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  const cancel = () => fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/cancel`, { method: 'POST' });
  assert.equal((await cancel()).status, 200);
  assert.equal((await cancel()).status, 200);
  const response = await pending;
  assert.equal(response.status, 409);
  assert.match((await response.json()).message, /cancelled/);
  assert.equal(f.calls.length, 1);
  const user = await f.db.User.findOne({ id: 'owner' });
  assert.equal(user.quickAdCredits, 10); assert.equal(user.quickAdGenerationLock, null);
  assert.equal((await f.db.QuickAdGeneration.findOne({ id: job.id })).failureCode, 'USER_CANCELLED');
});

test('cancel wins against final assembly and prevents a late completion debit', async t => {
  let entered, release; const started = new Promise(r => { entered = r; }); const gate = new Promise(r => { release = r; });
  const f = await fixture(t, { assemble: async () => { entered(); await gate; return { outputUrl: 'https://media.example/final.mp4' }; } });
  const pending = fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  await started;
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  try { assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/cancel`, { method: 'POST' })).status, 200); }
  finally { release(); }
  assert.equal((await pending).status, 409);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
  assert.equal((await f.db.QuickAdGeneration.findOne({ id: job.id })).status, 'failed');
});

test('cancel endpoint rejects foreign, deleted and completed jobs', async t => {
  const f = await fixture(t);
  await f.db.QuickAdGeneration.create({ id: 'foreign', userId: 'other', provider: 'ai-commercials', status: 'pending' });
  await f.db.QuickAdGeneration.create({ id: 'deleted', userId: 'owner', provider: 'ai-commercials', status: 'failed', deletedAt: new Date() });
  const result = await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() }).then(r => r.json());
  for (const id of ['foreign', 'deleted']) assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${id}/cancel`, { method: 'POST' })).status, 404);
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${result.generationId}/cancel`, { method: 'POST' })).status, 409);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});

test('expired jobs resume with a new execution token; old cleanup and completion cannot affect the retry', async t => {
  const f = await fixture(t, { failVideoAt: 2 });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  await f.db.QuickAdGeneration.updateOne({ id: job.id }, { $set: { status: 'pending', expiresAt: new Date(0) } });
  const { claimFinalization } = require('../services/aiCommercialRecovery');
  const { failGeneration, finishGeneration } = require('../services/quickAdCredits');
  const next = await claimFinalization(f.db, { id: job.id, userId: 'owner', leaseMs: 10000 });
  assert.notEqual(next.generation.executionId, job.executionId);
  await failGeneration(f.db, { id: job.id, userId: 'owner', executionId: job.executionId });
  assert.equal((await f.db.QuickAdGeneration.findOne({ id: job.id })).status, 'pending');
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdGenerationLock, job.id);
  await assert.rejects(finishGeneration(f.db, { id: job.id, userId: 'owner', executionId: job.executionId, media: { publicId: 'old', outputUrl: 'https://old' } }), { code: 'GENERATION_EXPIRED' });
  await assert.rejects(claimFinalization(f.db, { id: job.id, userId: 'owner', leaseMs: 10000 }));
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 10);
});

test('an ambiguous submission without a provider ID is blocked from automatic repayment', async t => {
  const f = await fixture(t, { failVideoAt: 2 });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  job.sceneAssets[1].videoSubmitting = true;
  job.sceneAssets[1].videoRequestId = undefined;
  await f.db.QuickAdGeneration.updateOne({ id: job.id }, { $set: { sceneAssets: job.sceneAssets } });
  const calls = f.calls.length;
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 409);
  assert.equal(f.calls.length, calls);
  const history = await fetch(`${f.base}/api/ai-commercials/jobs`).then(r => r.json());
  assert.equal(history.jobs[0].commercialRecoveryRequired, true);
  assert.equal(history.jobs[0].commercialRetryAvailable, false);
});

test('new progress fields survive the production Mongoose schema', () => {
  const Generation = require('../models/QuickAdGeneration');
  const doc = new Generation({ id: 'schema', userId: 'owner', idempotencyKey: 'key', style: 'auto', model: 'model', freePreview: false, expiresAt: new Date(),
    executionId: 'attempt', cancellationRequested: true, sourceImageUrls: ['https://media.example/a.png'], creativePlan: { scenes: [{ imagePrompt: 'safe' }] },
    sceneAssets: [{ imageRequestId: 'image-id', videoRequestId: 'video-id', imageSubmitting: true, videoSubmitting: false,
      imageModel: 'image-model', videoModel: 'video-model', generatedImageUrl: 'https://image', generatedVideoUrl: 'https://video' }] });
  assert.equal(doc.validateSync(), undefined);
  const plain = doc.toObject();
  assert.equal(plain.executionId, 'attempt'); assert.equal(plain.cancellationRequested, true);
  assert.equal(plain.sceneAssets[0].imageRequestId, 'image-id'); assert.equal(plain.sceneAssets[0].videoRequestId, 'video-id');
  assert.equal(plain.sourceImageUrls.length, 1); assert.equal(plain.creativePlan.scenes.length, 1);
});

test('one resume replaces a known terminal provider request while retaining its scene image', async t => {
  let count = 0;
  const f = await fixture(t, { generateVideo: async input => {
    count++;
    if (count === 1) throw new Error('lost polling connection');
    if (count === 2) { assert.ok(input.requestId); throw Object.assign(new Error('provider cancelled'), { providerTerminal: true }); }
    if (count === 3) assert.equal(input.requestId, undefined);
    return { videoUrl: 'https://fal.example/result.mp4', requestId: input.requestId || `new-${count}` };
  } });
  await fetch(`${f.base}/api/ai-commercials/generate`, { method: 'POST', body: form() });
  const [job] = await f.db.QuickAdGeneration.find({ userId: 'owner' });
  assert.equal((await fetch(`${f.base}/api/ai-commercials/jobs/${job.id}/retry`, { method: 'POST' })).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'image').length, 3);
  assert.equal((await f.db.User.findOne({ id: 'owner' })).quickAdCredits, 6);
});
