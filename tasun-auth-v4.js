(function(global){
  'use strict';

  function norm(v){ return v == null ? '' : String(v).trim(); }
  function getCore(){ return global.TasunGlobalCore || null; }
  function getConsts(){
    var core = getCore();
    var c = core && core.consts ? core.consts : {};
    return {
      CURRENT_KEY: c.CURRENT_KEY || 'tasunCurrentUser_v1',
      SESSION_KEY: c.SESSION_KEY || 'tasunSession_v1',
      SESSION_BRIDGE_KEY: c.SESSION_BRIDGE_KEY || 'tasunSessionBridge_v1',
      INDEX_SESSION_KEY: c.INDEX_SESSION_KEY || 'tasunIndexSession_v1',
      NEXT_KEY: c.NEXT_KEY || 'tasun_next_path_v1',
      LAST_PASS_KEY: c.LAST_PASS_KEY || 'tasunLastLoginPass_v1'
    };
  }
  function write(k,v){
    try{ sessionStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }catch(_e){}
    try{ localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }catch(_e){}
  }
  function remove(k){
    try{ sessionStorage.removeItem(k); }catch(_e){}
    try{ localStorage.removeItem(k); }catch(_e){}
  }
  function normalizeRole(role){
    var core = getCore();
    if(core && core.norm){
      var r = core.norm(role).toLowerCase();
      return (r === 'admin' || r === 'write' || r === 'read') ? r : 'read';
    }
    role = norm(role).toLowerCase();
    return (role === 'admin' || role === 'write' || role === 'read') ? role : 'read';
  }
  function packUser(user){
    if(!user) return null;
    var username = norm(user.username || user.user || user.name);
    if(!username) return null;
    return {
      username: username,
      user: username,
      name: norm(user.name || username),
      role: normalizeRole(user.role || user.level),
      token: norm(user.token),
      updatedAt: Date.now(),
      at: (new Date()).toISOString()
    };
  }
  function getCurrent(){
    var core = getCore();
    return core && core.getCurrentUser ? core.getCurrentUser() : null;
  }
  function getToken(){
    var core = getCore();
    return core && core.getCloudToken ? core.getCloudToken() : '';
  }
  function isLoggedIn(){
    var cur = getCurrent();
    return !!(cur && cur.user && getToken());
  }
  function setSessionState(user, keepPass){
    var core = getCore();
    var C = getConsts();
    var row = packUser(user);
    if(row && row.user){
      if(core && core.setCurrentUser) core.setCurrentUser(row);
      if(core && core.mirrorToken) core.mirrorToken(row.token);
      if(keepPass){
        write(C.LAST_PASS_KEY, keepPass);
      }
      write(C.INDEX_SESSION_KEY, '1');
      return row;
    }
    if(core && core.clearSessionLogin){
      core.clearSessionLogin();
    }else{
      [C.CURRENT_KEY, C.SESSION_KEY, C.SESSION_BRIDGE_KEY, C.INDEX_SESSION_KEY, C.LAST_PASS_KEY].forEach(remove);
    }
    return null;
  }
  async function tryWorkerLogin(apiBase, username, password){
    if(!apiBase) throw new Error('no apiBase');
    var url = String(apiBase).replace(/\/$/, '') + '/api/tasun/login';
    var res = await fetch(url, {
      method:'POST',
      credentials:'include',
      headers:{ 'Content-Type':'application/json', 'Accept':'application/json' },
      body: JSON.stringify({ username:username, password:password })
    });
    if(!res.ok) throw new Error('login http ' + res.status);
    var data = await res.json().catch(function(){ return null; }) || {};
    var bag = data.data || data.payload || data.session || {};
    var usernameOut = norm(data.username || data.user || bag.username || bag.user || username);
    var roleOut = normalizeRole(data.role || bag.role || 'read');
    var token = norm(data.token || data.accessToken || data.authToken || data.bearer || bag.token || bag.accessToken || bag.authToken || bag.bearer);
    if(!usernameOut || !token) throw new Error('bad login response');
    return { username:usernameOut, user:usernameOut, name:usernameOut, role:roleOut, token:token, updatedAt:Date.now() };
  }
  async function login(opts){
    opts = opts || {};
    var username = norm(opts.username);
    var password = String(opts.password || '');
    var apiBase = norm(opts.apiBase || global.TASUN_API_BASE || '');
    if(!username || !password) throw new Error('missing credentials');
    var row = await tryWorkerLogin(apiBase, username, password);
    return setSessionState(row, password);
  }
  function setCurrent(user){ return setSessionState(user, ''); }
  function bridgeCurrentToChild(nextPath){
    var cur = getCurrent();
    if(!cur) return false;
    var C = getConsts();
    setSessionState(cur, '');
    if(nextPath){
      write(C.NEXT_KEY, String(nextPath));
    }
    return true;
  }
  function logout(){
    var core = getCore();
    setSessionState(null, '');
    try{
      var apiBase = norm(global.TASUN_API_BASE || '');
      if(apiBase){
        fetch(apiBase.replace(/\/$/, '') + '/api/tasun/logout', { method:'POST', credentials:'include' }).catch(function(){});
      }
    }catch(_e){}
    if(core && core.clearSessionLogin) core.clearSessionLogin();
  }

  global.__TASUN_IS_LOGGED_IN__ = isLoggedIn;
  global.__TASUN_GET_TOKEN__ = getToken;
  global.TasunAuthV4 = {
    login: login,
    logout: logout,
    getCurrent: getCurrent,
    setCurrent: setCurrent,
    getToken: getToken,
    isLoggedIn: isLoggedIn,
    setSessionState: setSessionState,
    getSessionState: getCurrent,
    clearSessionState: function(){ return setSessionState(null, ''); },
    bridgeCurrentToChild: bridgeCurrentToChild,
    mirrorToken: function(token){
      var core = getCore();
      return core && core.mirrorToken ? core.mirrorToken(token) : norm(token);
    }
  };
})(window);
