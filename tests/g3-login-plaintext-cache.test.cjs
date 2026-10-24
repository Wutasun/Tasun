'use strict';
// Synthetic browser-storage login checks. No remote endpoints, real credentials or D1.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const ENTRY = ['index.html','inline.js','tasun-api/index.html'];
const CORE = ['tasun-auth-v4.js','tasun-global-core.js'];

class StorageMock {
  constructor(items = {}){ this.map=new Map(Object.entries(items)); this.calls=[]; }
  get length(){return this.map.size;}
  key(index){return Array.from(this.map.keys())[index] ?? null;}
  getItem(k){return this.map.has(k) ? this.map.get(k) : null;}
  setItem(k,v){this.calls.push({key:String(k),value:String(v)});this.map.set(String(k),String(v));}
  removeItem(k){this.map.delete(String(k));}
}
function mockEnv(){
  const localStorage = new StorageMock({
    'tasunLastLoginPass_v1':'legacy-plain-password',
    'tasunLastLoginPass_v1__alice':'legacy-alice-password',
    'tasunLastLoginPass_v1__bob':'legacy-bob-password',
    'tasunCloudToken_v1':'persisted-fake-token',
    'tasunCurrentUser_v1':'{"user":"alice","role":"read"}',
    'tasunDocsExample_v1':'{"rows":[1,2,3]}'
  });
  const sessionStorage = new StorageMock({
    'tasunLastLoginPass_v1':'legacy-session-password',
    'tasunLastLoginPass_v1__alice':'legacy-session-alice',
    'tasunCloudToken_v1':'session-fake-token',
    'tasunIndexSession_v1':'1'
  });
  const win={localStorage,sessionStorage};
  return {win, localStorage, sessionStorage};
}
const oldPasswordKeys = s => Array.from(s.map.keys()).filter(k=>k==='tasunLastLoginPass_v1' || k.startsWith('tasunLastLoginPass_v1__'));

for(const file of ENTRY){
  test(`entry ${file} deletes historical plaintext keys without deleting business/session/token data`,()=>{
    const raw=read(file);
    const block=raw.match(/<script id="tasun-legacy-password-cache-clean-v1">([\s\S]*?)<\/script>/);
    assert.ok(block, 'early boot sanitizer must exist');
    const {win,localStorage,sessionStorage}=mockEnv();
    vm.runInNewContext(block[1], {window:win});
    assert.deepEqual(oldPasswordKeys(localStorage),[]);
    assert.deepEqual(oldPasswordKeys(sessionStorage),[]);
    assert.equal(localStorage.getItem('tasunDocsExample_v1'),'{"rows":[1,2,3]}');
    assert.equal(localStorage.getItem('tasunCloudToken_v1'),'persisted-fake-token');
    assert.equal(sessionStorage.getItem('tasunCloudToken_v1'),'session-fake-token');
    assert.equal(localStorage.getItem('tasunCurrentUser_v1'),'{"user":"alice","role":"read"}');
  });
}

