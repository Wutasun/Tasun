/* TasunAuthV4 (v5 unified bridge final)
 * - Worker token login only
 * - unified token bridge for index -> subpages
 * - session + local bridge keys
 */
(function(global){
  'use strict';
  var CURRENT_KEY='tasunCurrentUser_v1';
  var SESSION_KEY='tasunSession_v1';
  var SESSION_BRIDGE_KEY='tasunSessionBridge_v1';
  var INDEX_SESSION_KEY='tasunIndexSession_v1';
  var LAST_PASS_KEY='tasunLastLoginPass_v1';
  var TOKEN_KEYS=['tasunBearerToken_v1','tasunCloudToken_v1','tasunCloudToken','tasun_token','tasunToken','tasunWorkerToken','tasun_auth_token','tasun_session_token'];
  function norm(v){ return v == null ? '' : String(v).trim(); }
  function safeJSON(raw){ try{ return JSON.parse(raw); }catch(_e){ return null; } }
  function write(store,k,v){ try{ store.setItem(k, typeof v==='string' ? v : JSON.stringify(v)); }catch(_e){} }
  function read(store,k){ try{ return store.getItem(k); }catch(_e){ return ''; } }
  function removeBoth(k){ try{ sessionStorage.removeItem(k); }catch(_e){} try{ localStorage.removeItem(k); }catch(_e){} }
  function normalizeRole(role){ role=norm(role).toLowerCase(); return (role==='admin'||role==='write'||role==='read')?role:'read'; }
  function getAny(keys){
    keys = Array.isArray(keys) ? keys : [keys];
    for(var i=0;i<keys.length;i++){
      var k = keys[i];
      var sv = norm(read(sessionStorage,k));
      if(sv) return sv;
      var lv = norm(read(localStorage,k));
      if(lv) return lv;
    }
    return '';
  }
  function readUserLike(){
    var keys=[CURRENT_KEY,SESSION_KEY,SESSION_BRIDGE_KEY,'tasunSessionLogin_v1','tasunSso_v2','tasunSso_v1'];
    for(var i=0;i<keys.length;i++){
      var obj = safeJSON(getAny(keys[i]));
      if(obj && (obj.username || obj.user || obj.name)) return obj;
    }
    return null;
  }
  function mirrorToken(token){
    token = norm(token).replace(/^Bearer\s+/i,'');
    TOKEN_KEYS.forEach(function(k){ if(token){ write(sessionStorage,k,token); write(localStorage,k,token); } else { removeBoth(k); } });
    return token;
  }
  function mirrorCurrent(user, keepPass){
    var row=user?{ username:norm(user.username||user.user||user.name), user:norm(user.user||user.username||user.name), name:norm(user.name||user.user||user.username), role:normalizeRole(user.role), token:norm(user.token), updatedAt:Date.now(), at:(new Date()).toISOString() }:null;
    if(row && row.user){
      write(sessionStorage,CURRENT_KEY,row); write(localStorage,CURRENT_KEY,row);
      write(sessionStorage,SESSION_KEY,row); write(localStorage,SESSION_KEY,row);
      write(sessionStorage,SESSION_BRIDGE_KEY,row); write(localStorage,SESSION_BRIDGE_KEY,row);
      write(sessionStorage,INDEX_SESSION_KEY,'1');
      mirrorToken(row.token);
      if(keepPass){ write(sessionStorage,LAST_PASS_KEY,keepPass); write(localStorage,LAST_PASS_KEY,keepPass); }
    }else{
      [CURRENT_KEY,SESSION_KEY,SESSION_BRIDGE_KEY,INDEX_SESSION_KEY,LAST_PASS_KEY].forEach(removeBoth);
      mirrorToken('');
    }
    try{ if(global.TasunAuth && global.TasunAuth.setCurrent) global.TasunAuth.setCurrent(row); }catch(_e){}
    return row;
  }
  function getCurrent(){
    var row = readUserLike();
    if(!row) return null;
    var token = norm(row.token || getToken());
    var user = norm(row.username || row.user || row.name);
    if(!user) return null;
    return { username:user, user:user, name:norm(row.name||user), role:normalizeRole(row.role), token:token, updatedAt:Number(row.updatedAt||Date.now())||Date.now() };
  }
  function getToken(){
    var token = getAny(TOKEN_KEYS);
    if(token) return norm(token).replace(/^Bearer\s+/i,'');
    var row = readUserLike();
    return norm(row && row.token).replace(/^Bearer\s+/i,'');
  }
  function isLoggedIn(){ var cur=getCurrent(); return !!(cur && cur.username && getToken()); }
  async function tryWorkerLogin(apiBase, username, password){
    if(!apiBase) throw new Error('no apiBase');
    var url=String(apiBase).replace(/\/$/,'')+'/api/tasun/login';
    var res=await fetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({username:username,password:password})});
    if(!res.ok) throw new Error('login http '+res.status);
    var data=await res.json().catch(function(){ return null; }) || {};
    var bag = data.data || data.payload || data.session || {};
    var usernameOut=norm(data.username||data.user||bag.username||bag.user||username);
    var roleOut=normalizeRole(data.role||bag.role||'read');
    var token=norm(data.token||data.accessToken||data.authToken||data.bearer||bag.token||bag.accessToken||bag.authToken||bag.bearer);
    if(!usernameOut||!token) throw new Error('bad login response');
    return { username:usernameOut, user:usernameOut, name:usernameOut, role:roleOut, token:token, updatedAt:Date.now() };
  }
  async function login(opts){ opts=opts||{}; var username=norm(opts.username); var password=String(opts.password||''); var apiBase=norm(opts.apiBase||global.TASUN_API_BASE||''); if(!username||!password) throw new Error('missing credentials'); var u=await tryWorkerLogin(apiBase,username,password); mirrorCurrent(u,password); return getCurrent(); }
  function setCurrent(user){ return mirrorCurrent(user, ''); }
  function logout(){ mirrorCurrent(null,''); try{ var apiBase=norm(global.TASUN_API_BASE||''); if(apiBase){ fetch(apiBase.replace(/\/$/,'')+'/api/tasun/logout',{method:'POST',credentials:'include'}).catch(function(){}); } }catch(_e){} }
  global.__TASUN_IS_LOGGED_IN__ = isLoggedIn;
  global.__TASUN_GET_TOKEN__ = getToken;
  global.TasunAuthV4={ login:login, logout:logout, getCurrent:getCurrent, setCurrent:setCurrent, getToken:getToken, isLoggedIn:isLoggedIn, TOKEN_KEYS:TOKEN_KEYS.slice(), mirrorToken:mirrorToken };
})(window);
