const express = require('express');
const jwt = require('jsonwebtoken');
const { once } = require('node:events');
const { Writable } = require('node:stream');
const { quickAdsDb } = require('./server/tests/helpers/quickAdsDb');
const { createQuickAdsRouter } = require('./server/routes/quickAds');

process.env.FAL_KEY = 'test-only-provider-secret';
process.env.JWT_SECRET = 'quick-ads-test-only-jwt';
const IMAGE_URL = 'https://res.cloudinary.com/test/image/upload/meal.png';
const VIDEO_URL = 'https://fal.media/test-ad.mp4';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aTf8AAAAASUVORK5CYII=', 'base64');

(async () => {
  const calls = [];
  const logs = [];
  const cloudinaryClient = {
    config: () => ({ cloud_name: 'test', api_key: 'test', api_secret: 'test' }),
    uploader: {
      upload_stream(uploadOptions, callback) {
        calls.push(['upload', uploadOptions]);
        return new Writable({
          write(chunk, encoding, done) { calls.push(['buffer', Buffer.from(chunk)]); done(); },
          final(done) { callback(null, { secure_url: IMAGE_URL }); done(); }
        });
      }
    }
  };
  let statusIndex = 0;
  const fal = { queue: {
    async submit(model, args) {
      calls.push(['submit', model, args]);
      return { request_id: 'test-request-123' };
    },
    async status(model, args) {
      calls.push(['status', model, args]);
      return { status: ['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'][statusIndex++] || 'COMPLETED' };
    },
    async result(model, args) {
      calls.push(['result', model, args]);
      return model === 'fal-ai/nano-banana-2/edit' ? { data: { images: [{ url: IMAGE_URL }] } } : { data: { video: { url: VIDEO_URL } } };
    }
  } };
  const app = express();
  const DB = quickAdsDb([{ id: 'business-1', role: 'company', status: 'active', quickAdCredits: 100, quickAdFreePreviewUsed: false }]);
  app.locals.db = DB;
  app.use('/api/quick-ads', createQuickAdsRouter({
    cloudinaryClient,
    logger: { error: (...args) => logs.push(args) },
    getFalClient: async () => fal,
    protectVideo: async () => ({ publicId: 'x', outputUrl: VIDEO_URL, previewUrl: 'https://private.example/watermarked.mp4' }),
    pollIntervalMs: 1,
    generationTimeoutMs: 3000
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = jwt.sign({ id: 'business-1' }, process.env.JWT_SECRET);
  const body = new FormData();
  body.append('style', 'fashion_studio');
  body.append('frontImage', new Blob([png], { type: 'image/png' }), 'front.png');
  body.append('backImage', new Blob([png], { type: 'image/png' }), 'back.png');

  const response = await fetch(base + '/api/quick-ads/generate', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body,
    signal: AbortSignal.timeout(15000)
  });
  console.log('status', response.status);
  console.log('json', await response.json());
  console.log('logs', JSON.stringify(logs, null, 2));
  console.log('calls', JSON.stringify(calls, null, 2));
  server.close();
})();
