'use strict';
// Targeted tests for G3 local-only dual API adapter. No network or real secrets.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const apiDir = path.join(root, 'tasun-api');

// Dynamic import from local file: g3-dual-api-local.js imports .js ES modules.
// Repository uses CommonJS .cjs tests without a root module type.
// Load modules as a contained temporary .mjs tree to preserve relative imports.
let harness;
let tempDir;
async function load() {
  if (harness) return harness;
  const os = require('node:os');
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasun-g3-dual-'));
  for (const [a,b] of [
    ['g3-dual-api-local.js','g3-dual-api-local.mjs'],
    ['tasun-worker-stable-v4.js','tasun-worker-stable-v4.mjs'],
    ['worker.js','worker.mjs'],
  ]) {
    let text = fs.readFileSync(path.join(apiDir,a),'utf8');
    if (a === 'g3-dual-api-local.js') {
      text = text.replace('./tasun-worker-stable-v4.js','./tasun-worker-stable-v4.mjs')
                 .replace('./worker.js','./worker.mjs');
    }
    fs.writeFileSync(path.join(tempDir,b),text);
  }
  harness = (await import('file://'+path.join(tempDir,'g3-dual-api-local.mjs'))).default;
  return harness;
}

function fakeDb() {
  const db = { reads:0, writes:0, rows:new Map() };
  db.prepare = (sql) => ({bind(...args){return {
    async first(){
      db.reads++;
      if(sql.includes('FROM tasun_users')) return {username:'fixture',enabled:1,role:'admin',pass_hash:crypto.createHash('sha256').update('fixture-password').digest('hex')};
      if(sql.includes('FROM tasun_auth')) return {username:'fixture',role:'admin'};
      if(sql.includes('SELECT deleted FROM tasun_rows')) return null;
      throw Error('unsupported mock SQL: '+sql.slice(0,90));
    },
    async all(){db.reads++;return {results:[]};},
    async run(){db.writes++;throw Error('unexpected non-transactional DB write')},
    sql,args,
  }}});
  db.batch = async (statements) => {db.writes += statements.length;return statements.map(()=>({success:true}));};
  return db;
}

async function environment(){
  const worker = await load();
  const G3_DB=fakeDb(), LEGACY_DB=fakeDb();
  const env={G3_DB,LEGACY_DB,G3_AUTH_SECRET:'synthetic-not-real-hmac-secret-for-local-tests-12345'};
  async function call(route,method='GET',body,token,overrides={}){
    const headers={'content-type':'application/json'};
    if(token)headers.Authorization='Bearer '+token;
    const init={method,headers};
    if(body!==undefined && method!=='GET')init.body=JSON.stringify(body);
    const response=await worker.fetch(new Request('http://localhost:8787'+route,init),{...env,...overrides},{});
    return {status:response.status,body:await response.json()};
  }
  return {worker, env, G3_DB, LEGACY_DB, call};
}

test('local G3 health dispatches without touching either D1',async()=>{
  const f=await environment();const r=await f.call('/api/tasun/health');
  assert.equal(r.status,200);assert.equal(r.body.ok,true);
  assert.equal(f.G3_DB.reads+f.LEGACY_DB.reads,0);
});
test('legacy health remains Access authenticated; HMAC cannot bypass it',async()=>{
  const f=await environment();const login=await f.call('/api/tasun/login','POST',{username:'fixture',password:'fixture-password'});
  assert.equal(login.status,200);
  for(const route of ['/api/health','/api/read?key=fixture','/api/merge','/api/tasun/pull?key=fixture']) {
    const r=await f.call(route,route==='/api/merge'?'POST':'GET',{key:'fixture',items:[]},login.body.token);
    assert.equal(r.status,401,route);
  }
  assert.equal(f.LEGACY_DB.reads+f.LEGACY_DB.writes,0);
});
test('G3 POST login and read use G3_DB exclusively',async()=>{
  const f=await environment();const login=await f.call('/api/tasun/login','POST',{username:'fixture',password:'fixture-password'});
  assert.equal(login.status,200);
  const read=await f.call('/api/tasun/read','POST',{resourceKey:'official-docs'},login.body.token);
  assert.equal(read.status,200);assert.deepEqual(read.body.rows,[]);
  assert.ok(f.G3_DB.reads>0);assert.equal(f.LEGACY_DB.reads+f.LEGACY_DB.writes,0);
});
test('G3 admin write cannot write legacy records DB',async()=>{
  const f=await environment();const login=await f.call('/api/tasun/login','POST',{username:'fixture',password:'fixture-password'});
  const merge=await f.call('/api/tasun/merge','POST',{resourceKey:'official-docs',payload:{db:[{uid:'test-1',deleted:false,rev:1,updatedAt:100000000}]}},login.body.token);
  assert.equal(merge.status,200);assert.equal(f.G3_DB.writes,1);assert.equal(f.LEGACY_DB.writes,0);
});
test('historic merge?key= is never routed to the G3 token handler',async()=>{
  const f=await environment();const login=await f.call('/api/tasun/login','POST',{username:'fixture',password:'fixture-password'});
  const merge=await f.call('/api/tasun/merge?key=fixture','POST',{resourceKey:'official-docs',payload:{db:[]}},login.body.token);
  assert.equal(merge.status,401);assert.equal(f.G3_DB.writes+f.LEGACY_DB.writes,0);
});
test('unknown API path fails closed without either DB access',async()=>{
  const f=await environment();const r=await f.call('/api/tasun/unknown');
  assert.equal(r.status,404);assert.equal(f.G3_DB.reads+f.LEGACY_DB.reads,0);
});
test('local-only gate blocks non-localhost request, including health',async()=>{
  const f=await environment();
  const response=await f.worker.fetch(new Request('https://tasun-worker.wutasun.workers.dev/api/tasun/health'),f.env,{});
  assert.equal(response.status,403);assert.equal((await response.json()).error,'LOCAL_ONLY');
});
test('binding isolation fails closed if either binding is missing or aliases same DB',async()=>{
  const f=await environment();
  for(const overrides of [{G3_DB:null},{LEGACY_DB:null},{LEGACY_DB:f.G3_DB}]){
    const r=await f.call('/api/tasun/health','GET',undefined,null,overrides);
    assert.equal(r.status,503);
  }
});
test('local config has independent fake D1 UUIDs and never changes formal Wrangler entry',()=>{
  const formal=fs.readFileSync(path.join(apiDir,'wrangler.toml'),'utf8');
  const dual=fs.readFileSync(path.join(apiDir,'wrangler.g3-dual-local.toml'),'utf8');
  assert.match(formal,/main\s*=\s*"worker_tasun\.js"/);
  assert.match(dual,/main\s*=\s*"g3-dual-api-local\.js"/);
  assert.match(dual,/workers_dev\s*=\s*false/);
  assert.match(dual,/binding\s*=\s*"G3_DB"/);
  assert.match(dual,/binding\s*=\s*"LEGACY_DB"/);
  const ids=[...dual.matchAll(/database_id\s*=\s*"([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);
  assert.ok(ids.every(s=>/^00000000-0000-0000-0000-00000000000[12]$/.test(s)));
});
