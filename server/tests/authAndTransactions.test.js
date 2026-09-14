const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {mongoTransaction} = require('../services/databaseTransaction');

function authFixture({claims={id:'u'}, user={id:'u',role:'promoter',status:'active'}, jwtError=false, databaseError=false}={}) {
  const context={module:{exports:{}},process:{env:{JWT_SECRET:'test'}},require:()=>({verify:()=>{if(jwtError)throw Error('Expired');return claims;}})};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../middleware/auth.js'),'utf8'),context);
  const result={};
  const req={headers:{authorization:'Bearer test'},app:{locals:{db:{User:{findOne:async()=>{if(databaseError)throw Error('Offline');return user;}}}}}};
  const res={status(code){result.status=code;return this;},json(body){result.body=body;return this;}};
  return {result,req,run:async()=>{await context.module.exports.authenticateToken(req,res,()=>{result.next=true;});return result;}};
}
test('authentication rejects expired tokens, deleted users, banned users and revoked sessions',async()=>{
  for(const [options,status] of [[{jwtError:true},401],[{user:null},401],[{user:{id:'u',status:'banned'}},403],[{claims:{id:'u'},user:{id:'u',tokenVersion:1}},401],[{databaseError:true},503]]) {
    const f=authFixture(options);await f.run();assert.equal(f.result.status,status);assert.equal(f.result.next,undefined);
  }
});
test('authentication uses current account role and preserves unrevoked legacy tokens',async()=>{
  const f=authFixture({claims:{id:'u',role:'admin'},user:{id:'u',role:'promoter',email:'actual@example.test'}});
  await f.run();assert.equal(f.result.next,true);assert.equal(f.req.user.role,'promoter');assert.equal(f.req.user.email,'actual@example.test');
});
test('Mongo financial operations all share the transaction session and close it',async()=>{
  const calls=[];const session={withTransaction:async work=>work(),endSession:async()=>calls.push('end')};
  const model={findOne:query=>({session:given=>{assert.equal(given,session);calls.push('read');return {id:'u'};}}),find:()=>({session:given=>{assert.equal(given,session);return [];}}),
    updateOne:async(query,update,options)=>{assert.equal(options.session,session);calls.push('update');},
    create:async(docs,options)=>{assert.equal(options.session,session);assert.ok(Array.isArray(docs));calls.push('create');return docs;}};
  const run=mongoTransaction({startSession:async()=>session},{User:model,Withdrawal:model});
  const result=await run(async tx=>{await tx.User.findOne({id:'u'});await tx.User.updateOne({id:'u'},{$inc:{walletBalance:-1000}});return tx.Withdrawal.create({id:'w'});});
  assert.equal(result.id,'w');assert.deepEqual(calls,['read','update','create','end']);
});
test('Mongo transaction errors propagate and always release the session',async()=>{
  let ended=false;const session={withTransaction:async work=>work(),endSession:async()=>{ended=true;}};
  await assert.rejects(mongoTransaction({startSession:async()=>session},{ })(async()=>{throw Error('Write failed');}),/Write failed/);
  assert.equal(ended,true);
});
