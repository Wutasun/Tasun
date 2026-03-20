/* TasunAuthV4 (v5 unified)
 * - Worker token login only
 * - sessionStorage / session-cookie bridge
 * - no local fake login fallback
 */
(function(global){
  'use strict';
  var CURRENT_KEY='tasunCurrentUser_v1';
  var SESSION_KEY='tasunSession_v1';
  var INDEX_SESSION_KEY='tasunIndexSession_v1';
  var TOKEN_KEYS=['tasunCloudToken_v1','tasunBearerToken_v1','tasunCloudToken'];
  function writeSession(k,v){ try{ sessionStorage.setItem(k, typeof v==='string'?v:JSON.stringify(v)); }catch(e){} }
  function readSession(k){ try{ return sessionStorage.getItem(k); }catch(e){ return null; } }
  function removeEverywhere(k){ try{ sessionStorage.removeItem(k); }catch(e){} try{ localStorage.removeItem(k); }catch(e){} }
  function normalizeRole(role){ role=String(role||'').toLowerCase(); return (role==='admin'||role==='write'||role==='read')?role:'read'; }
  function setCurrent(user){
    var row=user?{ username:String(user.username||user.user||''), role:normalizeRole(user.role), token:String(user.token||''), updatedAt:Date.now() }:null;
    writeSession(CURRENT_KEY,row||null);
    writeSession(SESSION_KEY,row||null);
    writeSession(INDEX_SESSION_KEY,'1');
    TOKEN_KEYS.forEach(function(k){ if(row&&row.token) writeSession(k,row.token); else removeEverywhere(k); });
    try{ if(global.TasunAuth && global.TasunAuth.setCurrent) global.TasunAuth.setCurrent(row); }catch(e){}
    return row;
  }
  function getCurrent(){ try{ var s=readSession(CURRENT_KEY)||readSession(SESSION_KEY); if(s) return JSON.parse(s); }catch(e){} return null; }
  function getToken(){ var cur=getCurrent(); return String((cur&&cur.token)||readSession('tasunBearerToken_v1')||readSession('tasunCloudToken_v1')||''); }
  function isLoggedIn(){ var cur=getCurrent(); return !!(cur && cur.username && getToken()); }
  async function tryWorkerLogin(apiBase, username, password){
    if(!apiBase) throw new Error('no apiBase');
    var url=apiBase.replace(/\/$/,'')+'/api/tasun/login';
    var res=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({username:username,password:password})});
    if(!res.ok) throw new Error('login http '+res.status);
    var data=await res.json();
    var usernameOut=String(data.username||data.user||((data.data||{}).username)||((data.data||{}).user)||username);
    var roleOut=normalizeRole(data.role||((data.data||{}).role)||'read');
    var token=String(data.token||((data.data||{}).token)||'');
    if(!usernameOut||!token) throw new Error('bad login response');
    return { username:usernameOut, role:roleOut, token:token, updatedAt:Date.now() };
  }
  async function login(opts){ opts=opts||{}; var username=String(opts.username||'').trim(); var password=String(opts.password||''); var apiBase=String(opts.apiBase||global.TASUN_API_BASE||''); if(!username||!password) throw new Error('missing credentials'); var u=await tryWorkerLogin(apiBase,username,password); setCurrent(u); return u; }
  function logout(){ setCurrent(null); try{ var apiBase=String(global.TASUN_API_BASE||''); if(apiBase){ fetch(apiBase.replace(/\/$/,'')+'/api/tasun/logout',{method:'POST',credentials:'include'}).catch(function(){}); } }catch(e){} }
  global.__TASUN_IS_LOGGED_IN__ = isLoggedIn;
  global.__TASUN_GET_TOKEN__ = getToken;
  global.TasunAuthV4={ login:login, logout:logout, getCurrent:getCurrent, setCurrent:setCurrent, getToken:getToken, isLoggedIn:isLoggedIn };
})(window);
