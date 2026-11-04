'use strict';
// G3 incremental synthetic tests for the isolated, undeployed candidate only.
// No real network, Cloudflare, D1, credentials or personal data are accessed.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const filename=path.resolve(__dirname,'../tasun-api/tasun-worker-stable-v4.js');
const moduleUrl='data:text/javascript;base64,'+fs.readFileSync(filename).toString('base64');
const modPromise=import(moduleUrl);

class MockDB{
  constructor(){
    this.users=new Map();this.auths=new Map();this.rows=new Map();
    this.writes=0;this.batches=0;this.failBatch=false;
  }
  key(resource,uid){return `${resource}\x00${uid}`;}
  prepare(sql){
    const db=this;
    return {bind(...args){return {
      sql,args,
      async first(){
        if(sql.includes('FROM tasun_users'))return db.users.get(args[0])||null;
        if(sql.includes('FROM tasun_auth'))return db.auths.get(args[0])||null;
        if(sql.includes('SELECT deleted FROM tasun_rows')){
          const r=db.rows.get(db.key(args[0],args[1]));return r?{deleted:r.deleted}:null;
        }
        throw Error('unexpected first query: '+sql.slice(0,70));
      },
      async all(){
        if(sql.includes('FROM tasun_rows')){
          return {results:[...db.rows.values()].filter(r=>r.resourceKey===args[0]).map(r=>({...r}))};
        }
        throw Error('unexpected all query');
      },
      async run(){throw Error('unexpected mutation outside transactional batch');}
    };}};
  }
  async batch(statements){
    this.batches++;
    if(this.failBatch)throw Error('synthetic db failure');
    const next=new Map([...this.rows].map(([k,v])=>[k,{...v}]));
    for(const st of statements){
      assert.match(st.sql,/INSERT INTO tasun_rows/);
      const [resourceKey,uid,data,updatedAt,rev,deleted]=st.args;
      const k=this.key(resourceKey,uid),old=next.get(k);
      if(!old || updatedAt>old.updatedAt || (updatedAt===old.updatedAt && rev>=old.rev)){
        next.set(k,{resourceKey,uid,data,updatedAt,rev,deleted});
      }
    }
    this.rows=next;this.writes+=statements.length;
    return statements.map(()=>({success:true}));
  }
}

async function fixture(role='write', secret='offline-only-strong-signing-secret-48-characters-long'){
  const worker=(await modPromise).default;
  const db=new MockDB();
  const username='synthetic_test_user';
  const password='synthetic-password-only';
  db.users.set(username,{username,role,enabled:1,pass_hash:crypto.createHash('sha256').update(password).digest('hex')});
  db.auths.set(username,{username,role});
  const env={DB:db,AUTH_SECRET:secret,CORS_ALLOW_ORIGINS:'https://wutasun.github.io'};
  async function call(route,body,token,method='POST'){
    const headers={'Content-Type':'application/json'};
    if(token)headers.Authorization='Bearer '+token;
    const options={method,headers};
    if(method!=='GET')options.body=JSON.stringify(body);
    const res=await worker.fetch(new Request('https://test.example'+route,options),env,{});
    return {status:res.status,data:await res.json()};
  }
  const logged=await call('/api/tasun/login',{username,password});
  return {env,db,call,login:logged,token:logged.data.token,username};
}
const row=(uid,deleted=false)=>({uid,deleted,updatedAt:100000000,rev:1,title:'synthetic row'});
const merge=(resourceKey,db)=>({resourceKey,payload:{db}});

