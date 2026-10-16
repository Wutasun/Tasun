// Offline, no Cloudflare calls. node --test tools/staging/tests/test_session_version.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, randomBytes } from 'node:crypto';
const source = readFileSync(new URL('../../../tasun-api/tasun-worker-stable-v4.js', import.meta.url), 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const ORIGIN = 'https://tasun-r1157-staging.pages.dev';
const BASE = 'https://tasun-worker-staging.wutasun.workers.dev';
const HASH = password => createHash('sha256').update(password).digest('hex');
const generation = () => randomBytes(16).toString('hex');
const secret = 'STAGING_TEST_ONLY_NON_PRODUCTION_SECRET_64_HEX_' + randomBytes(32).toString('hex');
const newPerson = (name, role) => ({username:name, pass_hash:HASH('pw-test-'+name), role, enabled:1, session_version:generation(),createdAt:1,updatedAt:1});
function makeDB() {
  const users = new Map([['r1157_test_admin',newPerson('r1157_test_admin','admin')],['r1157_test_write',newPerson('r1157_test_write','write')],['r1157_test_read',newPerson('r1157_test_read','read')]]);
  const auth = new Map([...users].map(([k,v])=>[k,{username:k, role:v.role,btn1:v.role==='admin'?1:0,btn2:0,btn3:0,btn4:0,btn5:0,updatedAt:1}]));
  const rows = new Map();
  let triggersHealthy=true;
  const db = { prepare(sql) {
    let args=[];
    const api={ bind(...values){args=values;return api;},async first(){
      if(sql.includes('FROM sqlite_master')) return {installed:triggersHealthy?5:0};
      if(sql.includes('FROM tasun_users')) return users.get(args[0])??null;
      if(sql.includes('FROM tasun_auth')) return auth.get(args[0])??null;
      throw new Error('unexpected read SQL '+sql);
    }, async all(){ if(sql.includes('FROM tasun_rows'))return{results:[...rows.values()].filter(x=>x.resourceKey===args[0])}; throw new Error('unexpected all SQL');},
    async run(){
      if(sql.includes('INSERT INTO tasun_auth')) {
        const [name,role,b1,b2,b3,b4,b5,ts]=args;
        auth.set(name,{username:name,role,btn1:b1,btn2:b2,btn3:b3,btn4:b4,btn5:b5,updatedAt:ts});
        if(users.has(name)) users.get(name).session_version=generation();
      } else if(sql.includes('INSERT INTO tasun_users')) {
        const [name,pass_hash,role,enabled,createdAt,updatedAt]=args;
        const old=users.get(name);
        users.set(name,{username:name,pass_hash,role,enabled,createdAt:old?.createdAt??createdAt,updatedAt,session_version:generation()});
      } else if(sql.includes('INSERT INTO tasun_rows')) {
        const [resourceKey,uid,data,updatedAt,rev,deleted]=args;
        rows.set(`${resourceKey}:${uid}`,{resourceKey,uid,data,updatedAt,rev,deleted});
      } else throw new Error('unexpected write SQL '+sql);
      return {success:true};
    }};
    return api;
  }};
  return {DB:db,users,auth,rows, removeTriggers(){triggersHealthy=false;}, AUTH_SECRET:secret, CORS_ALLOW_ORIGINS:ORIGIN};
}
async function req(env,path,body,token,origin=ORIGIN,method) {
  const headers={'Origin':origin};
  if(token)headers.Authorization=`Bearer ${token}`;
  if(body!==undefined)headers['content-type']='application/json';
  const r = new Request(BASE+path,{method:method??(body===undefined?'GET':'POST'),headers,body:body===undefined?undefined:JSON.stringify(body)});
  const answer=await worker.fetch(r,env,{});
  let data={};try{data=await answer.json();}catch{}
  return {status:answer.status,headers:answer.headers,data};
}
async function login(env,name) { return req(env,'/api/tasun/login',{username:name,password:'pw-test-'+name}); }
async function me(env,token){return req(env,'/api/tasun/me',undefined,token);}
async function current(env,name){const r=await login(env,name);assert.equal(r.status,200);assert.ok(r.data.token);return r.data.token;}
function mutateAuth(env,name,change){Object.assign(env.auth.get(name),change);env.users.get(name).session_version=generation();}
function mutateUser(env,name,change){Object.assign(env.users.get(name),change);env.users.get(name).session_version=generation();}

test('SV-01 no bearer rejected',async()=>{assert.equal((await me(makeDB())).status,401);});
test('SV-02 legacy signed token and tampered token denied',async()=>{
  const env=makeDB();const token=await current(env,'r1157_test_write');
  const [h,p,s]=token.split('.'); const original=JSON.parse(Buffer.from(p,'base64url').toString());
  assert.equal(original.tv,2);assert.match(original.sv,/^[a-f0-9]{32}$/);
  const tampered = `${h}.${p}.${s.slice(0,-1)}${s.endsWith('A')?'B':'A'}`;
  assert.equal((await me(env,tampered)).status,401);
  // Sign forged *syntactically valid* legacy/invalid payloads with the test-only HMAC key.
  const signed = payload => {
    const data = `${h}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
    const sig = createHmac('sha256',env.AUTH_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
  };
  for(const patch of [{sv:undefined},{sv:'xxx'},{tv:1},{exp:Date.now()-1},{exp:null}]){
    const payload={...original,...patch};
    assert.equal((await me(env,signed(payload))).status,401);
  }
});
test('SV-03 fresh accounts can login and /me with role',async()=>{
  const env=makeDB();for(const role of ['admin','write','read']){
    const token=await current(env,'r1157_test_'+role);
    const res=await me(env,token);assert.equal(res.status,200);assert.equal(res.data.role,role);
  }
});
test('SV-06/08 role downgrade/re-enable cannot resurrect older tokens',async()=>{
  const env=makeDB(),name='r1157_test_write';const old=await current(env,name);
  mutateAuth(env,name,{role:'read'});
  assert.equal((await me(env,old)).status,401);
  const downgraded=await current(env,name);
  assert.equal((await me(env,downgraded)).data.role,'read');
  mutateAuth(env,name,{role:'write'});
  assert.equal((await me(env,old)).status,401);
  assert.equal((await me(env,downgraded)).status,401);
  assert.equal((await me(env,await current(env,name))).data.role,'write');
});
test('SV-09/10 disable and re-enable never resurrect old token',async()=>{
  const env=makeDB(),name='r1157_test_write',old=await current(env,'r1157_test_write');
  mutateUser(env,name,{enabled:0});assert.equal((await me(env,old)).status,401);
  mutateUser(env,name,{enabled:1});assert.equal((await me(env,old)).status,401);
  assert.equal((await me(env,await current(env,name))).status,200);
});
test('SV-12 password rotation invalidates old token',async()=>{
  const env=makeDB(),name='r1157_test_write',old=await current(env,'r1157_test_write');
  mutateUser(env,name,{pass_hash:HASH('new-password')});assert.equal((await me(env,old)).status,401);
  assert.equal((await login(env,name)).status,401);
  const r=await req(env,'/api/tasun/login',{username:name,password:'new-password'});assert.equal(r.status,200);
});
test('SV-13 auth button change invalidates old token',async()=>{
  const env=makeDB(),name='r1157_test_read',old=await current(env,'r1157_test_read');
  mutateAuth(env,name,{btn1:1});assert.equal((await me(env,old)).status,401);
});
test('SV-14 removed/recreated same user never accepts old token',async()=>{
  const env=makeDB(),name='r1157_test_read',old=await current(env,'r1157_test_read');
  env.users.delete(name);env.users.set(name,newPerson(name,'read'));assert.equal((await me(env,old)).status,401);
});
test('SV-15 missing session_version or D1 failure fails closed',async()=>{
  const env=makeDB(),name='r1157_test_read';const token=await current(env,name);
  env.users.get(name).session_version='';assert.equal((await me(env,token)).status,401);
  delete env.users.get(name).session_version;assert.equal((await me(env,token)).status,401);
  env.DB.prepare=()=>{throw new Error('D1 unreachable')};assert.notEqual((await me(env,token)).status,200);
});
test('SV-16 credentialed CORS only for allowed origin',async()=>{
  const env=makeDB();
  const good=await req(env,'/api/tasun/health',undefined,undefined,ORIGIN);
  assert.equal(good.headers.get('Access-Control-Allow-Origin'),ORIGIN);
  assert.equal(good.headers.get('Access-Control-Allow-Credentials'),'true');
  const evil=await req(env,'/api/tasun/health',undefined,undefined,'https://evil.example');
  assert.notEqual(evil.headers.get('Access-Control-Allow-Origin'),'https://evil.example');
  assert.notEqual(evil.headers.get('Access-Control-Allow-Origin'),'*');
  const opts=await req(env,'/api/tasun/health',undefined,undefined,ORIGIN,'OPTIONS');
  assert.equal(opts.status,204);
  assert.equal(opts.headers.get('Access-Control-Allow-Credentials'),'true');
});
test('SV-17 no auth /read denied, read /merge denied',async()=>{
  const env=makeDB();assert.equal((await req(env,'/api/tasun/read',{resourceKey:'test'})).status,401);
  const readToken=await current(env,'r1157_test_read');
  assert.equal((await req(env,'/api/tasun/merge',{resourceKey:'fixture',payload:{db:[]}},readToken)).status,403);
});
test('SV-19 new token admin/user operations invalidate affected accounts only',async()=>{
  const env=makeDB();const admin=await current(env,'r1157_test_admin');const read=await current(env,'r1157_test_read');
  const changed=await req(env,'/api/tasun/auth/upsert',{row:{username:'r1157_test_read',role:'read',btn1:1}},admin);
  assert.equal(changed.status,200);assert.equal((await me(env,read)).status,401);
  assert.equal((await me(env,admin)).status,200);
});

test('SV-15 missing revocation trigger fails closed even when sv matches',async()=>{
  const env=makeDB(),token=await current(env,'r1157_test_write');
  env.removeTriggers();
  assert.equal((await me(env,token)).status,401);
  assert.equal((await login(env,'r1157_test_write')).status,401);
});
