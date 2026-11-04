const test=require('node:test');const assert=require('node:assert/strict');const express=require('express');const jwt=require('jsonwebtoken');
const createRouter=require('../routes/emailMarketing');const {STARTER}=require('../services/emailMarketing');
let server,base;const oldSecret=process.env.JWT_SECRET;
const users={admin:{id:'admin',email:'owner@example.test',role:'admin'},user:{id:'user',email:'person@example.test',role:'company',marketingSubscribed:true}};
const rows=new Map();let unsubscribed=false;
const Notification={create:async row=>{rows.set(row.id,row);},findOne:async({id})=>rows.get(id)};
const User={findOne:async({id})=>users[id],updateOne:async({id},{$set})=>Object.assign(users[id],$set)};
test.before(async()=>{process.env.JWT_SECRET='email-tests-only';const app=express();app.use(express.json());app.locals.db={User};
  app.use('/email',createRouter({models:{},User,Notification,isConnected:()=>true,env:{ADMIN_EMAIL:'owner@example.test',NODE_ENV:'production'},resend:{contacts:{get:async()=>({data:{id:'contact',unsubscribed}}),update:async row=>{unsubscribed=row.unsubscribed;return{data:{id:'contact'}};}}}}));
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
