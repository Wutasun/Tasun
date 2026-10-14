import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
const root=path.resolve(import.meta.dirname,'..');
test('R1157 real Worker role guard and fail-closed signing (isolated D1)',async t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'r1157-ci-auth-')),file=path.join(folder,'worker.mjs');
 fs.copyFileSync(path.join(root,'tasun-api/tasun-worker-stable-v4.js'),file);
 const db=new DatabaseSync(':memory:');
 try{
  db.exec(fs.readFileSync(path.join(root,'tasun-api/schema_v4.sql'),'utf8'));
  const worker=(await import(pathToFileURL(file).href)).default;
  const password='ISOLATED_CI_TEST_ONLY',pass=crypto.createHash('sha256').update(password).digest('hex'),now=Date.now();
  for(const [user,role] of [['admin-ci','admin'],['write-ci','write'],['read-ci','read'],['unknown-ci','other']])db.prepare('INSERT INTO tasun_users(username,pass_hash,role,enabled,createdAt,updatedAt) VALUES(?,?,?,?,?,?)').run(user,pass,role,1,now,now);
  const binding={prepare(sql){const stmt=db.prepare(sql);return{bind(...params){return{async first(){return stmt.get(...params)||null},async all(){return{results:stmt.all(...params)}},async run(){return stmt.run(...params)}}}}}};
  const env={DB:binding,AUTH_SECRET:'R1157_ISOLATED_1234567890_SECURITY_TEST_SECRET',CORS_ALLOW_ORIGINS:'https://isolation.example'};
  const post=async(url,body,token)=>{const headers={Origin:env.CORS_ALLOW_ORIGINS,'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;const r=await worker.fetch(new Request('https://worker.isolation.example'+url,{method:'POST',headers,body:JSON.stringify(body)}),env,{});return{status:r.status,body:await r.json()};};
  const login=async(user)=>{const r=await post('/api/tasun/login',{username:user,password});assert.equal(r.status,200,JSON.stringify(r.body));return r.body.token;};
  const admin=await login('admin-ci'),write=await login('write-ci'),read=await login('read-ci'),other=await login('unknown-ci'),resourceKey='r1157-ci-rows';
  const merge=(uid,token)=>post('/api/tasun/merge',{resourceKey,payload:{db:[{uid,rev:1,updatedAt:now,deleted:false}]}},token);
  const readback=()=>post('/api/tasun/read',{resourceKey},admin);
  await t.test('admin merge/readback metadata',async()=>{assert.equal((await merge('a',admin)).status,200);const r=await readback();assert.equal(r.status,200);const row=r.body.rows.find(x=>x.uid==='a');assert.ok(row);for(const k of ['uid','rev','updatedAt','deleted'])assert.ok(Object.hasOwn(row,k));});
  await t.test('write merge',async()=>{assert.equal((await merge('w',write)).status,200);assert.ok((await readback()).body.rows.some(x=>x.uid==='w'));});
  await t.test('read must be denied',async()=>{const r=await merge('forbidden-read',read);assert.equal(r.status,403);assert.ok(!(await readback()).body.rows.some(x=>x.uid==='forbidden-read'));});
  await t.test('unknown role must be denied',async()=>{assert.equal((await merge('other',other)).status,403);});
  await t.test('anonymous merge must be denied',async()=>{assert.equal((await merge('anon','')).status,401);});
  await t.test('downgraded writer token cannot merge',async()=>{db.prepare("UPDATE tasun_users SET role='read' WHERE username='write-ci'").run();try{const r=await merge('revoked-writer',write);assert.equal(r.status,403,JSON.stringify(r.body));assert.ok(!(await readback()).body.rows.some(x=>x.uid==='revoked-writer'));}finally{db.prepare("UPDATE tasun_users SET role='write' WHERE username='write-ci'").run();}});
  await t.test('disabled user token is rejected immediately',async()=>{db.prepare("UPDATE tasun_users SET enabled=0 WHERE username='read-ci'").run();try{assert.equal((await post('/api/tasun/me',{},read)).status,401);}finally{db.prepare("UPDATE tasun_users SET enabled=1 WHERE username='read-ci'").run();}});
  await t.test('auth-role override immediately revokes stale admin privilege',async()=>{db.prepare("INSERT INTO tasun_auth(username,role,updatedAt) VALUES(?,?,?)").run('admin-ci','read',Date.now());try{assert.equal((await merge('revoked-admin',admin)).status,403);}finally{db.prepare("DELETE FROM tasun_auth WHERE username='admin-ci'").run();}});
  await t.test('missing auth secret refuses login',async()=>{const secret=env.AUTH_SECRET;delete env.AUTH_SECRET;try{assert.notEqual((await post('/api/tasun/login',{username:'read-ci',password})).status,200)}finally{env.AUTH_SECRET=secret}});
 }finally{db.close();fs.rmSync(folder,{recursive:true,force:true})}
});
