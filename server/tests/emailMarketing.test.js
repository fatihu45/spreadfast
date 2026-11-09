const test = require('node:test');
const assert = require('node:assert/strict');
const { STARTER, validateCampaign, renderCampaign, slotFor, eligible, syncContact, runWeekly, runImmediate, queueTest } = require('../services/emailMarketing');
const good = { ...STARTER };
test('brand template escapes copy, retains logo, and distinguishes test from unsubscribe broadcast', () => {
  const mail = renderCampaign({ ...good, title:'Hello <script>', body:'<img src=x onerror=x>\n\nSecond paragraph' });
  assert.ok(mail.html.includes('#008050')); assert.ok(mail.html.includes('/spreadfast-logo.png'));
  assert.ok(mail.html.includes('&lt;script&gt;')); assert.ok(!mail.html.includes('<script>'));
  assert.ok(mail.html.includes('{{{RESEND_UNSUBSCRIBE_URL}}}')); assert.ok(mail.text.includes('Unsubscribe:'));
  assert.ok(!renderCampaign(good, true).html.includes('{{{')); assert.ok(renderCampaign(good, true).html.includes('No subscribers were emailed'));
});
test('campaign validation rejects injected subjects, merge tags and unsafe URLs', () => {
  assert.equal(validateCampaign(good).subject, good.subject);
  for (const patch of [{ subject:'x\nBcc: other' }, { body:'{{{contact.email}}}' }, { url:'javascript:alert(1)' }, { url:'https://evil.example' }, { imageUrl:'data:text/html,x' }, { audience:'admin' }, { title:'' }]) assert.throws(()=>validateCampaign({...good,...patch}));
});
test('schedule uses Lagos days and hour, supports 3 or 4 weekly slots and pause', () => {
  const settings={enabled:true, frequency:3, hour:8};
  assert.equal(slotFor('2026-11-04T07:00:00Z',settings),'2026-11-04');
  assert.equal(slotFor('2026-11-04T08:00:00Z',settings),null);
  assert.equal(slotFor('2026-11-08T07:00:00Z',settings),null);
  assert.equal(slotFor('2026-11-08T07:00:00Z',{...settings,frequency:4}),'2026-11-08');
  assert.equal(slotFor('2026-11-04T07:00:00Z',{...settings,enabled:false}),null);
  assert.equal(slotFor('2026-11-03T23:00:00Z',{...settings,hour:0}),'2026-11-04');
});
test('legacy, suspended and admin accounts are excluded from marketing', () => {
  const user={role:'company',marketingSubscribed:true}; assert.ok(eligible(user));
  for(const patch of [{marketingSubscribed:undefined},{marketingSubscribed:false},{status:'suspended'},{role:'admin'}]) assert.equal(eligible({...user,...patch}),false);
  assert.equal(eligible(user,'promoter'),false);
});
test('contact sync preserves provider unsubscribe and only creates missing contacts',async()=>{
  let added=0,created=0;
  const resend={contacts:{get:async()=>({data:{id:'c',unsubscribed:true}}), create:async()=>{created++;return{data:{id:'c'}};},segments:{add:async()=>{added++;return{data:{id:'c'}};}}}};
  const user={email:'USER@example.com',name:'User'};
  assert.equal(await syncContact(resend,user,'segment'),false); assert.equal(added,0); assert.equal(created,0);
  resend.contacts.get=async()=>({error:{statusCode:404}});
  assert.equal(await syncContact(resend,user,'segment'),true); assert.equal(added,1); assert.equal(created,1);
  resend.contacts.get=async()=>({error:{statusCode:429}});
  await assert.rejects(syncContact(resend,user,'segment')); assert.equal(created,1);
});
function fixture({ fail=false, empty=false }={}) {
  const slots=new Set(), row={...good,_id:'db',id:'db',status:'ready'}, user={id:'u',name:'User',email:'user@example.test',role:'company',marketingSubscribed:true};
  let sends=0;
  const models={EmailMarketingSettings:{findById:async()=>({enabled:true,frequency:3,hour:8})},EmailMarketingSlot:{create:async({_id})=>{if(slots.has(_id))throw Object.assign(new Error(),{code:11000});slots.add(_id);}},EmailCampaign:{findOneAndUpdate:async(query)=>{if(empty || row.status!==query.status)return null;row.status='sending';return row;}, updateOne:async(q,{$set})=>Object.assign(row,$set)}};
  const User={find:()=>({select:()=>({lean:async()=>[user,{...user}]})}),findOne:async()=>user};
  const resend={segments:{create:async()=>({data:{id:'seg'}})},contacts:{get:async()=>({data:{id:'contact'}}),segments:{add:async()=>({data:{id:'contact'}})}},broadcasts:{create:async()=>({data:{id:'broadcast'}}),send:async()=>{sends++;if(fail)throw new Error('Lost response');return{data:{id:'broadcast'}};}}};
  return { args:{models,User,resend,env:{NODE_ENV:'production'},now:new Date('2026-11-04T07:05:00Z'),pace:async()=>{}},row,sends:()=>sends };
}
test('concurrent workers and repeated ticks send one broadcast, deduplicate recipients',async()=>{
  const f=fixture();await Promise.all([runWeekly(f.args),runWeekly(f.args)]);await runWeekly(f.args);
  assert.equal(f.sends(),1);assert.equal(f.row.status,'sent');assert.equal(f.row.recipients,1);
});
test('ambiguous send is held for review and never automatically resent',async()=>{
  const f=fixture({fail:true});await runWeekly(f.args);await runWeekly(f.args);assert.equal(f.row.status,'needs_review');assert.equal(f.sends(),1);assert.equal(f.row.broadcastId,'broadcast');
});
test('empty queue and non-production never broadcast',async()=>{
  const f=fixture({empty:true});await runWeekly(f.args);assert.equal(f.sends(),0);
  const g=fixture();await runWeekly({...g.args,env:{NODE_ENV:'test'}});assert.equal(g.row.status,'ready');
});
test('test sends are fixed to owner address and deduplicated by nonce',async()=>{
  const rows=new Map();const Notification={create:async row=>{if(rows.has(row.id))throw Object.assign(new Error(),{code:11000});rows.set(row.id,row);},findOne:async({id})=>rows.get(id)};
  await Promise.all([queueTest(Notification,good,'test-nonce'),queueTest(Notification,good,'test-nonce')]);assert.equal(rows.size,1);
  const row=[...rows.values()][0];assert.equal(row.to,'tryspreadfast@gmail.com');assert.equal(row.status,'pending');assert.ok(!row.html.includes('{{{'));
});

