const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');
const createRouter=require('../routes/emailMarketing');const {STARTER}=require('../services/emailMarketing');
let server,base; let uploads=0;const oldSecret=process.env.JWT_SECRET;
const users={admin:{id:'admin',email:'owner@example.test',role:'admin'},user:{id:'user',email:'person@example.test',role:'company',marketingSubscribed:true}};
const campaigns=new Map();
const Campaign={findOneAndUpdate:async({_id,status},{$set})=>{const row=campaigns.get(_id);if(!row || !status.$in.includes(row.status))return null;Object.assign(row,$set);return row;},findById:async id=>campaigns.get(id)};
const rows=new Map();let unsubscribed=false;
const Notification={create:async row=>{rows.set(row.id,row);},findOne:async({id})=>rows.get(id)};
const User={findOne:async({id})=>users[id],updateOne:async({id},{$set})=>Object.assign(users[id],$set)};
test.before(async()=>{process.env.JWT_SECRET='email-tests-only';const app=express();app.use(express.json());app.locals.db={User};
  app.use('/email',createRouter({uploadImage:async()=>{uploads++;return 'https://res.cloudinary.com/test/image/upload/email.png';},models:{EmailCampaign:Campaign},User,Notification,isConnected:()=>true,env:{ADMIN_EMAIL:'owner@example.test',NODE_ENV:'production'},resend:{contacts:{get:async()=>({data:{id:'contact',unsubscribed}}),update:async row=>{unsubscribed=row.unsubscribed;return{data:{id:'contact'}};}}}}));
  await new Promise(resolve=>{server=app.listen(0,'127.0.0.1',resolve);});base=`http://127.0.0.1:${server.address().port}/email`;
});
test.after(async()=>{await new Promise(r=>server.close(r));if(oldSecret===undefined)delete process.env.JWT_SECRET;else process.env.JWT_SECRET=oldSecret;});
async function call(path,user,body,headers={}){return fetch(base+path,{method:body?'POST':'GET',headers:{...(user?{Authorization:'Bearer '+jwt.sign({id:user},process.env.JWT_SECRET)}:{}),'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});}
test('anonymous and non-admin accounts cannot preview or send tests',async()=>{
  assert.equal((await call('/admin/preview',null,STARTER)).status,401);
  assert.equal((await call('/admin/test','user',STARTER)).status,403);assert.equal(rows.size,0);
});
test('admin preview is read only, and test ignores any supplied recipient',async()=>{
  const preview=await call('/admin/preview','admin',STARTER);assert.equal(preview.status,200);assert.equal(rows.size,0);
  const headers={'Idempotency-Key':'test-email-key-12345'};
  assert.equal((await call('/admin/test','admin',{...STARTER,to:'someone@else.test'},headers)).status,200);
  assert.equal((await call('/admin/test','admin',STARTER,headers)).status,200);assert.equal(rows.size,1);assert.equal([...rows.values()][0].to,'tryspreadfast@gmail.com');
});
test('preferences update only the authenticated user and provider suppression',async()=>{
  const res=await fetch(base+'/preferences',{method:'PUT',headers:{Authorization:'Bearer '+jwt.sign({id:'user'},process.env.JWT_SECRET),'Content-Type':'application/json'},body:JSON.stringify({subscribed:false,userId:'admin'})});
  assert.equal(res.status,200);assert.equal(users.user.marketingSubscribed,false);assert.equal(users.admin.marketingSubscribed,undefined);assert.equal(unsubscribed,true);
});

async function imageRequest(user, bytes, type='image/png') {
  const body=new FormData(); if(bytes)body.append('image',new Blob([bytes],{type}),'photo.png');
  return fetch(base+'/admin/images',{method:'POST',headers:{Authorization:'Bearer '+jwt.sign({id:user},process.env.JWT_SECRET)},body});
}
test('image uploads require admin and validate type, signature and size',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10]);
  assert.equal((await imageRequest('user',png)).status,403);assert.equal(uploads,0);
  assert.equal((await imageRequest('admin',null)).status,400);
  assert.equal((await imageRequest('admin',Buffer.from('fake'),'image/png')).status,400);
  assert.equal((await imageRequest('admin',Buffer.from('<svg/>'),'image/svg+xml')).status,400);
  assert.equal((await imageRequest('admin',Buffer.alloc(5*1024*1024+1))).status,413);assert.equal(uploads,0);
  const response=await imageRequest('admin',png);assert.equal(response.status,200);
  assert.equal((await response.json()).imageUrl,'https://res.cloudinary.com/test/image/upload/email.png');assert.equal(uploads,1);
});

test('send-now requires admin, validates ids and is idempotent for an existing campaign',async()=>{
  const id='abcdef0123456789abcdef01';campaigns.set(id,{_id:id,status:'draft'});
  assert.equal((await call(`/admin/campaigns/${id}/send`,null,{})).status,401);
  assert.equal((await call(`/admin/campaigns/${id}/send`,'user',{})).status,403);
  assert.equal(campaigns.get(id).status,'draft');
  assert.equal((await call('/admin/campaigns/invalid/send','admin',{})).status,400);
  const responses=await Promise.all([call(`/admin/campaigns/${id}/send`,'admin',{}),call(`/admin/campaigns/${id}/send`,'admin',{})]);
  assert.deepEqual(responses.map(r=>r.status),[202,202]);assert.equal(campaigns.get(id).status,'queued');
  campaigns.get(id).status='needs_review';assert.equal((await call(`/admin/campaigns/${id}/send`,'admin',{})).status,409);
  assert.equal((await call('/admin/campaigns/abcdef0123456789abcdef02/send','admin',{})).status,404);
});
