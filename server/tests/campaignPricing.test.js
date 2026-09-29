const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const pricing = require('../services/campaignPricing');
const quickAdPayments = require('../services/quickAdPayments');
const { reviewSubmission } = require('../services/reviewSubmission');
const {requestWithdrawal, reviewWithdrawal} = require('../services/wallet');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
// Run the real route and JSON adapter code with in-memory storage. Never start the
// server, load .env, connect to MongoDB, contact Paystack, or write application data.
function fixture() {
  const files = {'users.json': [{id: 'company', email: 'company@example.test'}, {id:'creator', walletBalance: 1200}],
    'campaigns.json': [], 'transactions.json': [], 'submissions.json': []};
  let nextId = 0;
  const context = { ...pricing, reviewSubmission, requestWithdrawal, reviewWithdrawal,
    passwordChanged: require('../services/emailNotifications').passwordChanged,
    QUICK_AD_PAYMENT_PURPOSE: quickAdPayments.PURPOSE, assertCampaignPayment: quickAdPayments.assertCampaignPayment,
    console: {log(){},warn(){},error(){}},
    Date, Buffer, process: {env: {}}, uuidv4: () => 'id-' + (++nextId),
    readJSON: name => structuredClone(files[name] || []), writeJSON: (name, data) => {files[name] = structuredClone(data);},
    isMongoConnected: () => false, authenticateToken(){},
    sendCampaignConfirmationEmail: async () => {}, sendNewCampaignAlertToPromoters: async () => {},
    ActivityLog: {create: async () => {}}, paystackConfig: {secretKey: 'test-only', publicKey:'test-public'},
    express: {raw: () => (req,res,next) => next()}, crypto: require('node:crypto'),
    axios: {post: async (url, body) => {context.initialized = body; return {data:{status:true, data:{reference:'ref', authorization_url:'https://example.test/pay'}}};},
      get: async () => ({data: {status:true, data: context.charge}})}
  };
  context.verifyQuickAdPayment = (db, reference, userId, config) => quickAdPayments.verifyQuickAdPayment(db, reference, userId, config, context.axios);
  vm.createContext(context);
  const localStart = source.indexOf('const localDB =');
  const localEnd = source.indexOf('// ==================== DB PROXY');
  vm.runInContext(source.slice(localStart, localEnd) + '\nthis.DB = localDB;', context);
  const persistStart = source.indexOf('async function persistPaidCampaign');
  vm.runInContext(source.slice(persistStart, source.indexOf('// ==================== MONGODB CONNECTION', persistStart)), context);
  const routes = {};
  context.app = Object.fromEntries(['post','get','patch','delete'].map(method => [method, (route, ...handlers) => {routes[method + ' ' + route] = handlers.at(-1);} ]));
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
    const req = {body, params, user: {id: userId, email:'admin@example.test', role: files['users.json'].find(u => u.id === userId)?.role || (userId === 'company' ? 'company' : 'promoter')}, headers: {}};
    if (route.endsWith('/webhook')) {
      req.rawBody = Buffer.from(JSON.stringify(body));
      req.headers['x-paystack-signature'] = context.crypto.createHmac('sha512', 'test-only').update(req.rawBody).digest('hex');
    }
    await routes[key](req,res);
    return result;
  }
  // Simulate transactional commit/rollback without connecting to application databases.
  files['email_notifications.json'] = [];
  context.DB.EmailNotification = {
    findOne: async query => structuredClone(files['email_notifications.json'].find(row => row.id === query.id) || null),
    create: async doc => { files['email_notifications.json'].push(structuredClone(doc)); return doc; }
  };
  let queue = Promise.resolve();
  context.DB.withTransaction = work => {
    const result = queue.then(async () => {
      const before = structuredClone(files);
      try { return await work(context.DB); }
      catch (error) { for (const key of Object.keys(files)) delete files[key]; Object.assign(files, before); throw error; }
    });
    queue = result.catch(() => {});
    return result;
  };
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
  f.files['users.json'].push({id:'other', role:'company'});
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
    if(name==='../services/wallet') return {reviewWithdrawal};
    if(name==='../services/quickAdAnalytics') return require('../services/quickAdAnalytics');
    throw Error('Unexpected dependency '+name);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../routes/admin.js'),'utf8'),context);
  const result={}; const res={status(code){result.status=code;return this;},json(body){result.body=body;}};
  await routes['get /all-stats']({app:{locals:{db:f.context.DB}}},res); assert.equal(result.body.stats.totalCampaignFees,5000);
  await routes['patch /submissions/:submissionId']({app:{locals:{db:f.context.DB}},params:{submissionId:'s1'},body:{status:'approved',approvalAmount:20000}},res); assert.equal(result.status,400);
  await routes['patch /submissions/:submissionId']({app:{locals:{db:f.context.DB}},params:{submissionId:'s1'},body:{status:'approved',approvalAmount:15000}},res);
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