test('valid read-only login can read but cannot merge (whole batch zero writes)',async()=>{
 const f=await fixture('read');
 assert.equal(f.login.status,200);
 const r=await f.call('/api/tasun/read',{resourceKey:'official-documents'},f.token);
 assert.equal(r.status,200);
 const w=await f.call('/api/tasun/merge',merge('official-documents',[row('a')]),f.token);
 assert.equal(w.status,403);assert.equal(f.db.writes,0);
});
test('unknown signed role fails closed for merge',async()=>{
 const f=await fixture('unknown-role');
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('b')]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.writes,0);
});
test('write can create or edit non-deleted rows; read preserves API shape',async()=>{
 const f=await fixture('write');
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a'),row('b')]),f.token);
 assert.deepEqual(r.data,{ok:true,count:2});assert.equal(f.db.writes,2);assert.equal(f.db.batches,1);
 const read=await f.call('/api/tasun/read',{resourceKey:'official-documents'},f.token);
 assert.equal(read.status,200);assert.equal(read.data.rows.length,2);
});
test('write cannot submit deleted=true, no persistence',async()=>{
 const f=await fixture('write');
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a',true)]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.writes,0);
});
test('mixed valid and unauthorized deletion is all rejected',async()=>{
 const f=await fixture('write');
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a'),row('b',true)]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.rows.size,0);assert.equal(f.db.writes,0);
});
test('write cannot edit or restore an existing tombstone',async()=>{
 const f=await fixture('write');
 f.db.rows.set(f.db.key('official-documents','a'),{resourceKey:'official-documents',uid:'a',deleted:1,rev:5,updatedAt:5,data:'{}'});
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a',false)]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.writes,0);
});
test('admin may delete, but restoration is fail-closed pending G1 authorization',async()=>{
 const f=await fixture('admin');
 const del=await f.call('/api/tasun/merge',merge('official-documents',[row('a',true)]),f.token);
 assert.equal(del.status,200);assert.equal(f.db.rows.get(f.db.key('official-documents','a')).deleted,1);
 const restore=await f.call('/api/tasun/merge',merge('official-documents',[{...row('a',false),rev:2,updatedAt:100000001}]),f.token);
 assert.equal(restore.status,403);assert.equal(f.db.writes,1);
});
test('revoked user cannot merge with still-valid signed token',async()=>{
 const f=await fixture('write');
 f.db.users.get(f.username).enabled=0;
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a')]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.writes,0);
});
test('downgraded role blocks previously issued write token',async()=>{
 const f=await fixture('write');
 f.db.auths.get(f.username).role='read';
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a')]),f.token);
 assert.equal(r.status,403);assert.equal(f.db.writes,0);
});
test('invalid payload.db or malformed rows reject without treating as []',async()=>{
 const f=await fixture('write');
 for(const body of [
  {resourceKey:'official-documents',payload:{}},
  {resourceKey:'official-documents',payload:{db:{uid:'x'}}},
  merge('official-documents',[null]),
  merge('official-documents',[row('x'),row('x')]),
  merge('official-documents',[{...row('a'),deleted:'false'}]),
 ]){
  const r=await f.call('/api/tasun/merge',body,f.token);
  assert.equal(r.status,400);
 }
 assert.equal(f.db.writes,0);
});
test('missing secret: no login token issued and forged token not accepted',async()=>{
 const f=await fixture('read','');
 assert.notEqual(f.login.status,200);assert.equal(f.login.data.token,undefined);
 const r=await f.call('/api/tasun/me',{},'a.b.c');
 assert.equal(r.status,401);
});
test('weak secret also fails closed',async()=>{
 const f=await fixture('read','weak');
 assert.notEqual(f.login.status,200);
 const r=await f.call('/api/tasun/read',{resourceKey:'official-documents'},'a.b.c');
 assert.equal(r.status,401);
});
test('unauthenticated merge fails, zero writes',async()=>{
 const f=await fixture('admin');
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a')]),null);
 assert.equal(r.status,401);assert.equal(f.db.writes,0);
});
test('synthetic D1 batch failure does not report success or partial commit',async()=>{
 const f=await fixture('write'); f.db.failBatch=true;
 const r=await f.call('/api/tasun/merge',merge('official-documents',[row('a'),row('b')]),f.token);
 assert.equal(r.status,500);assert.equal(f.db.writes,0);assert.equal(f.db.rows.size,0);
});
test('GET merge has no write side effect',async()=>{
 const f=await fixture('admin');
 const r=await f.call('/api/tasun/merge',null,f.token,'GET');
 assert.equal(r.status,405);assert.equal(f.db.writes,0);
});
