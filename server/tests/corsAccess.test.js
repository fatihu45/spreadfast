const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { once } = require('node:events');
const { allowedOrigins, createCorsAccess } = require('../middleware/corsAccess');
const preview = 'https://spreadfast-preview.example.test';

test('existing clients remain allowed and configured origins are normalized', () => {
  const origins = allowedOrigins({ CLIENT_URL: 'https://custom.example.test/', CLIENT_ORIGINS: ` ${preview}/,https://other.example.test, ` });
  for (const origin of ['http://localhost:3000', 'http://localhost:5173', 'https://tryspreadfast.com', 'https://www.tryspreadfast.com', 'https://custom.example.test', preview, 'https://other.example.test']) assert.ok(origins.has(origin));
});
test('misconfigured origins fail without exposing their contents', () => {
  for (const value of ['*', 'https://*.vercel.app', 'https://user:secret@example.test', 'https://example.test/login', 'https://example.test?token=secret', 'https://example.test#section', 'file:///tmp']) {
    assert.throws(() => allowedOrigins({ CLIENT_ORIGINS: value }), { message: 'CLIENT_URL and CLIENT_ORIGINS must contain exact HTTP or HTTPS origins.' });
  }
});
test('preview preflight permits auth and idempotency; unlisted origins cannot reach routes', async t => {
  const app = express(); let hits = 0;
  app.use(createCorsAccess({ CLIENT_ORIGINS: preview }));
  app.post('/api/studios/jobs', (req, res) => { hits++; res.json({ success: true }); });
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/studios/jobs`;
  const response = await fetch(url, { method: 'OPTIONS', headers: { Origin: preview, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Authorization,Content-Type,Idempotency-Key' } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), preview);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  assert.match(response.headers.get('access-control-allow-headers'), /Idempotency-Key/);
  for (const origin of ['https://attacker.vercel.app', preview + '.evil.test', 'null']) {
    const denied = await fetch(url, { method: 'POST', headers: { Origin: origin } });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
    assert.equal((await denied.json()).code, 'CORS_ORIGIN_DENIED');
  }
  assert.equal(hits, 0);
  assert.equal((await fetch(url, { method: 'POST' })).status, 200);
  assert.equal(hits, 1);
});
