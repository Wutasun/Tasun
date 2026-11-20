'use strict';
// Review-only boundary checks. Do NOT treat passing as full-site compatibility.
// These tests never access Cloudflare, real credentials, or a real D1 database.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const apiDir = path.join(ROOT, 'tasun-api');
const source = fs.readFileSync(path.join(apiDir, 'tasun-worker-stable-v4.js'), 'utf8');
const legacy = fs.readFileSync(path.join(apiDir, 'worker.js'), 'utf8');
const kit = fs.readFileSync(path.join(ROOT, 'tasun-cloud-kit.js'), 'utf8');
const workerPromise = import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

async function context(){
  const db = {
    writes: 0,
    prepare(sql){
      return { bind(){return {
        async first(){
          if(sql.includes('FROM tasun_users')) return {
            username:'fixture',enabled:1,role:'admin',
            pass_hash:crypto.createHash('sha256').update('fake-password').digest('hex')
          };
          if(sql.includes('FROM tasun_auth')) return {username:'fixture',role:'admin'};
          return null;
        },
        async all(){return {results:[]}},
        async run(){db.writes++;throw new Error('unexpected write')}
      };}};
    },
    async batch(){db.writes++;throw new Error('unexpected batch')}
  };
  const env = {DB:db,AUTH_SECRET:'synthetic-only-not-for-deployment-1234567890'};
  const worker = (await workerPromise).default;
  async function request(route,method='GET',body,token){
    const headers={'Content-Type':'application/json'};
    if(token)headers.Authorization='Bearer '+token;
    const options={method,headers};
    if(body!==undefined && method!=='GET')options.body=JSON.stringify(body);
    const res=await worker.fetch(new Request('https://offline.invalid'+route,options),env,{});
    return {status:res.status,body:await res.json()};
  }
  const auth=await request('/api/tasun/login','POST',{username:'fixture',password:'fake-password'});
  assert.equal(auth.status,200,'synthetic login failed');
  return {db,request,token:auth.body.token};
}

test('G3 document pages explicitly use the stable-v4 POST API',()=>{
  const detail=fs.readFileSync(path.join(ROOT,'汐東收發文明細表.html'),'utf8');
  const register=fs.readFileSync(path.join(ROOT,'汐東收發文登錄表.html'),'utf8');
  for(const s of [detail,register]){
    assert.ok(s.includes('"/api/tasun/read"'));
    assert.ok(s.includes('"/api/tasun/merge"'));
  }
});

test('older Cloud Kit POST client provides no bearer authentication by default',()=>{
  assert.match(kit, /credentials:\s*'omit'/);
  assert.match(kit, /method:\s*'POST'/);
  assert.doesNotMatch(kit, /headers\.Authorization\s*=|headers\[['"]Authorization['"]\]\s*=/);
});

test('HMAC candidate and Access legacy Worker are distinct authentication contracts',()=>{
  assert.match(source,/AUTH_SECRET/);
  assert.match(source,/requireAuth\(request, env\)/);
  assert.match(legacy,/verifyAccess\(req, env\)/);
  assert.match(legacy,/Cf-Access-Jwt-Assertion/);
  assert.match(legacy,/CF_Authorization/);
});

test('data schemas are distinct; never silently alias the two databases',()=>{
  assert.match(source,/FROM tasun_rows/);
  assert.match(source,/INSERT INTO tasun_rows/);
  assert.match(legacy,/FROM records/);
  assert.match(legacy,/INSERT INTO records/);
});

test('legacy read route remains unavailable on HMAC candidate even with token',async()=>{
  const c=await context();
  const a=await c.request('/api/read?key=fixture','GET',undefined,c.token);
  assert.equal(a.status,404);
  assert.equal(c.db.writes,0);
});

test('legacy write route is not exposed by the G3 candidate even with token',async()=>{
  const c=await context();
  const a=await c.request('/api/merge','POST',{key:'fixture',items:[{uid:'a'}]},c.token);
  assert.equal(a.status,404);
  assert.equal(c.db.writes,0);
});

test('legacy unauthenticated read and merge fail closed, without DB write',async()=>{
  const c=await context();
  const read=await c.request('/api/read?key=fixture');
  const merge=await c.request('/api/merge','POST',{key:'fixture',items:[{uid:'a'}]});
  assert.equal(read.status,401);
  assert.equal(merge.status,401);
  assert.equal(c.db.writes,0);
});

test('G3 merge does not accept legacy root rows payload or permit write side effects',async()=>{
  const c=await context();
  const a=await c.request('/api/tasun/merge','POST',{resourceKey:'official-docs',rows:[{uid:'a',rev:1,updatedAt:111}]},c.token);
  assert.equal(a.status,400);
  assert.equal(c.db.writes,0);
});

test('G3 read remains POST-only and Bearer-authenticated',async()=>{
  const c=await context();
  const get=await c.request('/api/tasun/read?resourceKey=official-docs','GET',undefined,c.token);
  const noAuth=await c.request('/api/tasun/read','POST',{resourceKey:'official-docs'});
  assert.equal(get.status,405);
  assert.equal(noAuth.status,401);
});

test('formal Wrangler entry remains unresolved; local candidate config must stay isolated',()=>{
  const formal=fs.readFileSync(path.join(apiDir,'wrangler.toml'),'utf8');
  const local=fs.readFileSync(path.join(apiDir,'wrangler.g3-local.toml'),'utf8');
  assert.match(formal,/main\s*=\s*"worker_tasun\.js"/);
  assert.ok(!fs.existsSync(path.join(apiDir,'worker_tasun.js')));
  assert.match(local,/main\s*=\s*"tasun-worker-stable-v4\.js"/);
  assert.match(local,/name\s*=\s*"tasun-g3-local-review-only"/);
  assert.match(local,/workers_dev\s*=\s*false/);
});
