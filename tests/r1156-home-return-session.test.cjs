'use strict';
// Synthetic one-use R739 return ticket checks; no network, real users, or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname,'..','index.html'),'utf8');
const start = html.indexOf('function tryRestoreLogin(){');
const end = html.indexOf('function showLogin(msg){',start);
assert.ok(start>0 && end>start);
const code = html.slice(start,end)+'\ntryRestoreLogin();';
const now = Date.now();
const page = 'https://wutasun.github.io/Tasun/index.html';
const manager = 'https://wutasun.github.io/Tasun/%E6%B1%90%E6%9D%B1%E5%B7%A5%E7%A8%8B%E7%AE%A1%E7%90%86%E8%A1%A8.html';
class Store {
  constructor(data){this.data = new Map(Object.entries(data));}
  getItem(key){return this.data.get(key) ?? null;}
  removeItem(key){this.data.delete(key);}
}
function verify(config={}){
  const ticket = {ok:true,user:'qa_offline',role:'read',at:now,from:'汐東工程管理表.html',to:'index.html',mode:'history-restore',...config.ticket};
  const sessionStorage = new Store({tasun_manager_home_return_r739:JSON.stringify(ticket),tasunIndexLoginVerifiedAt_v1:String(now),tasunIndexLoginVerifiedUser_v1:'qa_offline',tasunIndexSessionAuthed_v2:'1',tasunIndexSession_v1:'1',...config.session});
  const localStorage = new Store({tasun_manager_home_return_r739:'shadow-ticket',tasunBusinessRows_v1:'KEEP'});
  const applied=[]; const urls=[];
  const href=config.href || page+'?from=manager-home-r739&_resumeSession=1&_rt='+now;
  const state={URL,Date,Number,JSON,Math,Array,String,Object,sessionStorage,localStorage,
    location:{href,origin:new URL(href).origin},document:{referrer:config.referrer===undefined?manager:config.referrer},
    INDEX_SESSION_KEY:'tasunIndexSessionAuthed_v2',CHILD_INDEX_SESSION_KEY:'tasunIndexSession_v1',
    AUTH_TABLE:[{username:'qa_offline',level:'read'}],getSession:()=>config.logout?null:{user:'qa_offline',role:config.role || 'read'},
    applyUser:u=>applied.push(u),history:{replaceState:(a,b,url)=>urls.push(url)}};
  const invoke=()=>vm.runInNewContext(code,state);
  return {invoke,applied,urls,sessionStorage,localStorage};
}
test('single-use valid manager return restores role, keeps business data',()=>{
  const x=verify();assert.equal(x.invoke(),true);assert.equal(x.applied[0].level,'read');
  assert.equal(x.sessionStorage.getItem('tasun_manager_home_return_r739'),null);
  assert.equal(x.localStorage.getItem('tasunBusinessRows_v1'),'KEEP');
  assert.equal(x.invoke(),false);
  assert.ok(!x.urls[0].includes('_resumeSession'));
});
test('cold homepage does not silently log in',()=>assert.equal(verify({href:page}).invoke(),false));
test('query flag without same-tab ticket is denied',()=>assert.equal(verify({session:{tasun_manager_home_return_r739:''}}).invoke(),false));
test('untrusted or missing referrer denied',()=>{
  for(const referrer of ['',page,'https://attacker.invalid/page'])assert.equal(verify({referrer}).invoke(),false);
});
test('expired or future ticket denied',()=>{
  for(const at of [now-61000,now+5000])assert.equal(verify({ticket:{at}}).invoke(),false);
});
test('logout and wrong role denied',()=>{
  assert.equal(verify({logout:true}).invoke(),false);
  assert.equal(verify({role:'admin'}).invoke(),false);
});
test('missing verification flag denied',()=>assert.equal(verify({session:{tasunIndexSessionAuthed_v2:''}}).invoke(),false));
test('explicit force-login cannot be bypassed',()=>assert.equal(verify({href:page+'?from=manager-home-r739&_resumeSession=1&_rt='+now+'&_forceLogin=1'}).invoke(),false));
test('homepage boot falls back to normal login if handoff invalid',()=>{
  assert.match(html,/if\(!tryRestoreLogin\(\)\) showLogin\(\);/);
  assert.match(html,/function clearLogoutAuthStorage\(\)/);
  assert.match(html,/tasun-legacy-password-cache-clean-v1/);
});
