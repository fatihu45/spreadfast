const test = require('node:test');
const assert = require('node:assert/strict');
const { requestCreativeCompletion, DEFAULT_MODEL } = require('../services/openRouterPlanner');
const { createCreativePlan } = require('../services/aiCommercialProviders');
function env(t, model) {
  const old = { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL };
  process.env.OPENROUTER_API_KEY = 'mock-only-key';
  if (model) process.env.OPENROUTER_MODEL = model; else delete process.env.OPENROUTER_MODEL;
  t.after(() => {
    for (const [name, value] of [['OPENROUTER_API_KEY', old.key], ['OPENROUTER_MODEL', old.model]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
}
const reply = (status, payload, retry) => ({ ok: status === 200, status, headers: { get: () => retry }, json: async () => payload });
const validPlan = () => ({ title: 'Product Commercial', voiceover: '', endCard: '', accuracyRules: ['Faithful'], scenes: [6, 8, 8].map(durationSeconds => ({ purpose: 'Shot', durationSeconds, imagePrompt: 'Faithful product', motionPrompt: 'Slow push', narration: '' })) });
const completion = plan => ({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(plan) } }] });

test('server sends Bearer authentication, default/configured model and strict schema', async t => {
  env(t);
  for (const model of [DEFAULT_MODEL, 'anthropic/test-model']) {
    process.env.OPENROUTER_MODEL = model;
    await requestCreativeCompletion({ messages: [] }, { fetchImpl: async (url, options) => {
      assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer mock-only-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, model);
      assert.equal(body.response_format.json_schema.strict, true);
      assert.equal(body.provider.require_parameters, true);
      assert.equal(body.stream, false);
      assert.ok(options.signal);
      return reply(200, completion(validPlan()));
    } });
  }
});
test('missing configuration fails without any request', async t => {
  env(t); delete process.env.OPENROUTER_API_KEY;
  await assert.rejects(requestCreativeCompletion({}, { fetchImpl: () => assert.fail('must not fetch') }), { code: 'AI_PROVIDER_NOT_CONFIGURED' });
});
for (const [status, code] of [[400, 'OPENROUTER_REQUEST_INVALID'], [401, 'OPENROUTER_AUTH_FAILED'], [402, 'OPENROUTER_INSUFFICIENT_CREDITS'], [403, 'OPENROUTER_FORBIDDEN'], [404, 'OPENROUTER_MODEL_UNAVAILABLE']]) {
  test(`HTTP ${status} is sanitized and not retried`, async t => {
    env(t); let calls = 0;
    await assert.rejects(requestCreativeCompletion({}, { fetchImpl: async () => { calls++; return reply(status, { error: { message: 'private customer data' } }); } }), error => {
      assert.equal(error.code, code); assert.doesNotMatch(JSON.stringify(error), /private customer data|mock-only-key/); return true;
    });
    assert.equal(calls, 1);
  });
}
test('temporary errors retry within the same call and honor Retry-After', async t => {
  env(t); let calls = 0; const waits = [];
  const result = await requestCreativeCompletion({}, { fetchImpl: async () => ++calls < 3 ? reply(429, {}, '1') : reply(200, completion(validPlan())), sleep: async ms => waits.push(ms) });
  assert.equal(calls, 3); assert.deepEqual(waits, [1000, 1000]); assert.ok(result.choices);
});
test('outages and HTTP 200 error envelopes stop after three attempts', async t => {
  env(t);
  for (const status of [500, 502, 503, 504, 200]) {
    let calls = 0;
    await assert.rejects(requestCreativeCompletion({}, { fetchImpl: async () => { calls++; return reply(status, { error: { code: 503, message: 'private' } }); }, sleep: async () => {} }));
    assert.equal(calls, 3);
  }
});
test('long rate-limit delay stops without retrying early', async t => {
  env(t);
  await assert.rejects(requestCreativeCompletion({}, { fetchImpl: async () => reply(429, {}, '60'), sleep: () => assert.fail('no retry') }), { code: 'OPENROUTER_RATE_LIMITED' });
});
test('request timeout is bounded and abort signal reaches fetch', async t => {
  env(t); let calls = 0;
  const keepAlive = setInterval(() => {}, 1000); t.after(() => clearInterval(keepAlive));
  await assert.rejects(requestCreativeCompletion({}, { timeoutMs: 5, fetchImpl: async (url, { signal }) => {
    calls++; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
  }, sleep: async () => {} }), { code: 'OPENROUTER_TIMEOUT' });
  assert.equal(calls, 3);
});
test('cancellation stops in-flight planning and prevents retries', async t => {
  env(t); const controller = new AbortController(); let calls = 0;
  await assert.rejects(requestCreativeCompletion({}, { signal: controller.signal, fetchImpl: async () => { calls++; controller.abort(); throw new Error('sensitive'); } }), { code: 'CREATIVE_PLAN_CANCELLED' });
  assert.equal(calls, 1);
});
test('invalid, incomplete, refused and truncated plans fail before media generation', async t => {
  env(t);
  const incomplete = validPlan(); delete incomplete.scenes[2].motionPrompt;
  for (const payload of [completion(incomplete), completion([]), completion({}), { choices: [{ finish_reason: 'length', message: { content: JSON.stringify(validPlan()) } }] }, { choices: [{ finish_reason: 'stop', message: { content: 'not JSON' } }] }, { choices: [] }]) {
    const mock = t.mock.method(global, 'fetch', async () => reply(200, payload));
    await assert.rejects(createCreativePlan({}), { code: 'CREATIVE_PLAN_INVALID' });
    assert.equal(mock.mock.callCount(), 2); mock.mock.restore();
  }
});

test('a malformed Claude plan is retried once before starting paid media work', async t => {
  env(t);
  let calls = 0;
  const incomplete = validPlan();
  delete incomplete.scenes[1].motionPrompt;
  t.mock.method(global, 'fetch', async () => reply(200, completion(++calls === 1 ? incomplete : validPlan())));
  const plan = await createCreativePlan({ imageUrl: 'https://media.example/tea.png' });
  assert.equal(calls, 2);
  assert.deepEqual(plan.scenes.map(scene => scene.durationSeconds), [6, 8, 8]);
});

test('plan retries stop immediately when cancelled after an invalid response', async t => {
  env(t);
  const controller = new AbortController();
  let calls = 0;
  t.mock.method(global, 'fetch', async () => {
    calls += 1;
    controller.abort();
    return reply(200, completion({}));
  });
  await assert.rejects(createCreativePlan({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