test('concurrent withdrawals cannot reserve more than the wallet balance', async () => {
  const f=fixture();Object.assign(f.files['users.json'][1], {walletBalance:15000,bankDetails:{bankName:'Test',accountNumber:'1234567890'}});
  const results=await Promise.all(['/api/wallet/withdraw','/api/withdrawals'].map(route=>f.call('post',route,{amount:10000},'creator')));
  assert.equal(results.filter(r=>r.body.success).length,1);
  assert.equal(f.files['users.json'][1].walletBalance,5000);
  assert.equal(f.files['withdrawals.json'].reduce((n,w)=>n+w.amount,0),10000);
});
test('withdrawal persistence failure rolls back its balance debit',async()=>{
  const f=fixture();Object.assign(f.files['users.json'][1],{walletBalance:15000,bankDetails:{bankCode:'001',accountNumber:'1234567890'}});
  f.context.DB.Withdrawal.create=async()=>{throw Error('Write failed');};
  assert.equal((await f.call('post','/api/wallet/withdraw',{amount:1000},'creator')).status,500);
  assert.equal(f.files['users.json'][1].walletBalance,15000);
});
test('repeated rejection refunds once, terminal withdrawals cannot reopen',async()=>{
  const f=fixture();f.files['withdrawals.json']=[{id:'w',promoterId:'creator',amount:1000,status:'pending'}];
  await Promise.all([reviewWithdrawal(f.context.DB,'w','rejected'),reviewWithdrawal(f.context.DB,'w','rejected')]);
  assert.equal(f.files['users.json'][1].walletBalance,2200);
  for(const status of ['pending','completed']) await assert.rejects(reviewWithdrawal(f.context.DB,'w',status), /cannot be reopened/);
});
test('failed refund state write rolls back credit and can be retried once',async()=>{
  const f=fixture();f.files['withdrawals.json']=[{id:'w',userId:'creator',amount:1000,status:'pending'}];
  const update=f.context.DB.Withdrawal.updateOne;f.context.DB.Withdrawal.updateOne=async()=>{throw Error('Write failed');};
  await assert.rejects(reviewWithdrawal(f.context.DB,'w','rejected'),/Write failed/);
  assert.equal(f.files['users.json'][1].walletBalance,1200);
  f.context.DB.Withdrawal.updateOne=update;await reviewWithdrawal(f.context.DB,'w','rejected');
  assert.equal(f.files['users.json'][1].walletBalance,2200);
});
test('withdrawal endpoints enforce numeric minimum and share pending history',async()=>{
  const f=fixture();Object.assign(f.files['users.json'][1],{walletBalance:15000,bankDetails:{bankName:'Test',accountNumber:'1234567890'}});
  for(const amount of [1,999,NaN,Infinity,'1000',1000.1]) assert.equal((await f.call('post','/api/wallet/withdraw',{amount},'creator')).status,400);
  f.files['withdrawals.json']=[{id:'legacy',promoterId:'creator',amount:1000,status:'pending'},{id:'other',userId:'other',amount:9000,status:'pending'}];
  assert.equal((await f.call('get','/api/wallet/withdrawals/pending',{},'creator')).body.pendingAmount,1000);
});
test('legacy approval retries after a write failure do not credit twice or reprice',async()=>{
  const f=reviewFixture();delete f.files['campaigns.json'][0].pricing;
  const update=f.context.DB.Submission.updateOne;f.context.DB.Submission.updateOne=async()=>{throw Error('Write failed');};
  await assert.rejects(reviewSubmission(f.context.DB,'s1','approved',7250.5),/Write failed/);
  f.context.DB.Submission.updateOne=update;
  await Promise.all([reviewSubmission(f.context.DB,'s1','approved',5000),reviewSubmission(f.context.DB,'s1','approved',5000)]);
  assert.equal(f.files['users.json'][1].walletBalance,8450.5);
  assert.equal(f.files['submissions.json'][0].approvalAmount,7250.5);
});
test('assets cannot be downloaded or deleted through another campaign',async()=>{
  const f=fixture();f.files['campaigns.json']=[{id:'own',companyId:'company'}];
  f.files['campaign_assets.json']=[{_id:'victim',campaign_id:'other',is_active:true}];
  let called=false;f.context.cloudinary={url:()=>{called=true;},uploader:{destroy:async()=>{called=true;}}};
  for(const [method,route] of [['get','/api/campaigns/:campaignId/assets/:assetId/download'],['delete','/api/campaigns/:campaignId/assets/:assetId']]) {
    assert.equal((await f.call(method,route,{},'company',{campaignId:'own',assetId:'victim'})).status,404);
  }
  assert.equal(called,false);assert.equal(f.files['campaign_assets.json'][0].is_active,true);
});
test('only the campaign owner or admin can retrieve campaign submissions',async()=>{
  const f=fixture();f.files['campaigns.json']=[{id:'c',companyId:'company'}];f.files['submissions.json']=[{id:'s',campaignId:'c'}];
  assert.equal((await f.call('get','/api/campaigns/:campaignId/submissions',{},'creator',{campaignId:'c'})).status,403);
  assert.equal((await f.call('get','/api/campaigns/:campaignId/submissions',{},'company',{campaignId:'c'})).body.submissions.length,1);
});
test('webhook persistence failures request retry instead of acknowledging success',async()=>{
  const f=fixture();funded(f);const create=f.context.DB.Campaign.create;
  f.context.DB.Campaign.create=async()=>{throw Error('Database unavailable');};
  assert.equal((await f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge})).status,503);
  assert.equal(f.files['campaigns.json'].length,0);
  f.context.DB.Campaign.create=create;
  assert.equal((await f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge})).status,200);
  assert.equal(f.files['campaigns.json'].length,1);
});
test('registration saves social profiles, rejects privileged roles and reserved admin email',async()=>{
  const f=fixture();f.context.bcrypt={hash:async()=> 'test-hash'};f.context.jwt={sign:()=> 'test-token'};f.context.sendWelcomeEmail=async()=>{};
  const body={name:'Test',email:'new@example.test',password:'test-password',role:'promoter',socialMedia:{tiktok:'@creator'},
    quickAdCredits: 999, quickAdsGenerated: 999, quickAdFreePreviewUsed: true, quickAdTotalCreditsPurchased: 999, quickAdTotalCreditsUsed: 999};
  assert.equal((await f.call('post','/api/auth/register',{...body,role:'admin'})).status,400);
  f.context.process.env.ADMIN_EMAIL='admin@example.test';
  assert.equal((await f.call('post','/api/auth/register',{...body,email:'ADMIN@example.test'})).status,400);
  assert.equal((await f.call('post','/api/auth/register',body)).body.success,true);
  assert.equal(f.files['users.json'].at(-1).socialMedia.tiktok,'@creator');
  for (const field of ['quickAdCredits', 'quickAdsGenerated', 'quickAdTotalCreditsPurchased', 'quickAdTotalCreditsUsed']) assert.equal(f.files['users.json'].at(-1)[field], 0);
  assert.equal(f.files['users.json'].at(-1).quickAdFreePreviewUsed, false);
});
test('banned accounts cannot log in and creator accounts cannot purchase campaigns',async()=>{
  const f=fixture();f.files['users.json'][1].status='banned';f.files['users.json'][1].email='creator@example.test';
  f.context.bcrypt={compare:async()=>true};f.context.jwt={sign:()=> 'test-token'};
  assert.equal((await f.call('post','/api/auth/login',{email:'creator@example.test',password:'test'})).status,403);
  assert.equal((await f.call('post','/api/payments/initiate',{amount:20000},'creator')).status,403);
  assert.equal((await f.call('post','/api/campaigns/:campaignId/subscribe',{},'company',{campaignId:'c'})).status,403);
});
test('production database proxy never falls back to JSON when disconnected',()=>{
  const start=source.indexOf('const DB = new Proxy'); const end=source.indexOf('app.locals.db = DB;',start);
  const context={process:{env:{NODE_ENV:'production'}},isMongoConnected:()=>false};
  vm.runInNewContext(source.slice(start,end)+'\nthis.database=DB;',context);
  assert.throws(()=>context.database.User,/Database temporarily unavailable/);
});
test('corrupt JSON is rejected rather than silently treated as empty data',()=>{
  const start=source.indexOf('const readJSON =');const end=source.indexOf('const writeJSON =',start);
  const context={path:{join:(a,b)=>b},DATA_DIR:'test',fs:{existsSync:()=>true,readFileSync:()=>'{broken'}};
  vm.runInNewContext(source.slice(start,end)+'\nthis.read=readJSON;',context);
  assert.throws(()=>context.read('submissions.json'),/Local data is invalid/);
});

