const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const pricing = require('../services/campaignPricing');
const { reviewSubmission } = require('../services/reviewSubmission');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
// Run the real route and JSON adapter code with in-memory storage. Never start the
// server, load .env, connect to MongoDB, contact Paystack, or write application data.
function fixture() {
  const files = {'users.json': [{id: 'company', email: 'company@example.test'}, {id:'creator', walletBalance: 1200}],
    'campaigns.json': [], 'transactions.json': [], 'submissions.json': []};
  let nextId = 0;
  const context = { ...pricing, reviewSubmission, console: {log(){},warn(){},error(){}},
    Date, Buffer, process: {env: {}}, uuidv4: () => 'id-' + (++nextId),
    readJSON: name => structuredClone(files[name] || []), writeJSON: (name, data) => {files[name] = structuredClone(data);},
    isMongoConnected: () => false, authenticateToken(){},
    sendCampaignConfirmationEmail: async () => {}, sendNewCampaignAlertToPromoters: async () => {},
    ActivityLog: {create: async () => {}}, paystackConfig: {secretKey: 'test-only', publicKey:'test-public'},
    express: {raw: () => (req,res,next) => next()}, crypto: require('node:crypto'),
    axios: {post: async (url, body) => {context.initialized = body; return {data:{status:true, data:{reference:'ref', authorization_url:'https://example.test/pay'}}};},
      get: async () => ({data: {status:true, data: context.charge}})}
  };
  vm.createContext(context);
  const localStart = source.indexOf('const localDB =');
  const localEnd = source.indexOf('// ==================== DB PROXY');
  vm.runInContext(source.slice(localStart, localEnd) + '\nthis.DB = localDB;', context);
  const persistStart = source.indexOf('async function persistPaidCampaign');
  vm.runInContext(source.slice(persistStart, source.indexOf('// ==================== MONGODB CONNECTION', persistStart)), context);
  const routes = {};
  context.app = Object.fromEntries(['post','get','patch'].map(method => [method, (route, ...handlers) => {routes[method + ' ' + route] = handlers.at(-1);} ]));
  async function call(method, route, body = {}, userId = 'company', params = {}) {
    const key = method + ' ' + route;
    if (!routes[key]) {
      const start = source.indexOf("app." + method + "('" + route + "'");
      assert.notEqual(start, -1, 'route exists');
      const end = source.indexOf('\n});', start) + 4;
      vm.runInContext(source.slice(start, end), context);
    }
    const result = {status: 200};
    const res = {status(code){result.status=code; return this;}, json(body){result.body=body;return this;}, send(body){result.body=body;return this;}, sendStatus(code){result.status=code;return this;}};
    const req = {body, params, user: {id: userId, email:'admin@example.test'}, headers: {}};
    if (route.endsWith('/webhook')) {
      req.rawBody = Buffer.from(JSON.stringify(body));
      req.headers['x-paystack-signature'] = context.crypto.createHmac('sha512', 'test-only').update(req.rawBody).digest('hex');
    }
    await routes[key](req,res);
    return result;
  }
  return {context, files, call};
}
function funded(f) {
  const p = pricing.quoteCampaign(20000);
  f.files['transactions.json'].push({id:'payment-1',reference:'ref',userId:'company',amount:20000,campaignName:'Real campaign',pricing:p,status:'pending'});
  f.context.charge = {reference:'ref',status:'success',currency:'NGN',amount:2000000};
  return p;
}
for (const count of [1,2,3,5]) test('included 25% split for ' + count + ' creators', () => {
  const p = pricing.quoteCampaign(count * 20000);
  assert.equal(p.creatorCount, count); assert.equal(p.platformAmount, count * 5000);
  assert.equal(p.creatorPool, count * 15000); assert.equal(p.earningPerCreator, 15000);
  assert.equal(p.grossAmount, p.creatorPool + p.platformAmount);
});
test('rejects invalid pricing without initializing a payment', async () => {
  const f=fixture();
  for (const amount of [10000, 25000, 0, -20000, 20000.01, 'bad', Infinity, true, [], {}]) {
    const res=await f.call('post','/api/payments/initiate',{amount,campaignName:'Test'});
    assert.equal(res.status,400); assert.equal(f.context.initialized, undefined);
  }
});
test('initialization charges gross exactly, ignores client-supplied fees and saves terms', async () => {
  const f=fixture(); const res=await f.call('post','/api/payments/initiate',{amount:'40000',campaignName:'Real',pricing:{earningPerCreator:40000}});
  assert.equal(res.body.success,true); assert.equal(f.context.initialized.amount,4000000);
  assert.equal(f.files['transactions.json'][0].pricing.creatorPool,30000);
  assert.equal(f.files['transactions.json'][0].pricing.platformAmount,10000);
});
test('webhook, polling and callback produce one funded campaign with the same split', async () => {
  const f=fixture(); const p=funded(f);
  await Promise.all([
    f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge}),
    f.call('get','/api/payments/campaign-status/:reference',{},'company',{reference:'ref'}),
    f.call('post','/api/campaigns',{title:'Real',budget:20000,reference:'ref'})
  ]);
  assert.equal(f.files['campaigns.json'].length,1);
  const campaign=f.files['campaigns.json'][0]; assert.deepEqual(campaign.pricing,p);
  assert.equal(campaign.amountPaid,20000); assert.equal(pricing.creatorSlots(campaign),1);
  assert.equal(f.files['transactions.json'][0].campaignCreated,true);
});
test('unpaid, mismatched and foreign payments cannot create campaigns', async () => {
  const f=fixture();funded(f);
  assert.equal((await f.call('post','/api/campaigns',{title:'Unpaid',budget:20000})).status,400);
  assert.equal((await f.call('post','/api/campaigns',{title:'Tampered',budget:40000,reference:'ref'})).status,400);
  assert.equal((await f.call('post','/api/campaigns',{title:'Foreign',budget:20000,reference:'ref'},'other')).status,404);
  for (const charge of [{amount:1000000},{currency:'USD'},{status:'failed'}]) {
    f.context.charge={reference:'ref',status:'success',currency:'NGN',amount:2000000,...charge};
    await f.call('post','/api/campaigns',{title:'Mismatch',budget:20000,reference:'ref'});
    await f.call('get','/api/payments/campaign-status/:reference',{},'company',{reference:'ref'});
    await f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge});
    assert.equal(f.files['campaigns.json'].length,0);
  }
});
test('legacy paid campaigns retain their existing terms', async () => {
  const f=fixture();funded(f); delete f.files['transactions.json'][0].pricing;
  await f.call('post','/api/campaigns',{title:'Legacy',budget:20000,reference:'ref'});
  const campaign=f.files['campaigns.json'][0]; assert.equal(campaign.pricing,undefined); assert.equal(pricing.creatorSlots(campaign),4);
});
test('new campaigns cannot assign more creators than purchased, including concurrent joins', async () => {
  const f=fixture();const p=funded(f);
  f.files['campaigns.json']=[{id:'campaign',status:'active',budget:20000,pricing:p,subscribedPromoters:[]}];
  const results=await Promise.all(['creator','other'].map(id => f.call('post','/api/campaigns/:campaignId/subscribe',{},id,{campaignId:'campaign'})));
  assert.equal(results.filter(r=>r.status===200).length,1);
  assert.equal(f.files['campaigns.json'][0].subscribedPromoters.length,1);
});
function reviewFixture() {
  const f=fixture();
  f.files['campaigns.json']=[{id:'campaign',pricing:pricing.quoteCampaign(20000),subscribedPromoters:[{promoterId:'creator'}]}];
  f.files['submissions.json']=[{id:'s1',campaignId:'campaign',userId:'creator',status:'pending'}, {id:'s2',campaignId:'campaign',userId:'creator',status:'pending'}];
  return f;
}
test('approval credits 15,000 once, including concurrent retries and multiple posts', async () => {
  const f=reviewFixture();
  await Promise.all([reviewSubmission(f.context.DB,'s1','approved',15000),reviewSubmission(f.context.DB,'s1','approved',15000)]);
  assert.equal(f.files['users.json'][1].walletBalance,16200);
  assert.equal(f.files['submissions.json'][0].approvalAmount,15000);
  await assert.rejects(reviewSubmission(f.context.DB,'s2','approved',15000), /already been paid/);
  await assert.rejects(reviewSubmission(f.context.DB,'s1','rejected'), /cannot be reopened/);
  assert.equal(f.files['users.json'][1].walletBalance,16200);
});
test('approval rejects gross payouts and unassigned creators', async () => {
  const f=reviewFixture();
  for (const amount of [20000,5000,0,-1,'bad']) await assert.rejects(reviewSubmission(f.context.DB,'s1','approved',amount), /pays NGN 15000/);
  f.files['campaigns.json'][0].subscribedPromoters=[];
  await assert.rejects(reviewSubmission(f.context.DB,'s1','approved',15000), /has not joined/);
  assert.equal(f.files['users.json'][1].walletBalance,1200);
});
test('retry repairs a failed submission write without a second wallet credit', async () => {
  const f=reviewFixture(); const update=f.context.DB.Submission.updateOne;
  f.context.DB.Submission.updateOne=async()=>{throw Error('Temporary write failure');};
  await assert.rejects(reviewSubmission(f.context.DB,'s1','approved',15000), /Temporary/);
  f.context.DB.Submission.updateOne=update;
  await reviewSubmission(f.context.DB,'s1','approved',15000);
  assert.equal(f.files['users.json'][1].walletBalance,16200);
  assert.equal(f.files['submissions.json'][0].status,'approved');
});
test('legacy approval amounts and existing balances are not repriced', async () => {
  const f=reviewFixture();delete f.files['campaigns.json'][0].pricing;
  await reviewSubmission(f.context.DB,'s1','approved',7250.5);
  assert.equal(f.files['users.json'][1].walletBalance,8450.5);
  assert.equal(f.files['submissions.json'][0].approvalAmount,7250.5);
});
test('admin reports actual paid platform share, keeps legacy estimates separate and adds no withdrawal fee', () => {
  const p=pricing.quoteCampaign(40000);
  const stats=pricing.feeStats([{budget:10000}], [{pricing:p,status:'completed'}, {pricing:p,status:'pending'}]);
  assert.equal(stats.totalCampaignFees,10000); assert.equal(stats.totalCreatorAllocation,30000);
  assert.equal(stats.totalWithdrawalFees,0); assert.equal(stats.legacyCampaignFeeEstimate,500);
});

