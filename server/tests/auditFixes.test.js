const test = require('node:test');
const assert = require('node:assert/strict');
const { campaignView } = require('../services/campaignView');
const { safeError } = require('../services/safeError');
const campaign = { id: 'c', companyId: 'owner', title: 'Campaign', paystackReference: 'private',
  subscribedPromoters: [{ promoterId: 'one', promoterName: 'First' }, { promoterId: 'two', promoterName: 'Second' }],
  brandAssets: [{ fileUrl: 'private-asset' }], submissions: ['private-proof'], futurePrivateField: 'private' };
test('public campaign view excludes internal data, including future fields', () => {
  const view = campaignView(campaign);
  assert.equal(view.title, 'Campaign'); assert.equal(view.subscribedCount, 2);
  assert.deepEqual(view.subscribedPromoters, []);
  for (const field of ['paystackReference','brandAssets','submissions','futurePrivateField']) assert.equal(view[field], undefined);
});
test('creator receives only their membership while owner retains management fields', () => {
  const view = campaignView(campaign, { id: 'one' });
  assert.deepEqual(view.subscribedPromoters, [campaign.subscribedPromoters[0]]);
  assert.equal(view.subscribedCount, 2); assert.equal(view.paystackReference, undefined);
  assert.deepEqual(view.brandAssets, campaign.brandAssets);
  assert.deepEqual(campaignView(campaign, {id: 'owner'}), campaign);
});
test('error logs never include request credentials or response payloads', () => {
  const value = safeError({ code: 'ERR_BAD_RESPONSE', message: 'secret', config: { headers: { Authorization: 'secret' } }, response: {status: 502, data: 'secret'} });
  assert.deepEqual(value, {code:'ERR_BAD_RESPONSE',status:502});
  assert.equal(JSON.stringify(value).includes('secret'), false);
});

test('campaign read routes apply privacy filtering and no email-test route is registered', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  assert.equal(source.includes("app.get('/api/test-email'"), false);
  for (const route of ['/api/campaigns', '/api/campaigns/company/:companyId', '/api/campaigns/:campaignId']) {
    let handler;
    const auth = () => {};
    const start = source.indexOf("app.get('" + route + "'");
    const end = source.indexOf('\n});', start) + 4;
    vm.runInNewContext(source.slice(start, end), {
      app: {get(path, middleware, callback) { assert.equal(middleware, auth); handler = callback; }},
      optionalAuthentication: auth, campaignView, safeError, console,
      DB: {Campaign: {find: async () => [campaign], findOne: async () => campaign}}
    });
    let result;
    await handler({params:{companyId:'owner', campaignId:'c'}}, {json(body){result = body;}});
    const view = result.campaign || result.campaigns[0];
    assert.equal(view.paystackReference, undefined);
    assert.deepEqual(view.subscribedPromoters, []);
  }
});
