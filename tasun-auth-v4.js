(function(global){
  'use strict';

  var CURRENT_KEY = 'tasunCurrentUser_v1';
  var SESSION_KEY = 'tasunSession_v1';
  var INDEX_SESSION_KEY = 'tasunIndexSession_v1';
  var TOKEN_KEYS = ['tasunCloudToken_v1','tasunBearerToken_v1','tasunAccessToken_v1'];

  function writeSession(key, value){ try{ sessionStorage.setItem(key, value); }catch(e){} }
  function readSession(key){ try{ return sessionStorage.getItem(key)||''; }catch(e){ return ''; } }
  function removeEverywhere(key){ try{ sessionStorage.removeItem(key); }catch(e){} try{ localStorage.removeItem(key); }catch(e){} }

  function setCurrent(user){
    var row = JSON.stringify(user||null);
    writeSession(CURRENT_KEY, row);
    writeSession(SESSION_KEY, row);
    writeSession(INDEX_SESSION_KEY, '1');
    try{ if(global.TasunAuth && global.TasunAuth.setCurrent) global.TasunAuth.setCurrent(user||null); }catch(e){}
  }

  function getCurrent(){
    try{ return JSON.parse(readSession(CURRENT_KEY)||readSession(SESSION_KEY)||'null'); }catch(e){ return null; }
  }

  function normalizeRole(role){
    role = String(role||'').toLowerCase();
    if(role==='admin' || role==='write' || role==='read') return role;
    return 'read';
  }

  async function tryWorkerLogin(apiBase, username, password){
    if(!apiBase) throw new Error('no apiBase');
    var url = apiBase.replace(/\/$/,'') + '/api/tasun/login';
    var res = await fetch(url, {
      method:'POST',
      credentials:'include',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({ username: username, password: password })
    });
    if(!res.ok) throw new Error('login http '+res.status);
    var data = await res.json();
    var usernameOut = String(data.username || data.user || (data.data && data.data.username) || '').trim();
    var roleOut = normalizeRole(data.role || (data.user && data.user.role) || (data.data && data.data.role));
    var token = String(data.token || (data.user && data.user.token) || '').trim();
    if(!usernameOut || !token) throw new Error('bad login response');
    var u = { username:usernameOut, user:usernameOut, name:usernameOut, role:roleOut, token:token, updatedAt:Date.now() };
    TOKEN_KEYS.forEach(function(k){ writeSession(k, token); });
    setCurrent(u);
    return u;
  }

  async function login(opts){
    opts = opts||{};
    var username = String(opts.username||'').trim();
    var password = String(opts.password||'');
    var apiBase = String(opts.apiBase||global.TASUN_API_BASE||'').trim();
    if(!username || !password) throw new Error('missing credentials');
    return tryWorkerLogin(apiBase, username, password);
  }

  function logout(){
    removeEverywhere(CURRENT_KEY);
    removeEverywhere(SESSION_KEY);
    removeEverywhere(INDEX_SESSION_KEY);
    TOKEN_KEYS.forEach(removeEverywhere);
    try{ if(global.TasunAuth && global.TasunAuth.setCurrent) global.TasunAuth.setCurrent(null); }catch(e){}
  }

  global.TasunAuthV4 = { login: login, logout: logout, getCurrent: getCurrent };
})(window);