test('submissions retain their pricing and require a purchased creator slot', async () => {
  const f=reviewFixture();
  assert.equal((await f.call('post','/api/campaigns/:campaignId/submit',{proofUrl:'https://example.test/post'},'other',{campaignId:'campaign'})).status,400);
  const response=await f.call('post','/api/campaigns/:campaignId/submit',{proofUrl:'https://example.test/post'},'creator',{campaignId:'campaign'});
  assert.equal(response.body.submission.pricing.earningPerCreator,15000);
  const submission=response.body.submission;
  f.files['campaigns.json']=[];
  await assert.rejects(reviewSubmission(f.context.DB,submission.id,'approved',5000), /Campaign not found/);
});
test('mounted admin routes use recorded revenue and enforce net approval', async () => {
  const f=reviewFixture();
  f.files['transactions.json']=[{pricing:pricing.quoteCampaign(20000),status:'completed'}];
  const routes={};
  const router=Object.fromEntries(['get','patch','delete'].map(method=>[method,(route,...handlers)=>{routes[method+' '+route]=handlers.at(-1);} ]));
  const context={console:{error(){}},process:{env:{}},module:{exports:{}},require:name=>{
    if(name==='express') return {Router:()=>router};
    if(name==='mongoose') return {model:name=>f.context.DB[name]};
    if(name==='../middleware/auth') return {authenticateToken(){}};
    if(name==='../services/campaignPricing') return pricing;
    if(name==='../services/reviewSubmission') return {reviewSubmission};
    throw Error('Unexpected dependency '+name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../routes/admin.js'),'utf8'),context);
  const result={}; const res={status(code){result.status=code;return this;},json(body){result.body=body;}};
  await routes['get /all-stats']({},res); assert.equal(result.body.stats.totalCampaignFees,5000);
  await routes['patch /submissions/:submissionId']({params:{submissionId:'s1'},body:{status:'approved',approvalAmount:20000}},res); assert.equal(result.status,400);
  await routes['patch /submissions/:submissionId']({params:{submissionId:'s1'},body:{status:'approved',approvalAmount:15000}},res);
  assert.equal(result.body.success,true); assert.equal(f.files['users.json'][1].walletBalance,16200);
});

test('withdrawal uses the credited balance without another platform deduction', async () => {
  const f=reviewFixture();f.files['users.json'][1].bankDetails={bankName:'Test',accountNumber:'1234567890'};
  await reviewSubmission(f.context.DB,'s1','approved',15000);
  const result=await f.call('post','/api/wallet/withdraw',{amount:3000},'creator');
  assert.equal(result.body.success,true);assert.equal(result.body.newBalance,13200);
  assert.equal(f.files['withdrawals.json'][0].amount,3000);
});

test('a payment for a deleted campaign cannot fund another set of creator slots', async () => {
  const f=fixture();funded(f);
  f.files['transactions.json'][0].campaignCreated=true;
  const result=await f.call('post','/api/campaigns',{title:'Reuse',budget:20000,reference:'ref'});
  assert.equal(result.status,410);assert.equal(f.files['campaigns.json'].length,0);
});