test('registered audience includes legacy accounts but excludes recorded opt-outs and inactive users',()=>{
  const user={role:'company',marketingSubscribed:false};
  assert.equal(eligible(user,'registered'),true);
  assert.equal(eligible({...user,marketingConsentAt:new Date()},'registered'),false);
  assert.equal(eligible({...user,marketingConsentSource:'account-preferences-v1'},'registered'),false);
  assert.equal(eligible({...user,status:'banned'},'registered'),false);
  assert.equal(eligible({...user,role:'admin'},'registered'),false);
  assert.equal(eligible(user,'all'),false);
});
test('send now works while weekly schedule is paused and concurrent claims send only once',async()=>{
  const f=fixture(); f.row.status='queued';
  f.args.models.EmailMarketingSettings.findById=async()=>({enabled:false});
  await Promise.all([runImmediate(f.args),runImmediate(f.args)]); await runImmediate(f.args);
  assert.equal(f.sends(),1);assert.equal(f.row.status,'sent');assert.equal(f.row.recipients,1);
});
test('immediate sends retain production gates and ambiguous response protection',async()=>{
  const f=fixture();f.row.status='queued';
  await runImmediate({...f.args,env:{NODE_ENV:'test'}});assert.equal(f.sends(),0);
  await runImmediate({...f.args,env:{NODE_ENV:'production',EMAILS_ENABLED:'false'}});assert.equal(f.sends(),0);
  const g=fixture({fail:true});g.row.status='queued';await runImmediate(g.args);await runImmediate(g.args);
  assert.equal(g.row.status,'needs_review');assert.equal(g.sends(),1);
});
test('registered broadcast rechecks preference changes, deduplicates, and honors provider opt-out',async()=>{
  const f=fixture();f.row.status='queued';f.row.audience='registered';
  const users=[{id:'legacy',role:'company',email:'legacy@example.test'}, {id:'out',role:'company',email:'out@example.test',marketingConsentAt:new Date(),marketingSubscribed:false}, {id:'provider-out',role:'promoter',email:'provider@example.test'}];
  f.args.User.find=()=>({select:()=>({lean:async()=>[...users,users[0]]})});
  f.args.User.findOne=async({id})=>users.find(u=>u.id===id);
  f.args.resend.contacts.get=async({email})=>({data:{id:email,unsubscribed:email==='provider@example.test'}});
  await runImmediate(f.args);assert.equal(f.row.recipients,1);assert.equal(f.sends(),1);
});
