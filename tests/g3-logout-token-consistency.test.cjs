'use strict';
// Offline-only regression: targeted logout/token aliases and late login response.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = x => fs.readFileSync(path.join(root,x),'utf8');
const entryPages = ['index.html','inline.js','tasun-api/index.html'];
const aliases = ['tasunCloudToken_v1','tasunCloudToken_v1__index','tasunCloudToken_v1__auth-table','tasunCloudToken_v1__sxdh-notes','tasunBearerToken_v1','authToken','access_token','token','tasunAuthToken_v1','tasunSessionToken_v1'];
const sessionAliases = ['tasunSessionBridge_v1','tasunCurrentUser_v1','tasunCurrentUser_v2','tasunSession_v1','tasunSessionLogin_v2','tasunSso_v2'];
class Storage {
  constructor(){this.data=new Map();}
  get length(){return this.data.size}
  key(i){return Array.from(this.data.keys())[i]||null}
  setItem(k,v){this.data.set(k,String(v))}
  getItem(k){return this.data.has(k)?this.data.get(k):null}
  removeItem(k){this.data.delete(k)}
}
function fixture() {
  const a=new Storage(),b=new Storage();
  for(const s of [a,b]){
    for(const k of [...aliases,...sessionAliases,'tasunLastLoginPass_v1'])s.setItem(k,'SYNTHETIC-ONLY');
    s.setItem('tasunBusinessRows_v1','[{"uid":"KEEP"}]');
    s.setItem('tasunAuthTable_v1','[{"user":"qa_offline"}]');
    s.setItem('tasunNavRoutes_v1','{"path":"KEEP"}');
  }
  return {a,b};
}
function mustClean(a,b){
  for(const s of [a,b]){
    for(const k of [...aliases,...sessionAliases,'tasunLastLoginPass_v1'])assert.equal(s.getItem(k),null,k);
    assert.equal(s.getItem('tasunBusinessRows_v1'),'[{"uid":"KEEP"}]');
    assert.equal(s.getItem('tasunAuthTable_v1'),'[{"user":"qa_offline"}]');
    assert.equal(s.getItem('tasunNavRoutes_v1'),'{"path":"KEEP"}');
  }
}
function runEntry(file,silent=false){
  const source=read(file);
  const start=source.indexOf('function clearLogoutAuthStorage(){');
  const end=source.indexOf('function getSession(){',start);
  assert.ok(start>=0 && end>start,file+':logout function not found');
  const block=source.slice(start,end);
  const {a,b}=fixture();
  const messages=[];
  vm.runInNewContext(block+'\nclearSession('+ (silent?'{silent:true}':'') +');',{
    sessionStorage:a,localStorage:b,
    SESSION_KEY:'tasunSession_v1',INDEX_SESSION_KEY:'tasunIndexSession_v1',
    CHILD_INDEX_SESSION_KEY:'tasunIndexSessionAuthed_v2',CURRENT_KEY:'tasunCurrentUser_v1',
    clearCookieSession:()=>{},clearSSO:()=>{},broadcastAuthState:(type)=>messages.push(type)
  });
  return {a,b,messages};
}
for(const file of entryPages){
  test(`${file}: logout removes auth aliases in both storages without removing business data`,()=>{
    const x=runEntry(file);mustClean(x.a,x.b);assert.deepEqual(x.messages,['logout']);
  });
  test(`${file}: silent session cleanup does not remove reusable tokens on ordinary page init`,()=>{
    const x=runEntry(file,true);
    assert.equal(x.a.getItem('authToken'),'SYNTHETIC-ONLY');
    assert.equal(x.b.getItem('access_token'),'SYNTHETIC-ONLY');
    assert.deepEqual(x.messages,[]);
  });
}
test('shared TasunGlobalCore.clearSessionLogin clears all aliases but not app data',()=>{
  const {a,b}=fixture();const win={sessionStorage:a,localStorage:b};
  const context={window:win,sessionStorage:a,localStorage:b,Date,JSON,Promise,URL,console};
  vm.runInNewContext(read('tasun-global-core.js'),context);
  win.TasunGlobalCore.clearSessionLogin();
  mustClean(a,b);
});
test('TasunAuthV4.logout clears all aliases but not app data',()=>{
  const {a,b}=fixture();const win={sessionStorage:a,localStorage:b};
  vm.runInNewContext(read('tasun-auth-v4.js'),{
    window:win,sessionStorage:a,localStorage:b,Date,JSON,Promise,console,fetch:()=>Promise.resolve({ok:true})
  });
  win.TasunAuthV4.logout();
  mustClean(a,b);
});
test('worker login finishing after logout cannot bridge a new token',async()=>{
  const code=read('tasun-api/index.html');
  const start=code.indexOf('async function workerLogin(user, password, role, epoch){');
  const end=code.indexOf('function syncExistingTokenBridge(){',start);
  assert.ok(start>=0 && end>start);
  let finishFetch, bridged=0;
  const response=new Promise(resolve=>finishFetch=resolve);
  const ctx={
    bridgeEpoch:0, API_BASE:'http://localhost:18787',
    norm:x=>String(x??'').trim(),
    bridgeToken:()=>{bridged++;},
    extractToken:()=> 'LOCAL-SYNTHETIC-TOKEN',
    fetch:()=>response,JSON,Error
  };
  const worker=vm.runInNewContext(code.slice(start,end)+'\nworkerLogin;',ctx);
  const pending=worker('qa_offline','SYNTHETIC-PASSWORD','read',0);
  ctx.bridgeEpoch++;
  finishFetch({ok:true,json:async()=>({token:'LOCAL-SYNTHETIC-TOKEN'})});
  assert.equal(await pending,'');
  assert.equal(bridged,0);
  assert.match(code,/bridgeEpoch\+\+;\s*pendingCred\s*=\s*null;\s*clearBridgedToken\(\)/);
});