test('legacy paid webhook retries recover the same campaign without changing its terms',async()=>{
 const f=fixture();funded(f);delete f.files['transactions.json'][0].pricing;
 const update=f.context.DB.PaystackTransaction.updateOne;f.context.DB.PaystackTransaction.updateOne=async()=>{throw Error('Write failed');};
 assert.equal((await f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge})).status,503);
 const id=f.files['campaigns.json'][0].id;
 f.context.DB.PaystackTransaction.updateOne=update;
 assert.equal((await f.call('post','/api/payments/webhook',{event:'charge.success',data:f.context.charge})).status,200);
 assert.equal(f.files['campaigns.json'].length,1);assert.equal(f.files['transactions.json'][0].campaignId,id);
 assert.equal(f.files['campaigns.json'][0].pricing,undefined);
});

test('password reset increments the session version without changing wallet balances',async()=>{
 const f=fixture();const user=f.files['users.json'][1];user.tokenVersion=2;user.resetPasswordTokenHash=f.context.crypto.createHash('sha256').update('reset-test').digest('hex');user.resetPasswordExpires=new Date(Date.now()+60000).toISOString();
 f.context.bcrypt={hash:async()=> 'replacement-test-hash'};
 assert.equal((await f.call('post','/api/auth/reset-password',{token:'reset-test',newPassword:'replacement-password'})).body.success,true);
 assert.equal(f.files['users.json'][1].tokenVersion,3);assert.equal(f.files['users.json'][1].walletBalance,1200);
});

