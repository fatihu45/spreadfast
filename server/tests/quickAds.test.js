const test = require('node:test');
const assert = require('node:assert/strict');
const { Writable } = require('node:stream');
const { once } = require('node:events');
const express = require('express');
const jwt = require('jsonwebtoken');
const { createQuickAdsRouter } = require('../routes/quickAds');
const { quickAdsDb } = require('./helpers/quickAdsDb');

const MODEL = 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video';
const IMAGE_URL = 'https://res.cloudinary.com/test/image/upload/meal.png';
const VIDEO_URL = 'https://fal.media/test-ad.mp4';
const TEST_KEY = 'test-only-provider-secret';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTf8AAAAASUVORK5CYII=', 'base64');
const prior = { FAL_KEY: process.env.FAL_KEY, JWT_SECRET: process.env.JWT_SECRET };
test.before(() => { process.env.FAL_KEY = TEST_KEY; process.env.JWT_SECRET = 'quick-ads-test-only-jwt'; });
test.after(() => {
  for (const [key, value] of Object.entries(prior)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('the installed fal SDK supports the dynamic server-side import', async () => {
  const { createFalClient } = await import('@fal-ai/client');
  const fal = createFalClient({ credentials: TEST_KEY });
  assert.equal(typeof fal.queue.submit, 'function');
  assert.equal(typeof fal.queue.status, 'function');
  assert.equal(typeof fal.queue.result, 'function');
});

function form({ style = 'food', bytes = png, type = 'image/png', field = 'image', extra = false } = {}) {
  const body = new FormData();
  if (style !== null) body.append('style', style);
  if (bytes !== null) body.append(field, new Blob([bytes], { type }), 'product.png');
  if (extra) body.append('image', new Blob([png], { type: 'image/png' }), 'second.png');
  return body;
}

async function fixture(t, options = {}) {
  const calls = [];
  const logs = [];
  let imageNumber = 0;
  let brandingAttempts = 0;
  const cloudinaryClient = {
    config: () => options.noCloudinary ? {} : { cloud_name: 'test', api_key: 'test', api_secret: 'test' },
    url: id => `https://res.cloudinary.com/test/image/authenticated/${id}.png`,
    uploader: {
      explicit: async (id, settings) => {
        calls.push(['branding', id, settings]);
        if (options.failBrandingOnce && brandingAttempts++ === 0) throw new Error('temporary logo render failure');
        return { eager: settings.eager.map((entry, index) => ({ secure_url: `https://res.cloudinary.com/test/video/authenticated/branded-${index}.mp4` })) };
      },
      upload_stream(uploadOptions, callback) {
        calls.push(['upload', uploadOptions]);
        return new Writable({
          write(chunk, encoding, done) { calls.push(['buffer', Buffer.from(chunk)]); done(); },
          final(done) {
            if (!options.hangUpload) callback(options.uploadError || null, { public_id: uploadOptions.public_id, width: 400, height: 200, secure_url: options.distinctImages ? `https://media.example/source-${++imageNumber}.png` : IMAGE_URL });
            done();
          }
        });
      }
    }
  };
  if (options.distinctImages) cloudinaryClient.uploader.upload = (url, settings, callback) => {
    calls.push(['persistImage', url, settings]);
    callback(null, { secure_url: `https://media.example/${settings.public_id}.png`, public_id: settings.public_id });
  };
  let statusIndex = 0;
  const fal = { queue: {
    async submit(model, args) {
      calls.push(['submit', model, args]);
      if (options.submitError) throw options.submitError;
      return options.badSubmission ? {} : { request_id: options.distinctImages ? `request-${calls.filter(c => c[0] === 'submit').length}` : 'test-request-123' };
    },
    async status(model, args) {
      calls.push(['status', model, args]);
      if (options.beforeStatus) await options.beforeStatus(model, args);
      if (options.statusError) throw options.statusError;
      if (options.hangStatus) return new Promise((resolve, reject) => {
        if (args.abortSignal.aborted) reject(args.abortSignal.reason);
        else args.abortSignal.addEventListener('abort', () => reject(args.abortSignal.reason), { once: true });
      });
      return { status: options.statuses?.[statusIndex++] || 'COMPLETED' };
    },
    async result(model, args) {
      calls.push(['result', model, args]);
      if (options.resultError) throw options.resultError;
      if (model === 'fal-ai/nano-banana-2/edit') return options.badResult ? { data: {} } : { data: { images: [{ url: options.distinctImages ? `https://fal.media/${args.requestId}.png` : IMAGE_URL }] } };
      return options.badResult ? { data: {} } : { data: { video: { url: VIDEO_URL } } };
    }
  } };
  const app = express();
  const DB = quickAdsDb([{ id: 'business-1', role: options.role || 'company', status: options.accountStatus || 'active',
    quickAdCredits: options.credits === undefined ? 100 : options.credits, quickAdFreePreviewUsed: !options.freePreview }]);
  app.locals.db = DB;
  app.use(express.json());
  app.use('/api/quick-ads', createQuickAdsRouter({
    cloudinaryClient,
    logger: { error: (...args) => logs.push(args) },
    getFalClient: async () => { calls.push(['sdk']); if (options.sdkError) throw options.sdkError; return fal; },
    protectVideo: async (client, url, generation) => {
      if (options.mediaError) throw options.mediaError;
      return { publicId: generation.id, outputUrl: VIDEO_URL, previewUrl: 'https://private.example/watermarked.mp4' };
    },
    pollIntervalMs: 1,
    generationTimeoutMs: options.timeout || 3000
  }));
  app.get('/existing', (req, res) => res.json({ unchanged: true }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const token = jwt.sign({ id: 'business-1' }, process.env.JWT_SECRET);
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    calls, logs, base, DB,
    async send(body = form(), authorization = `Bearer ${token}`, key) {
      const response = await fetch(base + '/api/quick-ads/generate', {
        method: 'POST', headers: { ...(authorization ? { Authorization: authorization } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body,
        signal: AbortSignal.timeout(15000)
      });
      return { status: response.status, body: await response.json() };
    }
  };
}

const firstLines = {
  food: 'Transform the supplied product photograph into a professional commercial advertising key visual.',
  reveal: 'Transform the supplied product photograph into a professional commercial advertising key visual.',
  studio: 'Transform the supplied product photograph into a professional commercial advertising key visual.',
  social: 'Transform the supplied product photograph into a professional commercial advertising key visual.'
};
const stylePhrases = {
  food: 'Create a premium food advertising scene around the original product.',
  reveal: 'Create a dramatic cinematic product advertising scene while preserving the exact uploaded product.',
  studio: 'Create a clean premium studio advertising photograph of the exact uploaded product.',
  social: 'Create an eye-catching modern social-media product advertising scene while preserving the exact uploaded product.'
};
for (const [style, firstLine] of Object.entries(firstLines)) {
  test(`${style}: uploads the buffer before generation and returns the documented response`, async t => {
    const f = await fixture(t, { statuses: ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'] });
    const result = await f.send(form({ style }));
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(result.body.imageUrl, IMAGE_URL);
    assert.equal(result.body.videoUrl, VIDEO_URL);
    assert.equal(result.body.requestId, 'test-request-123');
    assert.equal(result.body.quickAdCredits, 99);
    assert.equal(result.body.downloadable, true);
    assert.equal(result.body.creditUsed, true);
    assert.equal(f.calls.find(c => c[0] === 'upload')[1].folder, 'spreadfast/quick-ads');
    assert.equal(f.calls.find(c => c[0] === 'upload')[1].resource_type, 'image');
    assert.deepEqual(f.calls.find(c => c[0] === 'buffer')[1], png);
    const submitIndex = f.calls.findIndex(c => c[0] === 'submit');
    assert.ok(submitIndex > f.calls.findIndex(c => c[0] === 'buffer'));
    const [, commercialModel, commercialArgs] = f.calls[submitIndex];
    assert.equal(commercialModel, 'fal-ai/nano-banana-2/edit');
    assert.deepEqual(commercialArgs.input.image_urls, [IMAGE_URL]);
    assert.equal(commercialArgs.input.resolution, '1K');
    assert.equal(commercialArgs.input.limit_generations, true);
    assert.ok(commercialArgs.input.prompt.startsWith(firstLine));
    assert.ok(commercialArgs.input.prompt.includes(stylePhrases[style]));
    assert.ok(commercialArgs.input.prompt.includes('Do not generate duplicate products.'));
    assert.ok(commercialArgs.input.prompt.length <= 2200);
    assert.ok(!/\s{2,}/.test(commercialArgs.input.prompt));
    const videoSubmit = f.calls.find(c => c[0] === 'submit' && c[1] === MODEL);
    assert.ok(videoSubmit);
    assert.equal(videoSubmit[2].input.image_url, IMAGE_URL);
    assert.equal(videoSubmit[2].input.duration, '5');
    assert.equal(Object.hasOwn(videoSubmit[2].input, 'generate_audio'), false);
    assert.ok(videoSubmit[2].input.prompt.startsWith('A polished 5-second commercial product video using the supplied advertising image as the visual source.'));
    assert.ok(videoSubmit[2].input.prompt.includes('Preserve the exact product shape, proportions, colors, packaging, logo, branding, and label throughout the entire shot.'));
    assert.equal(f.calls.filter(c => c[0] === 'status').length, 4);
    assert.equal(f.calls.filter(c => c[0] === 'submit').length, 2);
    assert.ok(f.calls.filter(c => ['submit', 'status', 'result'].includes(c[0])).every(c => c[1] === MODEL || c[1] === 'fal-ai/nano-banana-2/edit'));
    assert.equal(f.logs.length, 0);
    assert.ok(!JSON.stringify(result.body).includes(TEST_KEY));
    assert.deepEqual(await (await fetch(f.base + '/existing', { signal: AbortSignal.timeout(15000) })).json(), { unchanged: true });
  });
}

test('authentication and current business role are required before any upload', async t => {
  const f = await fixture(t);
  assert.equal((await f.send(form(), null)).status, 401);
  assert.equal((await f.send(form(), 'Bearer invalid')).status, 401);
  assert.equal(f.calls.length, 0);
  const promoter = await fixture(t, { role: 'admin' });
  assert.equal((await promoter.send()).status, 403);
  assert.equal(promoter.calls.length, 0);
  const suspended = await fixture(t, { accountStatus: 'suspended' });
  assert.equal((await suspended.send()).status, 403);
  assert.equal(suspended.calls.length, 0);
});

test('missing, empty, unsupported, disguised, multiple, and incorrectly named files are rejected', async t => {
  const f = await fixture(t);
  for (const input of [
    { bytes: null }, { bytes: Buffer.alloc(0) }, { type: 'application/pdf' },
    { bytes: Buffer.from('not a PNG') }, { extra: true }, { field: 'photo' }
  ]) {
    const result = await f.send(form(input));
    assert.equal(result.status, 400, JSON.stringify(input));
    assert.equal(result.body.success, false);
  }
  assert.equal(f.calls.length, 0);
});

test('missing and unknown styles, including inherited property names, cannot select prompts', async t => {
  const f = await fixture(t);
  for (const style of [null, '', 'attention', 'FOOD', 'constructor', '__proto__']) {
    assert.equal((await f.send(form({ style }))).status, 400);
  }
  assert.equal(f.calls.length, 0);
});

test('the memory upload limit rejects more than 8 MB and accepts exactly 8 MB', async t => {
  const f = await fixture(t);
  const tooLarge = Buffer.alloc(8 * 1024 * 1024 + 1);
  png.copy(tooLarge);
  assert.equal((await f.send(form({ bytes: tooLarge }))).status, 413);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.send(form({ bytes: tooLarge.subarray(0, -1) }))).status, 200);
});

test('JPEG and WEBP signatures are accepted', async t => {
  const f = await fixture(t);
  assert.equal((await f.send(form({ type: 'image/jpeg', bytes: Buffer.from([255, 216, 255, 224, 0, 0]) }))).status, 200);
  assert.equal((await f.send(form({ type: 'image/webp', bytes: Buffer.from('RIFF0000WEBPdata') }))).status, 200);
});

test('missing server configuration fails before uploading or contacting fal', async t => {
  const f = await fixture(t, { noCloudinary: true });
  assert.equal((await f.send()).status, 503);
  assert.equal(f.calls.length, 0);
  const configured = await fixture(t);
  const key = process.env.FAL_KEY;
  try {
    delete process.env.FAL_KEY;
    assert.equal((await configured.send()).status, 503);
    assert.equal(configured.calls.length, 0);
  } finally { process.env.FAL_KEY = key; }
});

test('SDK, Cloudinary, and fal failures return safe JSON without leaking provider errors', async t => {
  const secretError = new Error('Authorization: Key ' + TEST_KEY);
  for (const [options, status] of [
    [{ sdkError: secretError }, 503], [{ uploadError: secretError }, 502],
    [{ submitError: secretError }, 502], [{ statuses: ['FAILED'] }, 502], [{ badResult: true }, 502]
  ]) {
    const f = await fixture(t, options);
    const result = await f.send();
    assert.equal(result.status, status);
    assert.equal(result.body.success, false);
    assert.ok(!JSON.stringify(result.body).includes(TEST_KEY));
    assert.equal(f.logs.length, 1);
    assert.ok(!JSON.stringify(f.logs).includes(TEST_KEY));
    if (options.uploadError || options.sdkError) assert.ok(!f.calls.some(c => c[0] === 'submit'));
  }
});

test('fal validation errors return a useful safe client response', async t => {
  const error = Object.assign(new Error('String should have at most 2500 characters'), {
    status: 422,
    body: { detail: 'provider validation details' }
  });
  const f = await fixture(t, { submitError: error });
  const result = await f.send();
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, {
    success: false,
    code: 'IMAGE_PROVIDER_VALIDATION_ERROR',
    message: 'The commercial image generation request contained invalid parameters.'
  });
  assert.ok(!JSON.stringify(result.body).includes('provider validation details'));
});

test('fashion studio accepts front and back images and preserves the dual-photo flow', async t => {
  const f = await fixture(t, { distinctImages: true, credits: 1 });
  const front = new Blob([png], { type: 'image/png' });
  const back = new Blob([png], { type: 'image/png' });
  const body = new FormData();
  body.append('style', 'fashion_studio');
  body.append('frontImage', front, 'front.png');
  body.append('backImage', back, 'back.png');

  const result = await f.send(body);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.style, 'fashion_studio');
  assert.equal(f.calls.filter(c => c[0] === 'upload').length, 2);
  const imageSubmits = f.calls.filter(c => c[0] === 'submit' && c[1] === 'fal-ai/nano-banana-2/edit');
  assert.equal(imageSubmits.length, 2);
  assert.deepEqual(imageSubmits[0][2].input.image_urls.length, 2);
  const videoSubmit = f.calls.find(c => c[0] === 'submit' && c[1] === MODEL);
  assert.ok(videoSubmit);
  const saved = await f.DB.QuickAdGeneration.findOne({ id: result.body.generationId });
  assert.equal(saved.sourceImageUrl, 'https://media.example/source-1.png');
  assert.equal(saved.sourceBackImageUrl, 'https://media.example/source-2.png');
  assert.equal(saved.fashionImages.front.requestId, 'request-1');
  assert.equal(saved.fashionImages.back.requestId, 'request-2');
  assert.notEqual(saved.fashionImages.front.publicId, saved.fashionImages.back.publicId);
  assert.equal(videoSubmit[2].input.image_url, saved.fashionImages.front.url);
  assert.equal(videoSubmit[2].input.tail_image_url, saved.fashionImages.back.url);
  assert.match(videoSubmit[2].input.prompt, /180-degree rotation from front to back/);
  assert.equal(result.body.imageUrl, saved.fashionImages.front.url);
  assert.equal(result.body.quickAdCredits, 0);
  assert.equal(f.calls.filter(c => c[0] === 'submit').length, 3);
  assert.equal((await f.DB.User.findOne({ id: 'business-1' })).quickAdTotalCreditsUsed, 1);
});

test('generation timeout aborts polling and retains request ID without submitting twice', async t => {
  const f = await fixture(t, { hangStatus: true, timeout: 50 });
  const result = await f.send();
  assert.equal(result.status, 504);
  assert.equal(result.body.requestId, 'test-request-123');
  assert.ok(result.body.message.includes('do not automatically submit again'));
  assert.equal(f.calls.filter(c => c[0] === 'submit').length, 1);
  assert.ok(f.calls.find(c => c[0] === 'status')[2].abortSignal.aborted);
  assert.equal(f.logs[0][1].category, 'TIMEOUT');
  assert.equal(f.logs[0][1].stage, 'creating_scene');
});

test('fashion validates both photos before provider calls or credit reservation', async t => {
  const f = await fixture(t, { credits: 1 });
  for (const fields of [['image'], ['frontImage'], ['backImage'], ['frontImage', 'image']]) {
    const body = new FormData(); body.append('style', 'fashion_studio');
    for (const field of fields) body.append(field, new Blob([png], { type: 'image/png' }), `${field}.png`);
    assert.equal((await f.send(body)).status, 400);
  }
  assert.equal(f.calls.length, 0);
  assert.equal((await f.DB.User.findOne({ id: 'business-1' })).quickAdCredits, 1);
});

test('fashion publishes the front scene during back generation and preserves credits if the back fails', async t => {
  let release, started;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { started = resolve; });
  const f = await fixture(t, { distinctImages: true, credits: 1, beforeStatus: async (model, args) => {
    if (args.requestId === 'request-2') { started(); await gate; throw new Error('back image failed'); }
  } });
  t.after(() => release());
  const body = new FormData(); body.append('style', 'fashion_studio');
  for (const field of ['frontImage', 'backImage']) body.append(field, new Blob([png], { type: 'image/png' }), `${field}.png`);
  const pending = f.send(body, undefined, 'fashion-progress');
  await entered;
  const headers = { Authorization: `Bearer ${jwt.sign({ id: 'business-1' }, process.env.JWT_SECRET)}` };
  const progress = await (await fetch(f.base + '/api/quick-ads/requests/fashion-progress', { headers })).json();
  assert.equal(progress.status, 'pending');
  assert.equal(progress.stage, 'creating_scene');
  assert.match(progress.imageUrl, /-front\.png$/);
  assert.equal(progress.videoUrl, undefined);
  assert.equal(progress.sourceImageUrl, undefined);
  release();
  assert.equal((await pending).status, 502);
  const user = await f.DB.User.findOne({ id: 'business-1' });
  assert.equal(user.quickAdCredits, 1);
  assert.equal(user.quickAdGenerationLock, null);
  assert.ok(!f.calls.some(c => c[0] === 'submit' && c[1] === MODEL));
});

test('logs safe HTTP diagnostics for failures at each provider stage', async t => {
  for (const [option, status, category] of [
    ['submitError', 401, 'UPSTREAM_AUTHORIZATION_FAILED'],
    ['statusError', 429, 'UPSTREAM_RATE_LIMITED'],
    ['resultError', 422, 'UPSTREAM_INPUT_REJECTED'],
    ['resultError', 503, 'UPSTREAM_FAILURE']
  ]) {
    const error = Object.assign(new Error(TEST_KEY), {
      status, code: TEST_KEY, body: { detail: TEST_KEY },
      response: { headers: { Authorization: TEST_KEY } }
    });
    const f = await fixture(t, { [option]: error });
    const result = await f.send();
    assert.equal(result.status, status === 422 ? 400 : 502);
    if (status === 422) {
      assert.equal(result.body.code, 'IMAGE_PROVIDER_VALIDATION_ERROR');
      assert.equal(result.body.message, 'The commercial image generation request contained invalid parameters.');
    }
    assert.deepEqual(f.logs, [['[Quick Ads] Request failed', {
      stage: 'creating_scene', provider: 'fal_image', style: 'food', model: 'fal-ai/nano-banana-2/edit',
      category, upstreamStatus: status, ...(error.code === TEST_KEY ? {} : { errorCode: error.code }),
      errorMessage: '[REDACTED]'
    }]]);
    assert.ok(!JSON.stringify({ result, logs: f.logs }).includes(TEST_KEY));
    assert.equal(f.calls.filter(c => c[0] === 'submit').length, 1);
  }
});

test('missing provider request ID fails safely before polling', async t => {
  const f = await fixture(t, { badSubmission: true });
  assert.equal((await f.send()).status, 502);
  assert.equal(f.logs[0][1].category, 'MISSING_REQUEST_ID');
  assert.ok(!f.calls.some(c => c[0] === 'status'));
});

test('a stalled upload times out without starting generation', async t => {
  const f = await fixture(t, { hangUpload: true, timeout: 50 });
  assert.equal((await f.send()).status, 504);
  assert.ok(!f.calls.some(c => c[0] === 'submit'));
});

test('no-credit accounts get the exact 403 before fal or Cloudinary is contacted', async t => {
  const f = await fixture(t, { credits: 0 });
  assert.deepEqual(await f.send(), { status: 403, body: { success: false, code: 'NO_QUICK_AD_CREDITS', message: 'You need Quick Ads credits to generate another ad.' } });
  assert.equal(f.calls.length, 0);
});

test('free preview exposes no provider/original URL and cannot be generated twice', async t => {
  const f = await fixture(t, { credits: 0, freePreview: true });
  const result = await f.send();
  assert.equal(result.status, 200);
  assert.equal(result.body.freePreview, true);
  assert.equal(result.body.downloadable, false);
  assert.equal(result.body.creditUsed, false);
  assert.equal(result.body.quickAdCredits, 0);
  assert.ok(result.body.previewPath.startsWith('/api/quick-ads/generations/'));
  assert.ok(!JSON.stringify(result.body).includes(VIDEO_URL));
  assert.equal(result.body.videoUrl, undefined);
  assert.equal((await f.send()).status, 403);
});

test('failed media preparation or generation does not spend credits or preview eligibility', async t => {
  for (const freePreview of [true, false]) {
    const f = await fixture(t, { freePreview, credits: 1, mediaError: new Error('transformation failed') });
    assert.equal((await f.send()).status, 502);
    const user = await f.DB.User.findOne({ id: 'business-1' });
    assert.equal(user.quickAdCredits, 1);
    assert.equal(user.quickAdFreePreviewUsed, !freePreview);
    assert.equal(user.quickAdGenerationLock, null);
  }
});

test('logo-render failure preserves credits and the same logo can succeed on a fresh retry', async t => {
  const f = await fixture(t, { credits: 1, failBrandingOnce: true });
  const makeLogoForm = () => {
    const body = form();
    body.append('brandingMode', 'logo');
    body.append('brandingLogo', new Blob([png], { type: 'image/png' }), 'logo.png');
    return body;
  };
  const failed = await f.send(makeLogoForm(), undefined, 'logo-render-retry-1');
  assert.equal(failed.status, 502);
  let account = await f.DB.User.findOne({ id: 'business-1' });
  assert.equal(account.quickAdCredits, 1);
  assert.equal(account.quickAdTotalCreditsUsed || 0, 0);
  assert.equal(account.quickAdGenerationLock, null);

  const retried = await f.send(makeLogoForm(), undefined, 'logo-render-retry-2');
  assert.equal(retried.status, 200);
  assert.equal(retried.body.branding.mode, 'logo');
  assert.equal(retried.body.creditUsed, true);
  account = await f.DB.User.findOne({ id: 'business-1' });
  assert.equal(account.quickAdCredits, 0);
  assert.equal(account.quickAdTotalCreditsUsed, 1);
  assert.equal(f.calls.filter(c => c[0] === 'branding').length, 2);
  assert.equal(f.logs[0][1].stage, 'branding_render');
  assert.equal(f.logs[0][1].provider, 'cloudinary');
  assert.equal(f.logs[0][1].model, 'cloudinary');
  assert.equal(f.logs[0][1].errorMessage, 'temporary logo render failure');
});

test('retrying a completed request with the same key never resubmits or deducts twice', async t => {
  const f = await fixture(t, { credits: 1 });
  const first = await f.send(form(), undefined, 'same-request-123');
  const second = await f.send(form(), undefined, 'same-request-123');
  assert.equal(first.status, 200); assert.equal(second.status, 200);
  assert.equal(first.body.generationId, second.body.generationId);
  assert.equal(second.body.quickAdCredits, 0);
  assert.equal(f.calls.filter(c => c[0] === 'submit').length, 2);
});

test('promoters use the same free, paid, no-credit, retry and failed-generation flow', async t => {
  const free = await fixture(t, { role: 'promoter', credits: 0, freePreview: true });
  const preview = await free.send();
  assert.equal(preview.status, 200); assert.equal(preview.body.downloadable, false);
  assert.equal(preview.body.videoUrl, undefined); assert.ok(preview.body.previewPath);
  assert.equal((await free.send()).body.code, 'NO_QUICK_AD_CREDITS');
  const paid = await fixture(t, { role: 'promoter', credits: 1 });
  const first = await paid.send(form(), undefined, 'promoter-request-123');
  assert.equal(first.status, 200); assert.equal(first.body.quickAdCredits, 0);
  assert.equal(first.body.downloadable, true);
  assert.equal((await paid.send(form(), undefined, 'promoter-request-123')).body.generationId, first.body.generationId);
  assert.equal(paid.calls.filter(c => c[0] === 'submit').length, 2);
  for (const failure of [{ submitError: new Error('failed') }, { hangStatus: true, timeout: 50 }]) {
    const failed = await fixture(t, { role: 'promoter', credits: 1, ...failure });
    assert.ok((await failed.send()).status >= 500);
    const account = await failed.DB.User.findOne({ id: 'business-1' });
    assert.equal(account.quickAdCredits, 1); assert.equal(account.quickAdGenerationLock, null);
  }
});

test('disconnecting after upload keeps the job running and recoverable without a second charge', async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = await fixture(t, { role: 'promoter', credits: 1, beforeStatus: () => gate });
  const controller = new AbortController();
  const headers = { Authorization: `Bearer ${jwt.sign({ id: 'business-1' }, process.env.JWT_SECRET)}`, 'Idempotency-Key': 'disconnect-key' };
  const pending = fetch(f.base + '/api/quick-ads/generate', {
    method: 'POST', body: form(), signal: controller.signal, headers
  }).catch(error => error);
  t.after(() => { controller.abort(); release(); });
  const deadline = Date.now() + 2000;
  while (!f.calls.some(call => call[0] === 'status') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(f.calls.some(call => call[0] === 'status'));
  controller.abort(); await pending;
  const processing = await (await fetch(f.base + '/api/quick-ads/requests/disconnect-key', { headers })).json();
  assert.equal(processing.status, 'pending');
  assert.equal(processing.quickAdCredits, 1);
  release();
  let recovered;
  do {
    await new Promise(resolve => setTimeout(resolve, 10));
    recovered = await (await fetch(f.base + '/api/quick-ads/requests/disconnect-key', { headers })).json();
  } while (recovered.status === 'pending' && Date.now() < deadline);
  assert.equal(recovered.status, 'completed');
  assert.equal(recovered.quickAdCredits, 0);
  assert.equal(recovered.videoUrl, VIDEO_URL);
  const retry = await f.send(form(), undefined, 'disconnect-key');
  assert.equal(retry.body.generationId, recovered.generationId);
  assert.equal(f.calls.filter(c => c[0] === 'submit').length, 2);
  assert.equal((await f.DB.User.findOne({ id: 'business-1' })).quickAdTotalCreditsUsed, 1);
});

test('business name is composited after fashion generation and never sent to the AI', async t => {
  const f = await fixture(t);
  const body = form({ style: 'fashion_studio', field: 'frontImage' });
  body.append('backImage', new Blob([png], { type: 'image/png' }), 'back.png');
  body.append('brandingMode', 'name'); body.append('businessName', 'Arewa Tailors');
  const result = await f.send(body);
  assert.equal(result.status, 200);
  assert.equal(result.body.branding.name, 'Arewa Tailors');
  assert.match(result.body.videoUrl, /branded/);
  const aiCalls = f.calls.filter(c => c[0] === 'submit');
  assert.equal(aiCalls.length, 3);
  assert.ok(!JSON.stringify(aiCalls).includes('Arewa Tailors'));
  assert.equal(f.calls.filter(c => c[0] === 'branding').length, 1);
});

test('logo upload stays separate from AI product inputs and a retry does not re-render', async t => {
  const f = await fixture(t);
  const body = form(); body.append('brandingMode', 'logo');
  body.append('brandingLogo', new Blob([png], { type: 'image/png' }), 'logo.png');
  const result = await f.send(body, undefined, 'branded-request-123');
  assert.equal(result.status, 200); assert.equal(result.body.branding.mode, 'logo');
  assert.match(result.body.branding.logoUrl, /image\/authenticated/);
  assert.equal(f.calls.filter(c => c[0] === 'submit').length, 2);
  const uploads = f.calls.filter(c => c[0] === 'upload');
  assert.equal(uploads.length, 2); assert.equal(uploads[0][1].type, 'authenticated');
  assert.ok(!JSON.stringify(f.calls.filter(c => c[0] === 'submit')).includes('/logos/'));
  assert.equal((await f.send(body, undefined, 'branded-request-123')).status, 200);
  assert.equal(f.calls.filter(c => c[0] === 'branding').length, 1);
});