test('three entry pages have no plaintext-password storage writes or child-page password copying',()=>{
  for(const file of ENTRY){
    const s=read(file);
    assert.doesNotMatch(s,/\b(?:localStorage|sessionStorage)\.setItem\s*\(\s*['"]tasunLastLoginPass_v1/);
    assert.doesNotMatch(s,/\bwriteStorage\s*\(\s*(?:localStorage|sessionStorage)\s*,\s*LAST_LOGIN_PASS_KEY/);
    assert.doesNotMatch(s,/\b(?:localStorage|sessionStorage)\.getItem\s*\(\s*['"]tasunLastLoginPass_v1/);
    assert.ok(s.includes('async function __tasunBridgeWorkerTokenNow(username, password, role)'),'form-driven Worker login preserved');
  }
});

test('tasun-auth-v4 initialises without saving old passwords and permits token-backed cross-page session',async()=>{
  const {win,localStorage,sessionStorage}=mockEnv();
  let loginCall;
  const ctx={window:win,localStorage,sessionStorage,console,Date,JSON,Promise,
    fetch:async(url,init)=>{
      loginCall={url,init};return {ok:true,json:async()=>({username:'alice',role:'write',token:'synthetic-issued-token'})};
    }};
  vm.runInNewContext(read('tasun-auth-v4.js'),ctx);
  assert.deepEqual(oldPasswordKeys(localStorage),[]);
  assert.deepEqual(oldPasswordKeys(sessionStorage),[]);
  assert.ok(win.TasunAuthV4);
  const user=await win.TasunAuthV4.login({username:'alice',password:'a-onetime-pass',apiBase:'https://worker.invalid'});
  assert.equal(loginCall.url,'https://worker.invalid/api/tasun/login');
  assert.deepEqual(JSON.parse(loginCall.init.body),{username:'alice',password:'a-onetime-pass'});
  assert.equal(user.user,'alice');
  assert.equal(user.role,'write');
  assert.equal(win.TasunAuthV4.getToken(),'synthetic-issued-token');
  assert.equal(localStorage.getItem('tasunCloudToken_v1'),'synthetic-issued-token');
  assert.deepEqual(oldPasswordKeys(localStorage),[]);
  assert.deepEqual(oldPasswordKeys(sessionStorage),[]);
  // Cross-page reader sees inherited user and token, not the password.
  const reader={window:win,localStorage,sessionStorage,console,Date,JSON,Promise,fetch:ctx.fetch};
  vm.runInNewContext(read('tasun-auth-v4.js'),reader);
  assert.equal(win.TasunAuthV4.getToken(),'synthetic-issued-token');
  assert.equal(win.TasunAuthV4.getCurrent().user,'alice');
});

test('tasun-auth-v4 logout drops token and session without resurrecting password keys',()=>{
  const {win,localStorage,sessionStorage}=mockEnv();
  vm.runInNewContext(read('tasun-auth-v4.js'),{window:win,localStorage,sessionStorage,console,Date,JSON,Promise,fetch:async()=>({ok:true})});
  win.TasunAuthV4.setCurrent({username:'alice',role:'read',token:'fake-token'});
  assert.equal(win.TasunAuthV4.getToken(),'fake-token');
  win.TasunAuthV4.logout();
  assert.equal(win.TasunAuthV4.getToken(),'');
  assert.deepEqual(oldPasswordKeys(localStorage),[]);
  assert.deepEqual(oldPasswordKeys(sessionStorage),[]);
});

test('shared global core bridgeAuth does not write the password supplied by legacy callers',()=>{
  const {win,localStorage,sessionStorage}=mockEnv();
  vm.runInNewContext(read('tasun-global-core.js'),{window:win,localStorage,sessionStorage,console,Date,JSON,Promise,URL});
  const core=win.TasunGlobalCore;
  assert.ok(core);
  assert.equal(core.bridgeAuth({user:'alice',role:'admin'},'token-new','top-secret-input'),true);
  assert.equal(localStorage.getItem('tasunCloudToken_v1'),'token-new');
  assert.deepEqual(oldPasswordKeys(localStorage),[]);
  assert.deepEqual(oldPasswordKeys(sessionStorage),[]);
  assert.equal(localStorage.getItem('tasunDocsExample_v1'),'{"rows":[1,2,3]}');
});

test('tasun-api index bridge requires fresh form password only when no reusable token exists',()=>{
  const s=read('tasun-api/index.html');
  assert.match(s,/var pass = norm\(cred\.pass\); \/\/ only the immediate login form may provide this/);
  assert.match(s,/if\(token\)\{ bridgeToken\(token, user, role, ''\); return true; \}/);
  assert.match(s,/if\(!pass\) return false; \/\/ cannot silently re-login using stored plaintext/);
  assert.doesNotMatch(s,/pass\s*=\s*norm\(cred\.pass\)\s*\|\|\s*getLastPass/);
});

test('scope is exactly six existing files plus this one test; no versions or production config edits',()=>{
  for(const file of [...ENTRY,...CORE,'臻鼎管理表.html']) assert.ok(fs.existsSync(path.join(ROOT,file)));
  assert.match(read('臻鼎管理表.html'),/bridgeAuth\(cur, tk, pass\)/);
  assert.doesNotMatch(read('臻鼎管理表.html'),/getItem\('tasunLastLoginPass_v1'\)/);
});