test('recovery reuses a historical campaign ID and its saved presentation and terms',async()=>{
 const f=fixture();funded(f);delete f.files['transactions.json'][0].pricing;
 f.files['campaigns.json']=[{id:'historical-id',companyId:'company',title:'Historical campaign',budget:'20000',paystackReference:'ref'}];
 const response=await f.call('post','/api/campaigns',{title:'Do not overwrite',budget:20000,reference:'ref'});
 assert.equal(response.body.success,true);assert.equal(response.body.campaign.id,'historical-id');assert.equal(response.body.campaign.title,'Historical campaign');assert.equal(f.files['campaigns.json'].length,1);
});

test('Quick Ads purchase references cannot be routed into campaign creation or generic settlement', async () => {
 const f=fixture();funded(f);f.files['transactions.json'][0].purpose='quick_ad_credits';
 assert.equal((await f.call('post','/api/campaigns',{title:'Wrong purchase',budget:20000,reference:'ref'})).status,400);
 assert.equal((await f.call('post','/api/payments/verify',{reference:'ref'})).status,400);
 assert.equal((await f.call('get','/api/payments/campaign-status/:reference',{},'company',{reference:'ref'})).body.success,false);
 assert.equal(f.files['campaigns.json'].length,0);
 assert.equal(f.files['transactions.json'][0].status,'pending');
});
