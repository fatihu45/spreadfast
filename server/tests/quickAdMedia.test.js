const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const jwt = require('jsonwebtoken');
const express = require('express');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const { createQuickAdMediaRouter } = require('../routes/quickAdMedia');
const { publicGeneration, storeVideo, streamVideo } = require('../services/quickAdMedia');
const prior = process.env.JWT_SECRET;
test.before(() => { process.env.JWT_SECRET = 'test-only-media-secret'; });
test.after(() => { if (prior === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = prior; });

async function fixture(t, role = 'company') {
  const user = { id: 'owner', role, status: 'active', quickAdCredits: 3 };
  const DB = quickAdsDb([user, { id: 'other', role: 'company', status: 'active' }]);
  for (const freePreview of [true, false]) await DB.QuickAdGeneration.create({
    id: freePreview ? 'free' : 'paid', userId: 'owner', freePreview, status: 'completed',
    downloadable: !freePreview, creditUsed: !freePreview,
    media: { outputUrl: 'https://private.example/original.mp4', previewUrl: 'https://private.example/watermarked.mp4' }
  });
  const streamed = [];
  const app = express(); app.locals.db = DB;
  app.use('/api/quick-ads', createQuickAdMediaRouter({ stream: async (req, res, url, download) => {
    streamed.push({ url, download }); res.type('video/mp4').send('test video');
  } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (path, id = 'owner') => fetch(base + path, { headers: id ? { Authorization: `Bearer ${jwt.sign({ id }, process.env.JWT_SECRET)}` } : {} });
  return { DB, user, get, base, streamed };
}
test('free originals and export stay locked after purchasing credits; other owners cannot access records', async t => {
  const f = await fixture(t);
  for (const action of ['download', 'export']) {
    assert.equal((await f.get(`/api/quick-ads/generations/free/${action}`)).status, 403);
    assert.equal((await f.get(`/api/quick-ads/generations/paid/${action}`, 'other')).status, 404);
    assert.equal((await f.get(`/api/quick-ads/generations/paid/${action}`, null)).status, 401);
  }
  assert.equal((await f.get('/api/quick-ads/generations/paid/download')).status, 200);
  assert.equal(f.streamed[0].download, true);
});
test('preview tokens authorize only the watermarked derivative, expire, and cannot act as login tokens', async t => {
  const f = await fixture(t);
  const response = await (await f.get('/api/quick-ads/generations/free')).json();
  assert.equal(response.videoUrl, undefined);
  assert.ok(!JSON.stringify(response).includes('private.example'));
  const token = new URL(response.previewPath, f.base).searchParams.get('token');
  assert.throws(() => jwt.verify(token, process.env.JWT_SECRET));
  assert.equal((await f.get(response.previewPath, null)).status, 200);
  assert.equal(f.streamed[0].url, 'https://private.example/watermarked.mp4');
  assert.equal((await f.get(response.previewPath.replace('/free/', '/paid/'), null)).status, 401);
  const decoded = jwt.decode(token);
  assert.equal(decoded.exp - decoded.iat, 300);
  await f.DB.User.updateOne({ id: 'owner' }, { $set: { tokenVersion: 1 } });
  assert.equal((await f.get(response.previewPath, null)).status, 401);
});
test('protected uploads eagerly watermark previews and never return an original as the preview', async () => {
  let settings;
  const client = { uploader: { upload: async (url, options) => {
    settings = options; return { public_id: 'ad', version: 1, eager: [{ secure_url: 'https://res.cloudinary.com/test/video/authenticated/s--signed--/preview.mp4' }] };
  } }, url: () => 'https://res.cloudinary.com/test/video/authenticated/s--original--/ad.mp4' };
  const media = await storeVideo(client, 'https://fal.example/result.mp4', { id: 'ad', freePreview: true }, new AbortController().signal);
  assert.equal(settings.type, 'authenticated');
  assert.equal(settings.eager_async, false);
  assert.ok(JSON.stringify(settings.eager).includes('SpreadFast - Free Preview'));
  assert.notEqual(media.previewUrl, media.outputUrl);
  const view = publicGeneration({ id: 'ad', status: 'completed', freePreview: true, media }, { id: 'owner' });
  assert.ok(!JSON.stringify(view).includes('cloudinary.com'));
});
test('media proxy preserves Safari byte ranges without redirecting to or exposing the source URL', async t => {
  const app = express();
  app.get('/preview', (req, res) => streamVideo(req, res, 'https://private.example/video', false, { get: async (url, options) => {
    assert.deepEqual(options.headers, { Range: 'bytes=0-1' });
    assert.equal(options.maxRedirects, 0);
    return { status: 206, headers: { 'content-length': '2', 'content-range': 'bytes 0-1/100', 'accept-ranges': 'bytes' }, data: Readable.from([Buffer.from([0, 1])]) };
  } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const result = await fetch(`http://127.0.0.1:${server.address().port}/preview`, { headers: { Range: 'bytes=0-1' } });
  assert.equal(result.status, 206); assert.equal(result.headers.get('content-range'), 'bytes 0-1/100');
  assert.equal(result.headers.get('location'), null); assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.equal((await result.arrayBuffer()).byteLength, 2);
});

test('a stalled protected upload aborts promptly instead of keeping generation pending', async () => {
  const controller = new AbortController();
  const client = { uploader: { upload: () => new Promise(() => {}) } };
  const pending = storeVideo(client, 'https://fal.example/video', { id: 'ad', freePreview: true }, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('missing protected derivative fails closed instead of displaying the original', async () => {
  const client = { uploader: { upload: async () => ({ public_id: 'ad', version: 1 }) }, url: () => 'https://private.example/original.mp4' };
  await assert.rejects(storeVideo(client, 'https://fal.example/video', { id: 'ad', freePreview: true }, new AbortController().signal), /preview was not prepared/);
});

test('interrupted generation recovery is owner-scoped and reports expired reservations safely', async t => {
  const f = await fixture(t);
  await f.DB.QuickAdGeneration.updateOne({ id: 'free' }, { $set: { idempotencyKey: 'request-free' } });
  const response = await (await f.get('/api/quick-ads/requests/request-free')).json();
  assert.equal(response.status, 'completed');
  assert.equal(response.videoUrl, undefined);
  assert.ok(response.previewPath);
  assert.equal((await f.get('/api/quick-ads/requests/request-free', 'other')).status, 404);
  await f.DB.QuickAdGeneration.create({ id: 'expired', userId: 'owner', idempotencyKey: 'expired-key', status: 'pending', expiresAt: new Date(0) });
  assert.equal((await f.get('/api/quick-ads/requests/expired-key')).status, 410);
});

test('promoters see their balance and preview, download paid media, and cannot access another owner', async t => {
  const f = await fixture(t, 'promoter');
  assert.equal((await (await f.get('/api/quick-ads/credits')).json()).quickAdCredits, 3);
  const preview = await (await f.get('/api/quick-ads/generations/free')).json();
  assert.equal(preview.videoUrl, undefined);
  assert.equal((await f.get(preview.previewPath, null)).status, 200);
  for (const action of ['download', 'export']) {
    assert.equal((await f.get('/api/quick-ads/generations/free/' + action)).status, 403);
    assert.equal((await f.get('/api/quick-ads/generations/paid/' + action)).status, 200);
    assert.equal((await f.get('/api/quick-ads/generations/paid/' + action, 'other')).status, 404);
  }
  await f.DB.QuickAdGeneration.create({ id: 'company-ad', userId: 'other', status: 'completed' });
  assert.equal((await f.get('/api/quick-ads/generations/company-ad')).status, 404);
});
