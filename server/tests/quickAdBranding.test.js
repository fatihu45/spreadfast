const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('express');
const cloudinary = require('cloudinary').v2;
const { readBranding, brandingTransformation, renderBranding } = require('../services/quickAdBranding');
const { PREVIEW_TRANSFORMATION } = require('../services/quickAdMedia');
const { createQuickAdMediaRouter } = require('../routes/quickAdMedia');
const { quickAdsDb } = require('./helpers/quickAdsDb');
const original = 'https://res.cloudinary.com/test/video/authenticated/original.mp4';
const form = (mode, name) => { const f = new FormData(); f.append('brandingMode', mode); if (name !== undefined) f.append('businessName', name); return f; };

async function fixture(t, options = {}) {
  process.env.JWT_SECRET = 'branding-test-only-secret';
  const db = quickAdsDb([{ id: 'owner', role: 'company', quickAdCredits: 3, quickAdTotalCreditsPurchased: 0 }]);
  await db.QuickAdGeneration.create({ id: 'ad', userId: 'owner', status: 'completed', freePreview: !!options.free,
    creditUsed: !options.free, downloadable: !options.free, media: { publicId: 'ad', outputUrl: original, previewUrl: original.replace('original','preview') } });
  const calls = [];
  const app = express(); app.locals.db = db;
  app.use(createQuickAdMediaRouter({ authenticate: (req, res, next) => { req.user = { id: req.headers['x-owner'] || 'owner', role: 'company' }; next(); },
    cloudinaryClient: { uploader: { explicit: async (id, args) => {
      calls.push({ id, args });
      if (options.fail) throw new Error('provider credentials must not leak');
      return { eager: args.eager.map((item, index) => ({ secure_url: original.replace('original', `brand-${calls.length}-${index}`) })) };
    } } }
  }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return { db, calls, edit: (body, owner = 'owner') => fetch(`http://127.0.0.1:${server.address().port}/generations/ad/branding`, { method: 'PATCH', body, headers: { 'x-owner': owner } }) };
}

test('validates optional names, file signatures, mode and size before provider work', () => {
  assert.deepEqual(readBranding({}), { mode: 'none' });
  assert.deepEqual(readBranding({ brandingMode: 'name', businessName: ' Arewa  Tailors ' }), { mode: 'name', name: 'Arewa Tailors' });
  for (const body of [{ brandingMode: 'other' }, { brandingMode: 'name', businessName: '' }, { brandingMode: 'name', businessName: 'a'.repeat(41) }]) assert.throws(() => readBranding(body), { statusCode: 400 });
  assert.throws(() => readBranding({ brandingMode: 'logo' }, { mimetype: 'image/png', buffer: Buffer.from('<svg/>') }), { code: 'INVALID_LOGO' });
  const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(10)]);
  assert.equal(readBranding({ brandingMode: 'logo' }, { mimetype: 'image/png', buffer: png }).mode, 'logo');
  assert.throws(() => readBranding({ brandingMode: 'logo' }, { mimetype: 'image/png', buffer: Buffer.concat([png, Buffer.alloc(2*1024*1024)]) }), { code: 'INVALID_LOGO' });
});

test('Cloudinary SDK encodes text and fits authenticated logos without distorting them', () => {
  const url = cloudinary.url('original', { cloud_name: 'test', resource_type: 'video', transformation: brandingTransformation({ mode: 'logo', publicId: 'private/logo' }) });
  assert.match(url, /l_authenticated:private:logo\/c_fit,fl_relative,h_0.1,w_0.18\/fl_layer_apply,g_north_west/);
  const nameUrl = cloudinary.url('original', { cloud_name: 'test', transformation: brandingTransformation({ mode: 'name', name: 'A/B, & Sons' }) });
  assert.ok(!nameUrl.includes('A/B,'));
});

test('editing and removing branding retains the original and never spends credits', async t => {
  const { db, edit, calls } = await fixture(t);
  const before = await db.User.findOne({ id: 'owner' });
  let response = await edit(form('name', 'Arewa Tailors')); assert.equal(response.status, 200);
  let result = await response.json(); assert.equal(result.branding.name, 'Arewa Tailors'); assert.notEqual(result.videoUrl, original);
  assert.ok(!JSON.stringify(result).includes('original.mp4'));
  response = await edit(form('name', 'New Name')); assert.equal(response.status, 200);
  response = await edit(form('none')); assert.equal(response.status, 200);
  result = await response.json(); assert.equal(result.videoUrl, original); assert.equal(result.branding.mode, 'none');
  assert.equal(calls.length, 2); assert.ok(calls.every(c => c.id === 'ad' && c.args.type === 'authenticated' && c.args.eager_async === false));
  assert.deepEqual(await db.User.findOne({ id: 'owner' }), before);
});

test('free-preview branding stays watermarked and never returns the downloadable original', async t => {
  const { edit, calls } = await fixture(t, { free: true });
  const response = await edit(form('name', 'Shop')); assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.downloadable, false); assert.ok(data.previewPath); assert.equal(data.videoUrl, undefined);
  assert.equal(calls[0].args.eager.length, 2);
  assert.match(JSON.stringify(calls[0].args.eager[1]), /SpreadFast - Free Preview/);
  assert.equal((await edit(form('none'))).status, 200);
  assert.match(JSON.stringify(calls[1].args.eager[0]), /SpreadFast - Free Preview/);
});

test('other owners, deleted ads and pending ads cannot create branding derivatives', async t => {
  const { edit, calls, db } = await fixture(t);
  assert.equal((await edit(form('name', 'Shop'), 'stranger')).status, 404);
  await db.QuickAdGeneration.updateOne({ id: 'ad' }, { $set: { status: 'pending' } });
  assert.equal((await edit(form('name', 'Shop'))).status, 409);
  await db.QuickAdGeneration.updateOne({ id: 'ad' }, { $set: { status: 'completed', deletedAt: new Date() } });
  assert.equal((await edit(form('name', 'Shop'))).status, 404);
  assert.equal(calls.length, 0);
});

test('failed rendering leaves the current playable video and credits unchanged', async t => {
  const { edit, db } = await fixture(t, { fail: true });
  const before = await db.QuickAdGeneration.findOne({ id: 'ad' });
  const response = await edit(form('name', 'Shop')); assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('credentials'));
  assert.deepEqual(await db.QuickAdGeneration.findOne({ id: 'ad' }), before);
});

test('missing authenticated derivatives fail closed', async () => {
  await assert.rejects(renderBranding({ uploader: { explicit: async () => ({ eager: [{ secure_url: 'https://example.com/public.mp4' }] }) } },
    { media: { publicId: 'ad', outputUrl: original } }, { mode: 'name', name: 'Shop' }, PREVIEW_TRANSFORMATION));
});
