'use strict';
// G3 formal integration gap: enforce current account status and non-escalating
// roles on EVERY protected API, not only POST /api/tasun/merge.
// Synthetic tokens/D1; never touches production, real credentials, or network.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = fs.readFileSync(path.resolve(__dirname,'../tasun-api/tasun-worker-stable-v4.js'),'utf8');
const workerPromise = import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class DB {
  constructor(){this.users=new Map();this.auths=new Map();this.rows=new Map();this.readRows=0;this.writes=0;}
  prepare(sql){const that=this;return {bind(...args){return {
    async first(){
      if(sql.includes('FROM tasun_users'))return that.users.get(args[0])||null;
      if(sql.includes('FROM tasun_auth'))return that.auths.get(args[0])||null;
      if(sql.includes('SELECT deleted FROM tasun_rows'))return null;
      throw Error('unexpected mock select '+sql);
    },
    async all(){if(sql.includes('FROM tasun_rows')){that.readRows++;return {results:[]};}throw Error('unexpected mock read '+sql);},
    async run(){that.writes++;throw Error('unexpected write to synthetic DB');}
  };}};}
  async batch(){this.writes++;throw Error('unexpected synthetic D1 batch');}
}
async function setup(initialRole='admin'){
  const worker=(await workerPromise).default;
  const db=new DB(), username='fixture_user', password='SYNTHETIC-ONLY-PASSWORD';
  db.users.set(username,{username,role:initialRole,enabled:1,pass_hash:crypto.createHash('sha256').update(password).digest('hex')});
  db.auths.set(username,{username,role:initialRole});
  const env={DB:db,AUTH_SECRET:'LOCAL-ONLY-SYNTHETIC-32-BYTES-MIN-123456789',CORS_ALLOW_ORIGINS:'http://localhost:8787'};
  async function call(endpoint,body,token,method='POST'){
    const headers={'content-type':'application/json'};
    if(token)headers.authorization='Bearer '+token;
    const init={method,headers};if(body!==undefined && method!=='GET')init.body=JSON.stringify(body);
    const response=await worker.fetch(new Request('http://localhost:8787'+endpoint,init),env,{});
    return {status:response.status,result:await response.json()};
  }
  const login=await call('/api/tasun/login',{username,password});
  assert.equal(login.status,200);
  return {db,username,password,call,token:login.result.token};
}
const merge={resourceKey:'official-docs',payload:{db:[{uid:'synthetic',rev:1,updatedAt:100000000,deleted:false}]}};
test('disabled account cannot read with a still-valid HMAC token',async()=>{
  const f=await setup('read');f.db.users.get(f.username).enabled=0;
  const out=await f.call('/api/tasun/read',{resourceKey:'official-docs'},f.token);
  assert.equal(out.status,403);assert.equal(out.result.error,'FORBIDDEN');assert.equal(f.db.readRows,0);
});
test('disabled account cannot access /me with an unexpired token',async()=>{
  const f=await setup('admin');f.db.users.get(f.username).enabled=0;
  const out=await f.call('/api/tasun/me',undefined,f.token,'GET');
  assert.equal(out.status,403);
});
test('deleted account cannot read or manage users with an old token',async()=>{
  const f=await setup('admin');f.db.users.delete(f.username);
  assert.equal((await f.call('/api/tasun/read',{resourceKey:'official-docs'},f.token)).status,403);
  assert.equal((await f.call('/api/tasun/users/upsert',{row:{username:'other',password:'dummy'}},f.token)).status,403);
  assert.equal(f.db.writes,0);
});
test('admin downgrade immediately blocks privileged auth/read of other users',async()=>{
  const f=await setup('admin');f.db.auths.get(f.username).role='read';
  const out=await f.call('/api/tasun/auth/read',{username:'other-user'},f.token);
  assert.equal(out.status,403);
});
test('admin downgrade immediately blocks both administrative upserts',async()=>{
  const f=await setup('admin');f.db.auths.get(f.username).role='write';
  assert.equal((await f.call('/api/tasun/auth/upsert',{row:{username:'other-user',role:'admin'}},f.token)).status,403);
  assert.equal((await f.call('/api/tasun/users/upsert',{row:{username:'other-user',password:'dummy'}},f.token)).status,403);
  assert.equal(f.db.writes,0);
});
test('stale elevated admin token reports current downgraded role via /me',async()=>{
  const f=await setup('admin');f.db.auths.get(f.username).role='read';
  const out=await f.call('/api/tasun/me',undefined,f.token,'GET');
  assert.equal(out.status,200);assert.equal(out.result.role,'read');
});
test('promoted read-only account cannot merge or administer via old token',async()=>{
  const f=await setup('read');f.db.auths.get(f.username).role='admin';
  assert.equal((await f.call('/api/tasun/merge',merge,f.token)).status,403);
  assert.equal((await f.call('/api/tasun/auth/upsert',{row:{username:'other-user'}},f.token)).status,403);
  assert.equal(f.db.writes,0);
  const me=await f.call('/api/tasun/me',undefined,f.token,'GET');
  assert.equal(me.status,200);assert.equal(me.result.role,'read');
});
test('fresh login after a legitimate promotion can claim new permissions',async()=>{
  const f=await setup('read');f.db.auths.get(f.username).role='admin';
  const logged=await f.call('/api/tasun/login',{username:f.username,password:f.password});
  assert.equal(logged.status,200);assert.equal(logged.result.role,'admin');
  const me=await f.call('/api/tasun/me',undefined,logged.result.token,'GET');
  assert.equal(me.status,200);assert.equal(me.result.role,'admin');
});
test('ordinary valid reader still receives expected rows response envelope',async()=>{
  const f=await setup('read');const out=await f.call('/api/tasun/read',{resourceKey:'official-docs'},f.token);
  assert.equal(out.status,200);assert.deepEqual(out.result,{ok:true,resourceKey:'official-docs',rows:[]});
});
test('local dual-API adapter remains isolated and formal Wrangler is unmodified',()=>{
  const api=path.resolve(__dirname,'../tasun-api');
  const dual=fs.readFileSync(path.join(api,'g3-dual-api-local.js'),'utf8');
  const formal=fs.readFileSync(path.join(api,'wrangler.toml'),'utf8');
  assert.match(dual,/LOCAL_ONLY/);assert.match(dual,/env\.G3_DB === env\.LEGACY_DB/);
  assert.match(formal,/main\s*=\s*"worker_tasun\.js"/);
});
